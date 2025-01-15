import { useState, useRef, useContext } from 'react';
import { getContactChannels } from 'api/getContactChannels';
import { getContactChannelDetail } from 'api/getContactChannelDetail';
import { getContactChannelSummary } from 'api/getContactChannelSummary';
import { getContactProfile } from 'api/getContactProfile';
import { setCardProfile } from 'api/setCardProfile';
import { getCards } from 'api/getCards';
import { getCardImageUrl } from 'api/getCardImageUrl';
import { getCardProfile } from 'api/getCardProfile';
import { getCardDetail } from 'api/getCardDetail';
import { removeContactChannel } from 'api/removeContactChannel';
import { removeContactChannelTopic } from 'api/removeContactChannelTopic';
import { setContactChannelTopicSubject } from 'api/setContactChannelTopicSubject';
import { addContactChannelTopic } from 'api/addContactChannelTopic';
import { setCardConnecting, setCardConnected, setCardConfirmed } from 'api/setCardStatus';
import { getCardOpenMessage } from 'api/getCardOpenMessage';
import { setCardOpenMessage } from 'api/setCardOpenMessage';
import { getCardCloseMessage } from 'api/getCardCloseMessage';
import { setCardCloseMessage } from 'api/setCardCloseMessage';
import { getContactChannelTopics } from 'api/getContactChannelTopics';
import { getContactChannelTopic } from 'api/getContactChannelTopic';
import { getContactChannelTopicAssetUrl } from 'api/getContactChannelTopicAssetUrl';
import { addCard } from 'api/addCard';
import { removeCard } from 'api/removeCard';
import { UploadContext } from 'context/UploadContext';

export function useCardContext() {
  var [state, setState] = useState({
    offsync: false,
    cards: new Map(),
  });
  var upload = useContext(UploadContext);
  var access = useRef(null);
  var syncing = useRef(false);
  var setRevision = useRef(null);
  var curRevision = useRef(null);
  var cards = useRef(new Map());
  var force = useRef(false);

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }))
  }

  var resync = async () => {
    try {
      force.current = true;
      await sync();
    }
    catch (err) {
      console.log(err);
    }
  };

  var resyncCard = async (cardId) => {
    let success = true;
    if (!syncing.current) {
      syncing.current = true;

      try {
        var token = access.current;
        var card = cards.current.get(cardId);

        if (card.data.cardDetail.status === 'connected') {
          await syncCard(token, card);
        }
        card.offsync = false;
        cards.current.set(cardId, card);
        updateState({ cards: cards.current });
      }
      catch(err) {
        console.log(err);
        success = false;
      }
      syncing.current = false;
      await sync();
    }
    return success;
  }

  var sync = async () => {
    if (!syncing.current && (setRevision.current !== curRevision.current || force.current)) {
      syncing.current = true;
      force.current = false;

      try {
        var token = access.current;
        var revision = curRevision.current;
        var delta = await getCards(token, setRevision.current);
        for (let card of delta) {
          if (card.data) {
            let cur = cards.current.get(card.id);
            if (cur == null) {
              cur = { id: card.id, data: { articles: new Map() }, offsync: false, channels: new Map() }
            }
            if (cur.revision !== card.revision) {
              if (cur.data.detailRevision !== card.data.detailRevision) {
                if (card.data.cardDetail != null) {
                  cur.data.cardDetail = card.data.cardDetail;
                }
                else {
                  cur.data.cardDetail = await getCardDetail(access.current, card.id);
                }
                cur.data.detailRevision = card.data.detailRevision;
              }
              if (cur.data.profileRevision !== card.data.profileRevision) {
                if (card.data.cardProfile != null) {
                  cur.data.cardProfile = card.data.cardProfile;
                }
                else {
                  cur.data.cardProfile = await getCardProfile(access.current, card.id);
                }
                cur.data.profileRevision = card.data.profileRevision;
              }

              if (cur.data.cardDetail.status === 'connected' && !cur.offsync) {
                cur.data.curNotifiedView = card.data.notifiedView;
                cur.data.curNotifiedProfile = card.data.notifiedProfile;
                cur.data.curNotifiedArticle = card.data.notifiedArticle;
                cur.data.curNotifiedChannel = card.data.notifiedChannel;
                try {
                  await syncCard(token, cur);
                }
                catch (err) {
                  console.log(err);
                  cur.offsync = true;
                }
              }
              cur.revision = card.revision;
              cards.current.set(card.id, cur);
            }
          }
          else {
            cards.current.delete(card.id);
          }
        }

        setRevision.current = revision;
        updateState({ offsync: false, cards: cards.current });
      }
      catch (err) {
        console.log(err);
        syncing.current = false;
        updateState({ offsync: true });
        return;
      }

      syncing.current = false;
      await sync();
    }
  };
 
  var syncCard = async (token, card) => {
    var { cardProfile, cardDetail } = card.data;
    // sync profile
    if (card.data.setNotifiedProfile !== card.data.curNotifiedProfile) {
      if (card.data.profileRevision !== card.data.curNotifiedProfile) {
        var cardToken = `${cardProfile.guid}.${cardDetail.token}`;
        var message = await getContactProfile(cardProfile.node, cardToken);
        await setCardProfile(token, card.id, message);
      }
    }
    card.data.setNotifiedProfile = card.data.curNotifiedProfile;

    // sync channels & articles
    if (card.data.setNotifiedArticle !== card.data.curNotifiedArticle || card.data.setNotifiedView !== card.data.curNotifiedView) {
      await syncCardArticles(card);
    }
    if (card.data.setNotifiedChannel !== card.data.curNotifiedChannel || card.data.setNotifiedView !== card.data.curNotifiedView) {
      await syncCardChannels(card);
    }
    card.data.setNotifiedArticle = card.data.curNotifiedArticle;
    card.data.setNotifiedChannel = card.data.curNotifiedChannel;
    card.data.setNotifiedView = card.data.curNotifiedView;
    card.offsync = false;
  }

  var syncCardArticles = async (card) => {}

  var syncCardChannels = async (card) => {
    var { cardProfile, cardDetail, setNotifiedView, setNotifiedChannel } = card.data;
    var node = cardProfile.node;
    var token = `${cardProfile.guid}.${cardDetail.token}`;
    let delta;
    if (card.data.setNotifiedView !== card.data.curNotifiedView) {
      card.channels = new Map();
      delta = await getContactChannels(node, token);
    }
    else {
      delta = await getContactChannels(node, token, setNotifiedView, setNotifiedChannel);
    }

    for (let channel of delta) {
      if (channel.data) {
        let cur = card.channels.get(channel.id);
        if (cur == null) {
          cur = { id: channel.id, data: {} };
        }
        if (cur.data.detailRevision !== channel.data.detailRevision) {
          if (channel.data.channelDetail != null) {
            cur.data.channelDetail = channel.data.channelDetail;
          }
          else { 
            cur.data.channelDetail = await getContactChannelDetail(node, token, channel.id);
          }
          cur.data.detailRevision = channel.data.detailRevision;
        }
        if (cur.data.topicRevision !== channel.data.topicRevision) {
          if (channel.data.channelSummary != null) {
            cur.data.channelSummary = channel.data.channelSummary;
          }
          else {
            cur.data.channelSummary = await getContactChannelSummary(node, token, channel.id);
          }
          cur.data.topicRevision = channel.data.topicRevision;
        }
        cur.revision = channel.revision;
        card.channels.set(channel.id, cur);
      }
      else {  
        card.channels.delete(channel.id);
      }
    }
  }

  var actions = {
    setToken: (token) => {
      if (access.current || syncing.current) {
        throw new Error("invalid card session state");
      }
      access.current = token;
      cards.current = new Map();
      curRevision.current = null;
      setRevision.current = null;
      setState({ offsync: false, cards: new Map() });
    },
    clearToken: () => {
      access.current = null;
    },
    setRevision: async (rev) => {
      curRevision.current = rev;
      await sync();
    },
    addCard: async (message) => {
      return await addCard(access.current, message);
    },
    removeCard: async (cardId) => {
      return await removeCard(access.current, cardId);
    },
    setCardConnecting: async (cardId) => {
      return await setCardConnecting(access.current, cardId);
    },
    setCardConnected: async (cardId, token, rev) => {
      return await setCardConnected(access.current, cardId, token,
          rev.viewRevision, rev.articleRevision, rev.channelRevision, rev.profileRevision);
    },
    setCardConfirmed: async (cardId) => {
      return await setCardConfirmed(access.current, cardId);
    },
    getCardOpenMessage: async (cardId) => {
      return await getCardOpenMessage(access.current, cardId);
    },
    setCardOpenMessage: async (server, message) => {
      return await setCardOpenMessage(server, message);
    },
    getCardCloseMessage: async (cardId) => {
      return await getCardCloseMessage(access.current, cardId);
    },
    setCardCloseMessage: async (server, message) => {
      return await setCardCloseMessage(server, message);
    },
    getCardImageUrl: (cardId) => {
      var card = cards.current.get(cardId);
      if (card) {
        var revision = card.data.profileRevision;
        return getCardImageUrl(access.current, cardId, revision)
      }
    },
    removeChannel: async (cardId, channelId) => {
      let { cardProfile, cardDetail } = cards.current.get(cardId).data;
      let token = cardProfile.guid + '.' + cardDetail.token;
      let node = cardProfile.node;
      await removeContactChannel(node, token, channelId);
    },
    addTopic: async (cardId, channelId, type, message, files) => {
      let { cardProfile, cardDetail } = cards.current.get(cardId).data;
      let token = cardProfile.guid + '.' + cardDetail.token;
      let node = cardProfile.node;
      if (files?.length) {
        var topicId = await addContactChannelTopic(node, token, channelId, null, null, null);
        var contact = { server: node, cardId };
        upload.actions.addTopic(token, channelId, topicId, files, async (assets) => {
          var subject = message(assets);
          await setContactChannelTopicSubject(node, token, channelId, topicId, type, subject);
        }, async () => {
          try {
            await removeContactChannelTopic(node, token, channelId, topicId);
          }
          catch(err) {
            console.log(err);
          }
        }, contact);
      }
      else {
        var subject = message([]);
        await addContactChannelTopic(node, token, channelId, type, subject, files);
      }
      //resyncCard(cardId);
    },
    removeTopic: async (cardId, channelId, topicId) => {
      var card = cards.current.get(cardId);
      if (!card) {
        throw new Error('card not found');
      }
      var { cardProfile, cardDetail } = card.data;
      var token = cardProfile.guid + '.' + cardDetail.token;
      var node = cardProfile.node;
      await removeContactChannelTopic(node, token, channelId, topicId);
      resyncCard(cardId);
    },
    setTopicSubject: async (cardId, channelId, topicId, type, subject) => {
      var card = cards.current.get(cardId);
      if (!card) {
        throw new Error('card not found');
      }
      var { cardProfile, cardDetail } = card.data;
      var token = cardProfile.guid + '.' + cardDetail.token;
      var node = cardProfile.node;
      await setContactChannelTopicSubject(node, token, channelId, topicId, type, subject);
      resyncCard(cardId);
    },
    getTopicAssetUrl: (cardId, channelId, topicId, assetId) => {
      var card = cards.current.get(cardId);
      if (!card) {
        throw new Error('card not found');
      }
      var { cardProfile, cardDetail } = card.data;
      var token = cardProfile.guid + '.' + cardDetail.token;
      var node = cardProfile.node;
      return getContactChannelTopicAssetUrl(node, token, channelId, topicId, assetId);
    },
    getTopics: async (cardId, channelId, revision, count, begin, end) => {
      var card = cards.current.get(cardId);
      if (!card) {
        throw new Error('card not found');
      }
      var { cardProfile, cardDetail } = card.data;
      var token = cardProfile.guid + '.' + cardDetail.token;
      var node = cardProfile.node;
      return await getContactChannelTopics(node, token, channelId, revision, count, begin, end);
    },
    getTopic: async (cardId, channelId, topicId) => {
      var card = cards.current.get(cardId);
      if (!card) {
        throw new Error('card not found');
      }
      var { cardProfile, cardDetail } = card.data;
      var token = cardProfile.guid + '.' + cardDetail.token;
      var node = cardProfile.node;
      return await getContactChannelTopic(node, token, channelId, topicId);
    },
    resync: async () => {
      await resync();
    },
    resyncCard: async (cardId) => {
      return await resyncCard(cardId);
    },
  }

  return { state, actions }
}


