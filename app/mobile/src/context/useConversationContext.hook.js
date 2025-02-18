import { useState, useEffect, useRef, useContext } from 'react';
import { StoreContext } from 'context/StoreContext';
import { UploadContext } from 'context/UploadContext';
import { CardContext } from 'context/CardContext';
import { ChannelContext } from 'context/ChannelContext';
import { ProfileContext } from 'context/ProfileContext';
import CryptoJS from 'crypto-js';

export function useConversationContext() {
  var COUNT = 32;

  var [state, setState] = useState({
    loaded: false,
    offsync: false,
    topics: new Map(),
    card: null,
    channel: null,
  });
  var card = useContext(CardContext);
  var channel = useContext(ChannelContext);

  var reset = useRef(false);
  var more = useRef(false);
  var force = useRef(false);
  var syncing = useRef(false);
  var update = useRef(false);
  var loaded = useRef(false);
  var stored = useRef([]);
  var conversationId = useRef(null);
  var topics = useRef(new Map());

  var curSyncRevision = useRef();
  var curTopicMarker = useRef();

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }))
  }

  var sync = async () => {

    if (!syncing.current && (reset.current || update.current || force.current || more.current)) {

      var loadMore = more.current;
      var ignoreRevision = force.current;
      var conversation = conversationId.current;

      syncing.current = true;
      update.current = false;
      force.current = false;
      more.current = false;

      if (reset.current) {
        reset.current = false;
        loaded.current = false;
        topics.current = new Map();
        updateState({ loaded: false, offsync: false, topics: topics.current, card: null, channel: null });
      }

      if (conversation) {
        var { cardId, channelId } = conversation;
        var cardValue = cardId ? card.state.cards.get(cardId) : null;
        var channelValue = cardId ? cardValue?.channels.get(channelId) : channel.state.channels.get(channelId);
        var { topicRevision } = channelValue || {};

        if (channelValue) {
          if (!loaded.current) {

            stored.current = await getTopicItemsId(cardId, channelId);
            stored.current.sort((a,b) => {
              if (a.created > b.created) {
                return -1;
              }
              if (a.created < b.created) {
                return 1;
              }
              return 0;
            });

            var ids = [];
            for (let i = 0; i < COUNT; i++) {
              if (stored.current.length > 0) {
                ids.push(stored.current.shift().topicId);
              }
            }

            var topicItems = await getTopicItemsById(cardId, channelId, ids);
            for (let topic of topicItems) {
              topics.current.set(topic.topicId, topic);
            }

            var { syncRevision, topicMarker } = channelValue;
            curSyncRevision.current = syncRevision;
            curTopicMarker.current = topicMarker;
            loaded.current = true;
          }
          else {
            setChannel = true;
          }
        }
        else {
          console.log("failed to load conversation");
          syncing.current = false;
          return;
        }

        try {
          if (!curTopicMarker.current) {
            var delta = await getTopicDelta(cardId, channelId, null, COUNT, null, null);
            await setTopicDelta(cardId, channelId, delta.topics);
            var marker = delta.marker ? delta.marker : 1;
            await setMarkerAndSync(cardId, channelId, marker, delta.revision);
            curTopicMarker.current = marker;
            curSyncRevision.current = delta.revision;
            updateState({ loaded: true, offsync: false, topics: topics.current, card: cardValue, channel: channelValue });
          }
          else if (loadMore) {
            if (stored.current.length > 0) {
              var ids = [];
              for (let i = 0; i < COUNT; i++) {
                if (stored.current.length > 0) {
                  ids.push(stored.current.shift().topicId);
                }
              }
              var topicItems = await getTopicItemsById(cardId, channelId, ids);
              for (let topic of topicItems) {
                topics.current.set(topic.topicId, topic);
              }
              updateState({ loaded: true, topics: topics.current, card: cardValue, channel: channelValue });
            }
            else {
              var delta = await getTopicDelta(cardId, channelId, null, COUNT, null, curTopicMarker.current);
              var marker = delta.marker ? delta.marker : 1;
              await setTopicDelta(cardId, channelId, delta.topics);
              await setTopicMarker(cardId, channelId, marker);
              curTopicMarker.current = marker;
              updateState({ loaded: true, offsync: false, topics: topics.current, card: cardValue, channel: channelValue });
            }
          }
          else if (ignoreRevision || topicRevision > curSyncRevision.current) {
            var delta = await getTopicDelta(cardId, channelId, curSyncRevision.current, null, curTopicMarker.current, null);
            if (topicRevision > delta.revision) {
              throw new Error("invalid topic revision");
            }
            await setTopicDelta(cardId, channelId, delta.topics);
            await setSyncRevision(cardId, channelId, delta.revision);
            curSyncRevision.current = delta.revision;
            updateState({ loaded: true, offsync: false, topics: topics.current, card: cardValue, channel: channelValue });
          }
          else {
            updateState({ loaded: true, offsync: false, topics: topics.current, card: cardValue, channel: channelValue });
          }
        }
        catch(err) {
          console.log(err);
          updateState({ loaded: true, offysnc: true });
          syncing.current = false;
          return
        }
      }

      syncing.current = false;
      await sync();
    }
  }

  var setTopicDelta = async (cardId, channelId, entries) => {

    for (let entry of entries) {
      if (entry.data) {
        if (entry.data.topicDetail) {
          var item = mapTopicEntry(entry);
          await setTopicItem(cardId, channelId, item);
          topics.current.set(item.topicId, item);
        }
        else {
          var topic = await getTopic(cardId, channelId, entry.id);
          var item = mapTopicEntry(topic);
          await setTopicItem(cardId, channelId, item);
          topics.current.set(item.topicId, item);
        }
      }
      else {
        topics.current.delete(entry.id);
        clearTopicItem(cardId, channelId, entry.id);
      }
    }
  }

  useEffect(() => {
    update.current = true;
    sync();
    // eslint-disable-next-line
  }, [card.state, channel.state]);

  var actions = {
    setConversation: async (cardId, channelId) => {
      conversationId.current = { cardId, channelId };
      reset.current = true;
      await sync();
    },
    clearConversation: async () => {
      conversationId.current = null;
      reset.current = true;
      await sync();
    },
    setChannelSubject: async (type, subject) => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        throw new Error("can only set hosted channel subjects");
      }
      else if(channelId) {
        await channel.actions.setChannelSubject(channelId, type, subject);
      }
    },
    removeChannel: async () => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        await card.actions.removeChannel(cardId, channelId); 
      }
      else if (channelId) {
        await channel.actions.removeChannel(channelId);
      }
    },
    getNotifications: async () => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        return await card.actions.getChannelNotifications(cardId, channelId);
      }
      else if (channelId) {
        return await channel.actions.getNotifications(channelId);
      }
    },
    setNotifications: async (notification) => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        await card.actions.setChannelNotifications(cardId, channelId, notification);
      }
      else if (channelId) {
        await channel.actions.setNotifications(channelId, notification);
      }
      updateState({ notification });
    },
    setChannelCard: async (id) => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        throw new Error("can only set members on hosted channel");
      }
      else if (channelId) {
        await channel.actions.setChannelCard(channelId, id);
      }
    },
    clearChannelCard: async (id) => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        throw new Error("can only clear members on hosted channel");
      }
      else if (channelId) {
        await channel.actions.clearChannelCard(channelId, id);
      }
    },
    setChannelReadRevision: async (revision) => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        await card.actions.setChannelReadRevision(cardId, channelId, revision);
      }
      else if (channelId) {
        await channel.actions.setReadRevision(channelId, revision);
      }
    },
    addChannelAlert: async () => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        return await card.actions.addChannelAlert(cardId, channelId);
      }
      else if (channelId) {
        return await channel.actions.addChannelAlert(channelId);
      }
    },
    setChannelFlag: async () => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        await card.actions.setChannelFlag(cardId, channelId);
      }
      else if (channelId) {
        await channel.actions.setChannelFlag(channelId);
      }
    },
    clearChannelFlag: async () => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardid) {
        await card.actions.clearChannelFlag(cardId, channelId);
      }
      else if (channelId) {
        await channel.actions.clearChannelFlag(channelId);
      }
    },
    addTopic: async (type, message, files) => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        await card.actions.addTopic(cardId, channelId, type, message, files);
      }
      else if (channelId) {
        await channel.actions.addTopic(channelId, type, message, files);
      }
      force.current = true;
      await sync();
    },
    removeTopic: async (topicId) => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        await card.actions.removeTopic(cardId, channelId, topicId);
      }
      else {
        await channel.actions.removeTopic(channelId, topicId);
      }
      force.current = true;
      await sync();
    },
    unsealTopic: async (topicId, revision, unsealed) => {
      var { cardId, channelId } = conversationId.current || {}
      if (cardId) {
        await card.actions.setUnsealedTopicSubject(cardId, channelId, topicId, revision, unsealed);
      }
      else if (channelId) {
        await channel.actions.setUnsealedTopicSubject(channelId, topicId, revision, unsealed);
      }
      setTopicField(topicId, 'unsealedDetail', unsealed);
    },
    setTopicSubject: async (topicId, type, subject) => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        await card.actions.setTopicSubject(cardId, channelId, topicId, type, subject);
      }
      else if (channelId) {
        await channel.actions.setTopicSubject(channelId, topicId, type, subject);
      }
      force.current = true;
      await sync();
    },
    addTopicAlert: async (topicId) => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        return await card.actions.addTopicAlert(cardId, channelId, topicId);
      }
      else if (channelId) {
        return await channel.actions.addTopicAlert(channelId, topicId);
      }
    },
    setTopicFlag: async (topicId) => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        card.actions.setTopicFlag(cardId, channelId, topicId);
      }
      else if (channelId) {
        channel.actions.setTopicFlag(channelId, topicId);
      }
      setTopicField(topicId, 'blocked', true);
      updateState({ topics: topics.current });
    },
    clearTopicFlag: async (topicId) => {
      var { cardId, channelId } = conversationId.current || {};
      if (cardId) {
        card.actions.clearTopicFlag(cardId, channelId, topicId);
      }
      else if (channelId) {
        channel.actions.clearTopicFlag(channelId, topicId);
      }
      setTopicField(topicId, 'blocked', false);
      updateState({ topics: topics.current });
    },
    getTopicAssetUrl: (topicId, assetId) => {
      var { cardId, channelId } = conversationId.current || {};
      return getTopicAssetUrl(cardId, channelId, topicId, assetId);
    },
    loadMore: async () => {
      more.current = true;
      await sync();
    },
    resync: () => {
      force.current = true;
      sync();
    },
  }

  var getTopicItemsId = async (cardId, channelId) => {
    if (cardId) {
      return await card.actions.getTopicItemsId(cardId, channelId);
    }
    return await channel.actions.getTopicItemsId(channelId);
  }

  var getTopicItemsById = async (cardId, channelId, topics) => {
    if (cardId) {
      return await card.actions.getTopicItemsById(cardId, channelId, topics);
    }
    return await channel.actions.getTopicItemsById(channelId, topics);
  }

  var getTopicItems = async (cardId, channelId) => {
    if (cardId) {
      return await card.actions.getTopicItems(cardId, channelId);
    }
    return await channel.actions.getTopicItems(channelId);
  }

  var setTopicItem = async (cardId, channelId, topic) => {
    if (cardId) {
      return await card.actions.setTopicItem(cardId, channelId, topic);
    }
    return await channel.actions.setTopicItem(channelId, topic);
  }

  var clearTopicItem = async (cardId, channelId, topicId) => {
    if (cardId) {
      return await card.actions.clearTopicItem(cardId, channelId, topicId);
    }
    return await channel.actions.clearTopicItem(channelId, topicId);
  }

  var setTopicMarker = async (cardId, channelId, marker) => {
    if (cardId) {
      return await card.actions.setChannelTopicMarker(cardId, channelId, marker);
    }
    return await channel.actions.setTopicMarker(channelId, marker);
  }

  var setSyncRevision = async (cardId, channelId, revision) => {
    if (cardId) {
      return await card.actions.setChannelSyncRevision(cardId, channelId, revision);
    }
    return await channel.actions.setSyncRevision(channelId, revision);
  }

  var setMarkerAndSync = async (cardId, channelId, marker, revision) => {
    if (cardId) {
      return await card.actions.setChannelMarkerAndSync(cardId, channelId, marker, revision);
    }
    return await channel.actions.setMarkerAndSync(channelId, marker, revision);
  }

  var getTopicDelta = async (cardId, channelId, revision, count, begin, end) => {
    if (cardId) {
      return await card.actions.getTopics(cardId, channelId, revision, count, begin, end);
    }
    return await channel.actions.getTopics(channelId, revision, count, begin, end);
  }

  var getTopic = async (cardId, channelId, topicId) => {
    if (cardId) {
      return await card.actions.getTopic(cardId, channelId, topicId);
    }
    return await channel.actions.getTopic(channelId, topicId);
  }

  var getTopicAssetUrl = (cardId, channelId, topicId, assetId) => {
    if (cardId) {
      return card.actions.getTopicAssetUrl(cardId, channelId, topicId, assetId);
    }
    return channel.actions.getTopicAssetUrl(channelId, topicId, assetId);
  }

  var mapTopicEntry = (entry) => {
    return {
      topicId: entry.id,
      revision: entry.revision,
      detailRevision: entry.data?.detailRevision,
      detail: entry.data?.topicDetail,
    };
  };

  var setTopicField = (topicId, field, value) => {
    var topic = topics.current.get(topicId);
    if (topic) {
      topic[field] = value;
    }
    topics.current.set(topicId, { ...topic });
  };

  return { state, actions }
}

