import { useState, useContext, useEffect } from 'react'
import { RingContext } from '../context/RingContext'
import { DisplayContext } from '../context/DisplayContext'
import { ContextType } from '../context/ContextType'
import { Card } from 'databag-client-sdk'

export function useCalling() {
  let ring = useContext(RingContext) as ContextType
  let display = useContext(DisplayContext) as ContextType

  let [state, setState] = useState({
    strings: display.state.strings,
    calls: [] as { callId: string; card: Card }[],
    calling: null as null | Card,
    localStream: null as null | MediaStream,
    remoteStream: null as null | MediaStream,
    localVideo: false,
    remoteVideo: false,
    audioEnabled: false,
    videoEnabled: false,
    connected: false,
    failed: false,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateState = (value: any) => {
    setState((s) => ({ ...s, ...value }))
  }

  useEffect(() => {
    let { calls, calling, localStream, remoteStream, localVideo, remoteVideo, audioEnabled, videoEnabled, connected, failed } = ring.state
    updateState({ calls, calling, localStream, remoteStream, localVideo, remoteVideo, audioEnabled, videoEnabled, connected, failed })
  }, [ring.state])

  let actions = ring.actions
  return { state, actions }
}
