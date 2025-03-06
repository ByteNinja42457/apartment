import { useEffect, useState, useRef, useContext } from 'react';
import { CardContext } from 'context/CardContext';
import { ChannelContext } from 'context/ChannelContext';

export function useConversationContext() {
  var COUNT = 32;

  var [state, setState] = useState({
    offsync: false,
    topics: new Map(),
    card: null,
    channel: null,
    topicRevision: null,
  });

  var card = useContext(CardContext);
  var channel = useContext(ChannelContext);

  var reset = useRef(false);
  var loadMore = useRef(false);
  var force = useRef(false);
  var syncing = useRef(false);
  var marker = useRef(null);
  var setTopicRevision = useRef(null);
  var curTopicRevision = useRef(null);
  var setDetailRevision = useRef(null);
  var curDetailRevision = useRef(null);
  var conversationId = useRef(null);
  var topics = useRef(new Map());

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }))
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

  var removeChannel = async (cardId, channelId) => {
    if (cardId) {
      await card.actions.removeChannel(cardId, channelId);
      await card.actions.resync();      
    }
    else {
      await channel.actions.removeChannel(channelId);
      await channel.actions.resync();
    }
  };

  var setChannelSubject = async (cardId, channelId, type, subject) => {
    if (cardId) {
      console.log('cannot update channel subject');
    }
    else {
      await channel.actions.setChannelSubject(channelId, type, subject);
    }
  }

  var setChannelCard = async (cardId, channelId, id) => {
    if (cardId) {
      console.log('cannot update channel card');
    }
    else {
      await channel.actions.setChannelCard(channelId, id);
      await channel.actions.resync();
    }
  }

  var clearChannelCard = async (cardId, channelId, id) => {
    if (cardId) {
      console.log('cannot update channel card');
    }
    else {
      await channel.actions.clearChannelCard(channelId, id);
      await channel.actions.resync();
    }
  };

  var addTopic = async (cardId, channelId, type, message, files) => {
    if (cardId) {
      await card.actions.addTopic(cardId, channelId, type, message, files);
    }
    else {
      await channel.actions.addTopic(channelId, type, message, files);
    }
    resync();
  };

  var removeTopic = async (cardId, channelId, topicId) => {
    if (cardId) {
      await card.actions.removeTopic(cardId, channelId, topicId);
    }
    else {
      await channel.actions.removeTopic(channelId, topicId);
    }
    await resync();
  };

  var setTopicSubject = async (cardId, channelId, topicId, type, subject) => {
    if (cardId) {
      await card.actions.setTopicSubject(cardId, channelId, topicId, type, subject);
    }
    else {
      await channel.actions.setTopicSubject(channelId, topicId, type, subject);
    }
    await resync();
  };

  var getTopicAssetUrl = (cardId, channelId, topicId, assetId) => {
    if (cardId) {
      return card.actions.getTopicAssetUrl(cardId, channelId, topicId, assetId);
    }
    else {
      return channel.actions.getTopicAssetUrl(channelId, topicId, assetId);
    }
  };

  var setChannelRevision = (cardId, channelId) => {
    let setChannel;
    if (cardId) {
      var setCard = card.state.cards.get(cardId);
      setChannel = setCard?.channels.get(channelId);
    }
    else {
      setChannel = channel.state.channels.get(channelId);
    }
    if (setChannel) {
      var { topicRevision, detailRevision } = setChannel.data;
      if (curTopicRevision.current !== topicRevision || curDetailRevision.current !== detailRevision) {
        curTopicRevision.current = topicRevision;
        curDetailRevision.current = detailRevision;
      }
    }
    else {
      console.log('conversation not found');
    }
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

  var sync = async () => {
    if (!syncing.current && (reset.current || force.current || loadMore.current || 
        setDetailRevision.current !== curDetailRevision.current || setTopicRevision.current !== curTopicRevision.current)) {

      var more = loadMore.current;
      var update = force.current;
      var topicRevision = more ? setTopicRevision.current : curTopicRevision.current;
      var detailRevision = curDetailRevision.current;

      syncing.current = true;
      force.current = false;
      loadMore.current = false;

      if (reset.current) {
        reset.current = false;
        marker.current = null;
        setTopicRevision.current = null;
        setDetailRevision.current = null;
        topics.current = new Map();
        updateState({ offsync: false, channel: null, topics: new Map() }); 
      }

      if (conversationId.current) {
        var { cardId, channelId } = conversationId.current;

        // sync channel details
        if (setDetailRevision.current !== detailRevision) {
          let channelSync;
          let cardSync;
          if (cardId) {
            cardSync = card.state.cards.get(cardId);
            channelSync = cardSync?.channels.get(channelId);
          }
          else {
            channelSync = channel.state.channels.get(channelId);
          }
          if (channelSync) {
            setDetailRevision.current = detailRevision;
            updateState({ card: cardSync, channel: channelSync });
          }
          else {
            syncing.current = false;
            console.log("converstaion not found");
            return;
          }
        }

        try {
          // sync channel topics
          if (update || more || setTopicRevision.current !== topicRevision) {
            let delta;
            if (!marker.current) {
              delta = await getTopicDelta(cardId, channelId, null, COUNT, null, null);
            }
            else if (more) {
              delta = await getTopicDelta(cardId, channelId, null, COUNT, null, marker.current);
            }
            else {
              delta = await getTopicDelta(cardId, channelId, setTopicRevision.current, null, marker.current, null);
            }

            for (let topic of delta?.topics) {
              if (topic.data == null) {
                topics.current.delete(topic.id);
              }
              else {
                let cur = topics.current.get(topic.id);
                if (cur == null) {
                  cur = { id: topic.id, data: {} };
                }
                if (topic.data.detailRevision !== cur.data.detailRevision) {
                  if(topic.data.topicDetail) {
                    cur.data.topicDetail = topic.data.topicDetail;
                    cur.data.detailRevision = topic.data.detailRevision;
                  }
                  else {
                    var slot = await getTopic(cardId, channelId, topic.id);
                    cur.data.topicDetail = slot.data.topicDetail;
                    cur.data.detailRevision = slot.data.detailRevision;
                  }
                }
                cur.revision = topic.revision;
                topics.current.set(topic.id, cur);
              }
            }

            marker.current = delta.marker ? delta.marker : marker.current;
            setTopicRevision.current = topicRevision;

            updateState({ offsync: false, topicRevision: topicRevision, topics: topics.current });
          }
        }
        catch (err) {
          console.log(err);
          updateState({ offsync: true });
          syncing.current = false;
          return;
        }

        syncing.current = false;
        await sync();
      }
    }
  };

  useEffect(() => {
    if (conversationId.current) {
      var { cardId, channelId } = conversationId.current;
      setChannelRevision(cardId, channelId);
      sync();
    }
    // eslint-disable-next-line
  }, [card.state, channel.state]);

  var actions = {
    setChannel: async (cardId, channelId) => {
      conversationId.current = { cardId, channelId };
      setChannelRevision(cardId, channelId);
      reset.current = true;
      await sync();
    },
    clearChannel: async () => {
      conversationId.current = null;
      curDetailRevision.current = null;
      curTopicRevision.current = null;
      reset.current = true;
      await sync();
    },
    removeChannel: async () => {
      var { cardId, channelId } = conversationId.current;
      await removeChannel(cardId, channelId);
    },
    setChannelSubject: async (type, subject) => {
      var { cardId, channelId } = conversationId.current;
      await setChannelSubject(cardId, channelId, type, subject);
    },
    setChannelCard: async (id) => {
      var { cardId, channelId } = conversationId.current;
      await setChannelCard(cardId, channelId, id);
    },
    clearChannelCard: async (id) => {
      var { cardId, channelId } = conversationId.current;
      await clearChannelCard(cardId, channelId, id);
    },
    addTopic: async (type, message, files) => {
      var { cardId, channelId } = conversationId.current;
      await addTopic(cardId, channelId, type, message, files);
    },
    removeTopic: async (topicId) => {
      var { cardId, channelId } = conversationId.current;
      await removeTopic(cardId, channelId, topicId);
    },
    setTopicSubject: async (topicId, type, subject) => {
      var { cardId, channelId } = conversationId.current;
      await setTopicSubject(cardId, channelId, topicId, type, subject);
    },
    getTopicAssetUrl: (assetId, topicId) => {
      var { cardId, channelId } = conversationId.current;
      return getTopicAssetUrl(cardId, channelId, topicId, assetId);
    },
    loadMore: async () => {
      loadMore.current = true;
      await sync();
    },
    resync: async () => {
      force.current = true;
      await sync();
    },
  }

  return { state, actions }
}


