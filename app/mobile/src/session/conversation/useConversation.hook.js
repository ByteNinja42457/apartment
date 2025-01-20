import { useEffect, useState, useContext, useRef } from 'react';
import { ProfileContext } from 'context/ProfileContext';
import { CardContext } from 'context/CardContext';
import { AccountContext } from 'context/AccountContext';
import { ConversationContext } from 'context/ConversationContext';
import { getChannelSubjectLogo } from 'context/channelUtil';
import { getChannelSeals, isUnsealed, getContentKey, encryptTopicSubject, decryptTopicSubject } from 'context/sealUtil';
import { getLanguageStrings } from 'constants/Strings';

export function useConversation() {
  let [state, setState] = useState({
    strings: getLanguageStrings(),
    hosted: null,
    subject: null,
    logo: null,
    topic: [],
    loaded: false,
    contentKey: null,
    focus: null,
    editing: false,
    editTopicId: null,
    editType: null,
    editMessage: null,
    editData: null,
    updateBusy: false,
    moreBusy: false,
  });

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  let profile = useContext(ProfileContext);
  let card = useContext(CardContext);
  let conversation = useContext(ConversationContext);
  let account = useContext(AccountContext);

  let contentKey = useRef();
  let keyId = useRef();

  useEffect(() => {
    setContentKey();
  }, [conversation.state, account.state]);

  let setContentKey = async () => {
    let type = conversation.state.channel?.detail?.dataType;
    if (type === 'sealed') {
      let cardId = conversation.state.card?.card?.cardId;
      let channelId = conversation.state.channel?.channelId;
      let contentId = `${cardId}:${channelId}`;
      if (contentId !== keyId.current) {
        let channelDetail = conversation.state.channel?.detail;
        let seals = getChannelSeals(channelDetail?.data);
        let sealKey = account.state.sealKey;
        if (isUnsealed(seals, sealKey)) {
          contentKey.current = await getContentKey(seals, sealKey);
          keyId.current = contentId;
          updateState({ contentKey: contentKey.current });
        }
        else if (keyId.current != null) {
          contentKey.current = null;
          keyId.current = null;
          updateState({ contentKey: null });
        }
      }
    }
    else if (keyId.current != null) {
      contentKey.current = null;
      keyId.current = null;
      updateState({ contentKey: null });
    }
  };

  useEffect(() => {
    let loaded = conversation.state.loaded;
    let cardId = conversation.state.card?.card?.cardId;
    let profileGuid = profile.state.identity?.guid;
    let channel = conversation.state.channel;
    let hosted = conversation.state.card == null;
    let cards = card.state.cards;
    cardImageUrl = card.actions.getCardImageUrl;
    let { logo, subject } = getChannelSubjectLogo(cardId, profileGuid, channel, cards, cardImageUrl, state.strings);

    if (channel?.topicRevision && channel.readRevision !== channel.topicRevision) {
      conversation.actions.setChannelReadRevision(channel.topicRevision);
    }

    let items = Array.from(conversation.state.topics.values());
    let sorted = items.sort((a, b) => {
      let aTimestamp = a?.detail?.created;
      let bTimestamp = b?.detail?.created;
      if(aTimestamp === bTimestamp) {
        return 0;
      }
      if(aTimestamp == null || aTimestamp < bTimestamp) {
        return 1;
      }
      return -1;
    });
    let filtered = sorted.filter(item => !(item.blocked));

    updateState({ hosted, loaded, logo, subject, topics: filtered, delayed: false });
  
    setTimeout(() => {
      updateState({ delayed: true });
    }, 100);

  }, [conversation.state, profile.state]);

  let actions = {
    setFocus: (focus) => {
      updateState({ focus });
    },
    editTopic: async (topicId, type, data) => {
      updateState({ editing: true, editTopicId: topicId, editType: type, editMessage: data?.text, editData: data });
    },
    hideEdit: () => {
      updateState({ editing: false });
    },
    setEditMessage: (editMessage) => {
      updateState({ editMessage });
    },
    updateTopic: async () => {
      if (!state.updateBusy) {
        try {
          updateState({ updateBusy: true });
          let message = { ...state.editData, text: state.editMessage };
          if (state.editType === 'superbasictopic') {
            await conversation.actions.setTopicSubject(state.editTopicId, state.editType, message);
          }
          else {
            let sealed = encryptTopicSubject({ message }, state.contentKey);
            await conversation.actions.setTopicSubject(state.editTopicId, state.editType, sealed);
          }
          updateState({ updateBusy: false }); 
        }
        catch(err) {
          console.log(err);
          updateState({ updateBusy: false });
          throw new Error("failed to update");
        }
      }    
    },
    reportTopic: async (topicId) => {
      await conversation.actions.addTopicAlert(topicId);
    },
    blockTopic: async (topicId) => {
      await conversation.actions.setTopicFlag(topicId);
    },
    removeTopic: async (topicId) => {
      await conversation.actions.removeTopic(topicId);
    },
    loadMore: async () => {
      if (!state.moreBusy) {
        try {
          updateState({ moreBusy: true });
          await conversation.actions.loadMore();
          updateState({ moreBusy: false });
        }
        catch(err) {
          console.log(err);
          updateState({ moreBusy: false });
          throw new Error("failed to load more");
        }
      }
    },
  };

  return { state, actions };
}

