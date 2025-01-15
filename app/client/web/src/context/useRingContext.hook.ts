import { useState, useContext, useEffect, useRef } from 'react'
import { AppContext } from '../context/AppContext'
import { ContextType } from '../context/ContextType'
import { Link, type Card } from 'databag-client-sdk'

let CLOSE_POLL_MS = 100

export function useRingContext() {
  let app = useContext(AppContext) as ContextType
  let call = useRef(null as { peer: RTCPeerConnection; link: Link; candidates: RTCIceCandidate[] } | null)
  let localStream = useRef(null as null | MediaStream)
  let localAudio = useRef(null as null | MediaStreamTrack)
  let localVideo = useRef(null as null | MediaStreamTrack)
  let remoteStream = useRef(null as null | MediaStream)
  let updatingPeer = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let peerUpdate = useRef([] as { type: string; data?: any }[])
  let connecting = useRef(false)
  let closing = useRef(false)
  let passive = useRef(false)
  let passiveTracks = useRef([] as { track: MediaStreamTrack; stream: MediaStream }[])
  let [ringing, setRinging] = useState([] as { cardId: string; callId: string }[])
  let [cards, setCards] = useState([] as Card[])

  let [state, setState] = useState({
    calls: [] as { callId: string; cardId: string }[],
    calling: null as null | Card,
    localStream: null as null | MediaStream,
    remoteStream: null as null | MediaStream,
    localVideo: false,
    remoteVideo: false,
    audioEnabled: false,
    videoEnabled: false,
    connected: false,
    failed: false,
    fullscreen: false,
    connectedTime: 0,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  useEffect(() => {
    let calls = ringing.map((ring) => ({ callId: ring.callId, card: cards.find((card) => ring.cardId === card.cardId) })).filter((ring) => ring.card && !ring.card.blocked)
    updateState({ calls })
  }, [ringing, cards])

  let getAudioStream = async (audioId: null | string) => {
    try {
      if (audioId) {
        return await navigator.mediaDevices.getUserMedia({ video: false, audio: { deviceId: audioId } })
      }
    } catch (err) {
      console.log(err)
    }
    return await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
  }

  let getVideoStream = async (videoId: null | string) => {
    try {
      if (videoId) {
        return await navigator.mediaDevices.getUserMedia({ video: { deviceId: videoId }, audio: false })
      }
    } catch (err) {
      console.log(err)
    }
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
  }

  let linkStatus = async (status: string) => {
    if (call.current) {
      if (status === 'connected') {
        let connectedTime = Math.floor(new Date().getTime() / 1000)
        updateState({ connected: true, connectedTime })
        try {
          await actions.enableAudio()
        } catch (err) {
          console.log('failed to enable audio on connection')
          console.log(err)
        }
      } else if (status === 'closed') {
        await cleanup()
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updatePeer = async (type: string, data?: any) => {
    peerUpdate.current.push({ type, data })

    if (!updatingPeer.current) {
      updatingPeer.current = true
      while (!closing.current && call.current && peerUpdate.current.length > 0) {
        let { peer, link, candidates } = call.current
        let { type, data } = peerUpdate.current.shift() || { type: '' }
        try {
          switch (type) {
            case 'negotiate': {
              let description = await peer.createOffer()
              await peer.setLocalDescription(description)
              await link.sendMessage({ description })
              break
            }
            case 'candidate':
              await link.sendMessage({ data })
              break
            case 'message':
              if (data.description) {
                let offer = new RTCSessionDescription(data.description)
                await peer.setRemoteDescription(offer)
                if (data.description.type === 'offer') {
                  let description = await peer.createAnswer()
                  await peer.setLocalDescription(description)
                  link.sendMessage({ description })
                }
                for (let candidate of candidates) {
                  await peer.addIceCandidate(candidate)
                }
                call.current.candidates = []
              } else if (data.candidate) {
                let candidate = new RTCIceCandidate(data.candidate)
                if (peer.remoteDescription == null) {
                  candidates.push(candidate)
                } else {
                  await peer.addIceCandidate(candidate)
                }
              }
              break
            case 'remote_track':
              if (remoteStream.current) {
                remoteStream.current.addTrack(data)
                passive.current = false
                passiveTracks.current.forEach((data) => {
                  peer.addTrack(data.track, data.stream)
                })
                passiveTracks.current = []
                if (data.kind === 'video') {
                  updateState({ remoteVideo: true })
                }
              }
              break
            case 'local_track':
              if (passive.current) {
                passiveTracks.current.push(data)
              } else {
                peer.addTrack(data.track, data.stream)
              }
              if (data.track.kind === 'audio') {
                localAudio.current = data.track
              }
              if (data.track.kind === 'video') {
                localVideo.current = data.track
                localStream.current = data.stream
                updateState({ localVideo: true, localStream: localStream.current })
              }
              break
            default:
              console.log('unknown event')
              break
          }
        } catch (err) {
          console.log(err)
          updateState({ failed: true })
        }
      }
      updatingPeer.current = false
    }
  }

  let setup = async (link: Link, card: Card, polite: boolean) => {
    passive.current = polite
    localAudio.current = null
    localVideo.current = null
    localStream.current = null
    remoteStream.current = new MediaStream()
    let ice = link.getIce()
    let peer = transmit(ice)
    let candidates = [] as RTCIceCandidate[]
    call.current = { peer, link, candidates }
    link.setStatusListener(linkStatus)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    link.setMessageListener((msg: any) => updatePeer('message', msg))
    updateState({
      calling: card,
      failed: false,
      connected: false,
      connectedTime: 0,
      audioEnabled: false,
      videoEnabled: false,
      localVideo: false,
      remoteVideo: false,
      localStream: localStream.current,
      remoteStream: remoteStream.current,
      fullscreen: false,
    })
  }

  let cleanup = async () => {
    closing.current = true
    while (updatingPeer.current || connecting.current) {
      await new Promise((r) => setTimeout(r, CLOSE_POLL_MS))
    }
    if (call.current) {
      let { peer, link } = call.current
      peer.close()
      link.close()
      call.current = null
    }
    if (localVideo.current) {
      localVideo.current.stop()
      localVideo.current = null
    }
    if (localAudio.current) {
      localAudio.current.stop()
      localAudio.current = null
    }
    localStream.current = null
    remoteStream.current = null
    peerUpdate.current = []
    updateState({ calling: null, connected: false, connectedTime: 0, fullscreen: false, failed: false, localStream: null, remoteStream: null, localVideo: false, remoteVideo: false })
    closing.current = false
  }

  let transmit = (ice: { urls: string; username: string; credential: string }[]) => {
    let peerConnection = new RTCPeerConnection({ iceServers: ice })
    peerConnection.addEventListener('connectionstatechange', (event) => {
      console.log(peerConnection, event)
    })
    peerConnection.addEventListener('icecandidate', (event) => {
      updatePeer('candidate', event.candidate)
    })
    peerConnection.addEventListener('icecandidateerror', (event) => {
      console.log('ICE ERROR', event)
    })
    peerConnection.addEventListener('iceconnectionstatechange', (event) => {
      console.log('ICE STATE CHANGE', event)
    })
    peerConnection.addEventListener('negotiationneeded', () => {
      updatePeer('negotiate')
    })
    peerConnection.addEventListener('signalingstatechange', (event) => {
      console.log('ICE SIGNALING', event)
    })
    peerConnection.addEventListener('track', (event) => {
      updatePeer('remote_track', event.track)
    })
    return peerConnection
  }

  useEffect(() => {
    if (app.state.session) {
      let setRing = (ringing: { cardId: string; callId: string }[]) => {
        setRinging(ringing)
      }
      let setContacts = (cards: Card[]) => {
        setCards(cards)
      }
      let ring = app.state.session.getRing()
      ring.addRingingListener(setRinging)
      let contact = app.state.session.getContact()
      contact.addCardListener(setContacts)
      return () => {
        ring.removeRingingListener(setRing)
        contact.removeCardListener(setContacts)
        cleanup()
      }
    }
  }, [app.state.session])

  let actions = {
    setFullscreen: (fullscreen: boolean) => {
      updateState({ fullscreen })
    },
    ignore: async (callId: string, card: Card) => {
      let ring = app.state.session.getRing()
      await ring.ignore(card.cardId, callId)
    },
    decline: async (callId: string, card: Card) => {
      let ring = app.state.session.getRing()
      await ring.decline(card.cardId, callId)
    },
    end: async () => {
      await cleanup()
    },
    accept: async (callId: string, card: Card) => {
      if (connecting.current || closing.current || call.current) {
        throw new Error('not ready to accept calls')
      }
      try {
        connecting.current = true
        let { cardId, node } = card
        let ring = app.state.session.getRing()
        let link = await ring.accept(cardId, callId, node)
        await setup(link, card, true)
        connecting.current = false
      } catch (err) {
        connecting.current = false
        throw err
      }
    },
    call: async (card: Card) => {
      if (connecting.current || closing.current || call.current) {
        throw new Error('not ready make calls')
      }
      try {
        connecting.current = true
        let contact = app.state.session.getContact()
        let link = await contact.callCard(card.cardId)
        await setup(link, card, false)
        connecting.current = false
      } catch (err) {
        connecting.current = false
        throw err
      }
    },
    enableAudio: async () => {
      if (connecting.current || closing.current || !call.current) {
        throw new Error('cannot unmute audio')
      }
      if (!localAudio.current) {
        try {
          connecting.current = true
          let audioStream = await getAudioStream(null)
          let audioTrack = audioStream.getTracks().find((track: MediaStreamTrack) => track.kind === 'audio')
          if (!audioTrack) {
            throw new Error('no available audio track')
          }
          updatePeer('local_track', { track: audioTrack, stream: audioStream })
          connecting.current = false
        } catch (err) {
          connecting.current = false
          throw err
        }
      } else {
        localAudio.current.enabled = true
      }
      updateState({ audioEnabled: true })
    },
    disableAudio: async () => {
      if (!call.current) {
        throw new Error('cannot mute audio')
      }
      if (localAudio.current) {
        localAudio.current.enabled = false
      }
      updateState({ audioEnabled: false })
    },
    enableVideo: async () => {
      if (connecting.current || closing.current || !call.current) {
        throw new Error('cannot start video')
      }
      if (!localVideo.current) {
        try {
          connecting.current = true
          let videoStream = await getVideoStream(null)
          let videoTrack = videoStream.getTracks().find((track: MediaStreamTrack) => track.kind === 'video')
          if (videoTrack) {
            updatePeer('local_track', { track: videoTrack, stream: videoStream })
          }
          connecting.current = false
        } catch (err) {
          connecting.current = false
          throw err
        }
      } else {
        localVideo.current.enabled = true
      }
      updateState({ videoEnabled: true })
    },
    disableVideo: async () => {
      if (!call.current) {
        throw new Error('cannot stop video')
      }
      if (localVideo.current) {
        localVideo.current.enabled = false
      }
      updateState({ videoEnabled: false })
    },
  }

  return { state, actions }
}
