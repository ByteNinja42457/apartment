import { useRef, useState, useEffect, useContext } from 'react';
import { CardContext } from 'context/CardContext';
import { RingContext } from 'context/RingContext';

export function useCall() {
  var [state, setState] = useState({
    callLogo: null,
    localStream: null,
    localVideo: false,
    localAudio: false,
    remoteStream: null,
    remoteVideo: false,
    remoteAudio: false,
  });

  var ring = useContext(RingContext);
  var card = useContext(CardContext);

  useEffect(() => {
    let callLogo = null;
    var contact = card.state.cards.get(ring.state.cardId);
    if (contact) {
      var { imageSet } = contact.card?.profile || {};
      callLogo = imageSet ? card.actions.getCardImageUrl(ring.state.cardId) : null;
    }

    var { localStream, localVideo, localAudio, remoteStream, remoteVideo, remoteAudio } = ring.state;
    updateState({ callLogo, localStream, localVideo, localAudio, remoteStream, remoteVideo, remoteAudio });
  }, [ring.state]);

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  var actions = {
    end: async () => {
      await ring.actions.end();
    },
    enableVideo: async () => {
      await ring.actions.enableVideo();
    },
    disableVideo: async () => {
      await ring.actions.disableVideo();
    },
    enableAudio: async () => {
      await ring.actions.enableAudio();
    },
    disableAudio: async () => {
      await ring.actions.disableAudio();
    },
  };

  return { state, actions };
}

