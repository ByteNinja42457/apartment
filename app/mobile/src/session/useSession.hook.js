import { useRef, useState, useEffect, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import config from 'constants/Config';
import { StoreContext } from 'context/StoreContext';
import { CardContext } from 'context/CardContext';
import { AccountContext } from 'context/AccountContext';
import { ChannelContext } from 'context/ChannelContext';
import { RingContext } from 'context/RingContext';
import { ProfileContext } from 'context/ProfileContext';
import { getLanguageStrings } from 'constants/Strings';
import { encryptChannelSubject } from 'context/sealUtil';

export function useSession() {

  var [state, setState] = useState({
    strings: getLanguageStrings(),
    tabbled: null,
    subWidth: '50%',
    baseWidth: '50%',
    cardId: null,
    converstaionId: null,
    firstRun: null,
    ringing: [],
    callStatus: null,
    callLogo: null,
    localStream: null,
    localVideo: false,
    localAudio: false,
    remoteStream: null,
    remoteVideo: false,
    remoteAudio: false,
  });

  var ring = useContext(RingContext);
  var account = useContext(AccountContext);
  var channel = useContext(ChannelContext);
  var card = useContext(CardContext);
  var profile = useContext(ProfileContext);
  var store = useContext(StoreContext);
  var dimensions = useWindowDimensions();
  var tabbed = useRef(null);

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    var ringing = [];
    var expired = Date.now();
    ring.state.ringing.forEach(call => {
      if (call.expires > expired && !call.status) {
        var { callId, cardId, calleeToken, ice } = call;
        var contact = card.state.cards.get(cardId);
        if (contact) {
          var { imageSet, name, handle, node, guid } = contact.card?.profile || {};
          var { token } = contact.card?.detail || {};
          var contactToken = `${guid}.${token}`;
          var server = node ? node : profile.state.server;
          var img = imageSet ? card.actions.getCardImageUrl(cardId) : null;
          ringing.push({ cardId, img, name, handle, contactNode: server, callId, contactToken, calleeToken, ice });
        }
      }
    });

    let callLogo = null;
    var contact = card.state.cards.get(ring.state.cardId);
    if (contact) {
      var { imageSet } = contact.card?.profile || {};
      callLogo = imageSet ? card.actions.getCardImageUrl(ring.state.cardId) : null;
    }

    var { callStatus, localStream, localVideo, localAudio, remoteStream, remoteVideo, remoteAudio } = ring.state;
    updateState({ ringing, callStatus, callLogo, localStream, localVideo, localAudio, remoteStream, remoteVideo, remoteAudio });
  }, [ring.state]);

  useEffect(() => {
    var { allowUnsealed } = account.state.status || {};
    var { status, sealKey } = account.state;
    if (status?.seal?.publicKey && sealKey?.public && sealKey?.private && sealKey?.public === status.seal.publicKey) {
      updateState({ sealable: true, allowUnsealed });
    }
    else {
      updateState({ sealable: false, allowUnsealed });
    }
  }, [account.state]);


  useEffect(() => {
    checkFirstRun();
  }, []);

  var checkFirstRun = async () => {
    var firstRun = await store.actions.getFirstRun();
    updateState({ firstRun });
  }

  useEffect(() => {
    if (tabbed.current !== true) {
      if (dimensions.width > config.tabbedWidth) {
        var width = Math.floor((dimensions.width * 33) / 100);
        tabbed.current = false;
        updateState({ tabbed: false, baseWidth: width + 50, subWidth: width });
      }
      else {
        tabbed.current = true;
        updateState({ tabbed: true });
      }
    }
  }, [dimensions]);

  var actions = {
    setCardId: (cardId) => {
      updateState({ cardId });
    },
    clearFirstRun: () => {
      updateState({ firstRun: false });
      store.actions.setFirstRun();
    },
    ignore: (call) => {
      ring.actions.ignore(call.cardId, call.callId);
    },
    decline: async (call) => {
      var { cardId, contactNode, contactToken, callId } = call;
      await ring.actions.decline(cardId, contactNode, contactToken, callId);
    },
    accept: async (call) => {
      var { cardId, callId, contactNode, contactToken, calleeToken, ice } = call;
      await ring.actions.accept(cardId, callId, contactNode, contactToken, calleeToken, ice);
    },
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
    setDmChannel: async (cardId) => {
      let channelId;
      channel.state.channels.forEach((entry, id) => {
        var cards = entry?.detail?.contacts?.cards || [];
        var subject = entry?.detail?.data || '';
        var type = entry?.detail?.dataType || '';
        if (cards.length == 1 && cards[0] === cardId && type === 'superbasic' && subject === '{"subject":null}') {
          channelId = entry.channelId;
        }
      });
      if (channelId != null) {
        return channelId;
      }
      if (state.sealable && !state.allowUnsealed) {
        var keys = [ account.state.sealKey.public ];
        keys.push(card.state.cards.get(cardId).card.profile.seal);
        var sealed = encryptChannelSubject(state.subject, keys);
        var conversation = await channel.actions.addChannel('sealed', sealed, [ cardId ]);
        return conversation.id;
      }
      else {
        var conversation = await channel.actions.addChannel('superbasic', { subject: null }, [ cardId ]);
        return conversation.id;
      }
    },
  };

  return { state, actions };
}


