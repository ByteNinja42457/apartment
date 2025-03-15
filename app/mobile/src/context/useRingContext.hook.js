import { useEffect, useContext, useState, useRef } from 'react';
import { Alert } from 'react-native';
import { createWebsocket } from 'api/fetchUtil';
import { addContactRing } from 'api/addContactRing';
import { addCall } from 'api/addCall';
import { keepCall } from 'api/keepCall';
import { removeCall } from 'api/removeCall';
import { removeContactCall } from 'api/removeContactCall';
import InCallManager from 'react-native-incall-manager';

import {
	ScreenCapturePickerView,
	RTCPeerConnection,
	RTCIceCandidate,
	RTCSessionDescription,
	RTCView,
	MediaStream,
	MediaStreamTrack,
	mediaDevices,
	registerGlobals
} from 'react-native-webrtc';

export function useRingContext() {
  var [state, setState] = useState({
    ringing: new Map(),
    callStatus: null,
    cardId: null,
    localStream: null,
    localVideo: false,
    localAudio: false,
    remoteStream: null,
    removeVideo: false,
    removeAudio: false,
  });
  var access = useRef(null);

  var EXPIRE = 3000
  var RING = 2000
  var RING_COUNT = 10
  var ringing = useRef(new Map());
  var calling = useRef(null);
  var ws = useRef(null);
  var pc = useRef(null);
  var stream = useRef(null);
  var videoTrack = useRef();
  var audioTrack = useRef();
  var offers = useRef([]);
  var processing = useRef(false);
  var connected = useRef(false);
  var candidates = useRef([]);

  var constraints = {
    mandatory: {
      OfferToReceiveAudio: true,
      OfferToReceiveVideo: false,
      VoiceActivityDetection: true
    }
  };

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }))
  }

  var polite = async () => {
    if (processing.current || !connected.current) {
      return;
    }

    processing.current = true;

    while (offers.current.length > 0) {
      var descriptions = offers.current;
      offers.current = [];

      try {
        for (let i = 0; i < descriptions.length; i++) {
          var description = descriptions[i];
          stream.current = null;

          if (description == null) {
            var offer = await pc.current.createOffer(constraints);
            await pc.current.setLocalDescription(offer);
            ws.current.send(JSON.stringify({ description: offer }));
          }
          else {
            if (description.type === 'offer' && pc.current.signalingState !== 'stable') {
              var rollback = new RTCSessionDescription({ type: "rollback" });
              await pc.current.setLocalDescription(rollback);
            }
            var offer = new RTCSessionDescription(description);
            await pc.current.setRemoteDescription(offer);
            if (description.type === 'offer') {
              var answer = await pc.current.createAnswer();
              await pc.current.setLocalDescription(answer);
              ws.current.send(JSON.stringify({ description: answer }));
            }
            var servers = candidates.current;
            candidates.current = [];
            for (let i = 0; i < servers.length; i++) {
              var candidate = new RTCIceCandidate(servers[i]);
              await pc.current.addIceCandidate(candidate);
            }
          }
        }
      }
      catch (err) {
        console.log(err);
        //Alert.alert('webrtc error', err.toString());
      }
    }

    processing.current = false;
  }

  var impolite = async () => {
    if (processing.current || !connected.current) {
      return;
    }

    processing.current = true;
    while (offers.current.length > 0) {
      var descriptions = offers.current;
      offers.current = [];

      for (let i = 0; i < descriptions.length; i++) {
        var description = descriptions[i];
        stream.current = null;

        try {
          if (description == null) {
            var offer = await pc.current.createOffer(constraints);
            await pc.current.setLocalDescription(offer);
            ws.current.send(JSON.stringify({ description: offer }));
          }
          else {
            if (description.type === 'offer' && pc.current.signalingState !== 'stable') {
              continue;
            }

            var offer = new RTCSessionDescription(description);
            await pc.current.setRemoteDescription(offer);

            if (description.type === 'offer') {
              var answer = await pc.current.createAnswer();
              await pc.current.setLocalDescription(answer);
              ws.current.send(JSON.stringify({ description: answer }));
            }
            var servers = candidates.current;
            candidates.current = [];
            for (let i = 0; i < servers.length; i++) {
              var candidate = new RTCIceCandidate(servers[i]);
              await pc.current.addIceCandidate(candidate);
            }
          }
        }
        catch (err) {
          console.log(err);
          //Alert.alert('webrtc error', err.toString());
        }
      }
    }
    processing.current = false;
  }

  var transmit = async (policy, ice) => {

    pc.current = new RTCPeerConnection({ iceServers: ice });
    pc.current.addEventListener( 'connectionstatechange', event => {
      console.log("CONNECTION STATE", event);
    } );
    pc.current.addEventListener( 'icecandidate', event => {
      ws.current.send(JSON.stringify({ candidate: event.candidate }));
    } );
    pc.current.addEventListener( 'icecandidateerror', event => {
      console.log("ICE ERROR");
    } );
    pc.current.addEventListener( 'iceconnectionstatechange', event => {
      console.log("ICE STATE CHANGE", event);
    } );
    pc.current.addEventListener( 'negotiationneeded', async (ev) => {
      offers.current.push(null);
      if (policy === 'polite') {
        polite();
      }
      if (policy === 'impolite') {
        impolite();
      }
    } );
    pc.current.addEventListener( 'signalingstatechange', event => {
      console.log("ICE SIGNALING", event);
    } );
    pc.current.addEventListener( 'track', event => {
      if (stream.current == null) {
        stream.current = new MediaStream();
        updateState({ remoteStream: stream.current });
      }
      if (event.track.kind === 'audio') {
        updateState({ remoteAudio: true });
      }
      if (event.track.kind === 'video') {
        updateState({ remoteVideo: true });
        InCallManager.setForceSpeakerphoneOn(true);
      }
      stream.current.addTrack(event.track, stream.current);
    } );

    try {
      var stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          frameRate: 30,
          facingMode: 'user'
        }
      });
      for (var track of stream.getTracks()) {
        if (track.kind === 'audio') {
          audioTrack.current = track;
          pc.current.addTrack(track, stream);
          updateState({ localAudio: true });
        }
        if (track.kind === 'video') {
          track.enabled = false;
        }
      }
    }
    catch (err) {
      console.log(err);
    }
  }

  var connect = async (policy, node, token, clearRing, clearAlive, ice) => {

    // connect signal socket
    connected.current = false;
    candidates.current = [];
    pc.current = null;
    updateState({ remoteVideo: false, remoteAudio: false, remoteStream: null, localVideo: false, localAudio: false, localStream: null });

    videoTrack.current = false;
    audioTrack.current = false;

    var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(node);
    var protocol = insecure ? 'ws' : 'wss';
    ws.current = createWebsocket(`${protocol}://${node}/signal`);
    ws.current.onmessage = async (ev) => {
      // handle messages [impolite]
      try {
        var signal = JSON.parse(ev.data);
        if (signal.status === 'connected') {
          clearRing();
          updateState({ callStatus: "connected" });
          if (policy === 'polite') {
            connected.current = true;
            InCallManager.start({media: 'audio'});
            transmit('polite', ice);
            polite();
          }
        }
        else if (signal.status === 'closed') {
          ws.current.close();
        }
        else if (signal.description) {
          offers.current.push(signal.description);
          if (policy === 'polite') {
            polite();
          }
          if (policy === 'impolite') {
            impolite();
          }
        }
        else if (signal.candidate) {
          if (pc.current.remoteDescription == null) {
            candidates.current.push(signal.candidate);
          }
          else {
            var candidate = new RTCIceCandidate(signal.candidate);
            await pc.current.addIceCandidate(candidate);
          }
        }
      }
      catch (err) {
        console.log(err);
      }
    }
    ws.current.onclose = (e) => {
      // update state to disconnected
      if (pc.current) {
        pc.current.close();
      }
      clearRing();
      clearAlive();
      InCallManager.stop();
      connected.current = false;
      calling.current = null;
      if (videoTrack.current) {
        videoTrack.current.stop();
        videoTrack.current = null;
      }
      if (audioTrack.current) {
        audioTrack.current.stop();
        audioTrack.current = null;
      }
      updateState({ callStatus: null });
    }
    ws.current.onopen = async () => {
      ws.current.send(JSON.stringify({ AppToken: token }));
      if (policy === 'impolite') {
        connected.current = true;
        InCallManager.start({media: 'audio'});
        transmit('impolite', ice);
        impolite();
      }
    }
    ws.current.error = (e) => {
      console.log(e)
      ws.current.close();
    }
  }

  var actions = {
    setSession: (token) => {

      if (access.current) {
        throw new Error("invalid ring state");
      }
      access.current = token;
      ringing.current = new Map();
      calling.current = null;
      updateState({ callStatus: null, ringing: ringing.current });
    },
    clearSession: () => {
      access.current = null;
    },
    ring: (cardId, callId, calleeToken, ice) => {
      var key = `${cardId}:${callId}`
      var call = ringing.current.get(key) || { cardId, calleeToken, callId, ice }
      call.expires = Date.now() + EXPIRE;
      ringing.current.set(key, call);
      updateState({ ringing: ringing.current });
      setTimeout(() => {
        updateState({ ringing: ringing.current });
      }, EXPIRE);
    },
    ignore: async (cardId, callId) => {
      var key = `${cardId}:${callId}`
      var call = ringing.current.get(key);
      if (call) {
        call.status = 'ignored'
        ringing.current.set(key, call);
        updateState({ ringing: ringing.current });
      }
    },
    decline: async (cardId, contactNode, contactToken, callId) => {
      var key = `${cardId}:${callId}`
      var call = ringing.current.get(key);
      if (call) {
        call.status = 'declined'
        ringing.current.set(key, call);
        updateState({ ringing: ringing.current });
        try {
          await removeContactCall(contactNode, contactToken, callId);
        }
        catch (err) {
          console.log(err);
        }
      }
    },
    accept: async (cardId, callId, contactNode, contactToken, calleeToken, ice) => {
      if (calling.current) {
        throw new Error("active session");
      }

      var key = `${cardId}:${callId}`
      var call = ringing.current.get(key);
      if (call) {
        call.status = 'accepted'
        ringing.current.set(key, call);
        updateState({ ringing: ringing.current, callStatus: "connecting", cardId });

        calling.current = { callId, contactNode, contactToken, host: false };
        await connect('impolite', contactNode, calleeToken, () => {}, () => {}, ice);
      }
    },
    end: async () => {
      if (calling.current?.callId) {
        try {
          var { host, callId, contactNode, contactToken } = calling.current;
          if (host) {
            var { server, token } = access.current;
            await removeCall(server, token, callId);
          }
          else {
            await removeContactCall(contactNode, contactToken, callId);
          }
        }
        catch (err) {
          console.log(err);
        }
        if (ws.current) {
          ws.current.close();
        }
      }
    },
    call: async (cardId, contactNode, contactToken) => {
      if (calling.current) {
        throw new Error("active session");
      }

      calling.current = { };
      updateState({ callStatus: "dialing", cardId });

      // create call
      var { server, token } = access.current;
      let call;
      try {
        call = await addCall(server, token, cardId);
      }
      catch (err) {
        calling.current = null;
        updateState({ callStatus: null });
        throw err;
      }

      var { id, keepAlive, callerToken, calleeToken, ice, iceUrl, iceUsername, icePassword } = call;
      try {
        await addContactRing(contactNode, contactToken, { index, callId: id, calleeToken, ice, iceUrl, iceUsername, icePassword });
      }
      catch (err) {
        console.log(err);
      }
      var aliveInterval = setInterval(async () => {
        try {
          await keepCall(server, token, id);
        }
        catch (err) {
          console.log(err);
        }
      }, keepAlive * 1000);
      let index = 0;
      var ringInterval = setInterval(async () => {
        try {
          if (index > RING_COUNT) {
            if (ws.current) {
              ws.current.close();
            } 
          }
          else {
            await addContactRing(contactNode, contactToken, { index, callId: id, calleeToken, ice, iceUrl, iceUsername, icePassword });
            index += 1;
          }
        }
        catch (err) {
          console.log(err);
        }
      }, RING);

      updateState({ callStatus: "ringing" });
      calling.current = { callId: id, host: true };
      var iceLegacy = [{ urls: iceUrl, username: iceUsername, credential: icePassword }];
      await connect('polite', server, callerToken, () => clearInterval(ringInterval), () => clearInterval(aliveInterval), ice ? ice : iceLegacy);
    },
    enableVideo: async () => {
      if (!videoTrack.current) {
        try {
          var stream = await mediaDevices.getUserMedia({
            audio: true,
            video: {
              frameRate: 30,
              facingMode: 'user'
            }
          });
          for (var track of stream.getTracks()) {
            if (track.kind === 'audio') {
              if (audioTrack.current) {
                audioTrack.current.stop();
              }
              audioTrack.current = track;
              pc.current.addTrack(track, stream);
              updateState({ localAudio: true });
            }
            if (track.kind === 'video') {
              if (videoTrack.current) {
                videoTrack.current.stop();
              }
              videoTrack.current = track;
              pc.current.addTrack(track, stream);
              InCallManager.setForceSpeakerphoneOn(true);
              var localStream = new MediaStream();
              localStream.addTrack(track, localStream);
              updateState({ localVideo: true, localStream });
            }
          }
        }
        catch (err) {
          console.log(err);
        }
      }
      else {
        videoTrack.current.enabled = true;
        updateState({ localVideo: true });
      }
    },
    disableVideo: async () => {
      if (videoTrack.current) {
        videoTrack.current.enabled = false;
        updateState({ localVideo: false });
      }
    },
    enableAudio: async () => {
      if (audioTrack.current) {
        audioTrack.current.enabled = true;
        updateState({ localAudio: true });
      }
    },
    disableAudio: async () => {
      if (audioTrack.current) {
        audioTrack.current.enabled = false;
        updateState({ localAudio: false });
      }
    },
  }

  return { state, actions }
}

