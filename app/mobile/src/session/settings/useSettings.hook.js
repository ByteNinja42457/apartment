import { useState, useEffect, useRef, useContext } from 'react';
import { Alert } from 'react-native';
import { getLanguageStrings } from 'constants/Strings';
import { ProfileContext } from 'context/ProfileContext';
import { AccountContext } from 'context/AccountContext';
import { CardContext } from 'context/CardContext';
import { ChannelContext } from 'context/ChannelContext';
import { AppContext } from 'context/AppContext';
import { generateSeal, updateSeal, unlockSeal } from 'context/sealUtil';
import { DisplayContext } from 'context/DisplayContext';
import { getChannelSubjectLogo } from 'context/channelUtil';

export function useSettings() {

  let profile = useContext(ProfileContext);
  let account = useContext(AccountContext);
  let app = useContext(AppContext);
  let card = useContext(CardContext);
  let channel = useContext(ChannelContext);
  let display = useContext(DisplayContext);

  let debounce = useRef(null);
  let checking = useRef(null);
  let channels = useRef([]);
  let cardChannels = useRef([]);

  let [state, setState] = useState({
    strings: getLanguageStrings(),
    timeFull: false,
    monthLast: false,
    pushEnabled: null,

    login: false,
    username: null,
    validated: false,
    available: true,
    password: null,
    confirm: null,
    delete: null,
    
    editSeal: false,
    sealEnabled: false,
    sealUnlocked: false,
    sealPassword: null,
    sealConfirm: null,
    sealDelete: null,
    hideConfirm: true,
    hidePassword: true,
    sealRemove: false,
    sealUpdate: false,

    blockedContacts: false,
    blockedTopics: false,
    blockedMessages: false,

    contacts: [],
    topics: [],
    messages: [],

    mfaModal: false,
    mfaEnabled: false,
    mfaError: null,
    mfaCode: '',
    mfaText: null,
    mfaImage: null,
  });

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    let { timeFull, monthLast } = profile.state;
    let handle = profile.state.identity.handle;
    updateState({ timeFull, monthLast, handle });
  }, [profile.state]);

  useEffect(() => {
    let { seal, sealable, pushEnabled, mfaEnabled } = account.state.status;
    let sealKey = account.state.sealKey;
    let sealEnabled = seal?.publicKey != null;
    let sealUnlocked = seal?.publicKey === sealKey?.public && sealKey?.private && sealKey?.public;
    updateState({ sealable, seal, sealKey, sealEnabled, sealUnlocked, pushEnabled, mfaEnabled });
  }, [account.state]);

  let setCardItem = (item) => {
    let { profile, cardId } = item?.card || {};
    return {
      cardId: cardId,
      name: profile?.name,
      handle: `${profile?.handle} / ${profile?.node}`,
      logo: profile?.imageSet ? card.actions.getCardImageUrl(cardId) : 'avatar',
    }
  };

  let setChannelItem = (item) => {
    let profileGuid = profile.state?.identity?.guid;
    let { logo, subject } = getChannelSubjectLogo(item.cardId, profileGuid, item, card.state.cards, card.actions.getCardImageUrl);
    return {
      cardId: item.cardId,
      channelId: item.channelId,
      created: item.detail.created,
      logo: logo,
      subject: subject,
    }
  };

  let setTopicItem = (item) => {
    let { cardId, channelId, topicId, detail } = item;
    if (cardId) {
      let contact = card.state.cards.get(cardId);
      let { handle, node, imageSet } = contact?.card?.profile || {};
      return {
        cardId: cardId,
        channelId: channelId,
        topicId: topicId,
        handle: `${handle} / ${node}`,
        logo: imageSet ? card.actions.getCardImageUrl(cardId) : 'avatar',
        created: detail?.created,
      }
    }
    else {
      let { handle, node } = profile?.state.identity || {};
      return {
        channelId: channelId,
        topicId: topicId,
        handle: `${handle} / ${node}`,
        logo: profile?.state?.imageUrl ? profile.state.imageUrl : 'avatar',
        created: detail?.created,
      }
    }
  };

  useEffect(() => {
    let contacts = Array.from(card.state.cards.values());
    let filtered = contacts.filter(contact => contact.card.blocked);
    let sorted = filtered.map(setCardItem).sort((a, b) => {
      if (a.name === b.name) {
        return 0;
      }
      if (!a.name || (a.name < b.name)) {
        return -1;
      }
      return 1;
    });
    updateState({ contacts: sorted });

    cardChannels.current = [];
    contacts.forEach(contact => {
      let filtered = Array.from(contact.channels.values()).filter(topic => topic.blocked);
      let mapped = filtered.map(item => setChannelItem({ ...item, cardId: contact.card.cardId }));
      cardChannels.current = cardChannels.current.concat(mapped);
    });
    let merged = cardChannels.current.concat(channels.current);
    let sortedMerge = merged.sort((a, b) => {
      if (a.created === b.created) {
        return 0;
      }
      if (a.created < b.created) {
        return -1;
      }
      return 1;
    });
    updateState({ topics: sortedMerge });
  }, [card.state]);

  useEffect(() => {
    let filtered = Array.from(channel.state.channels.values()).filter(topic => topic.blocked);
    channels.current = filtered.map(setChannelItem);
    let merged = cardChannels.current.concat(channels.current);
    let sortedMerge = merged.sort((a, b) => {
      if (a.created === b.created) {
        return 0;
      }
      if (a.created < b.created) {
        return -1;
      }
      return 1;
    });
    updateState({ topics: sortedMerge });
  }, [channel.state]);

  let unlockKey = async () => {
    let sealKey = unlockSeal(state.seal, state.sealPassword);
    await account.actions.unlockAccountSeal(sealKey);
  };

  let disableKey = async () => {
    await account.actions.unlockAccountSeal({});
  }

  let updateKey = async () => {
    let updated = updateSeal(state.seal, state.sealKey, state.sealPassword);
    await account.actions.setAccountSeal(updated.seal, updated.sealKey);
  }

  let generateKey = async () => {
    let created = await generateSeal(state.sealPassword);
    await account.actions.setAccountSeal(created.seal, created.sealKey);
  }

  let removeKey = async () => {
    await account.actions.setAccountSeal({}, {});
  }

  let actions = {
    setTimeFull: async (flag) => {
      updateState({ timeFull: flag });
      await profile.actions.setTimeFull(flag);
    },
    setMonthLast: async (flag) => {
      updateState({ monthLast: flag });
      await profile.actions.setMonthLast(flag);
    },
    setNotifications: async (pushEnabled) => {
      updateState({ pushEnabled });
      await account.actions.setNotifications(pushEnabled);
    },
    showBlockedContacts: () => {
      updateState({ blockedContacts: true });
    },
    hideBlockedContacts: () => {
      updateState({ blockedContacts: false });
    },
    showBlockedTopics: () => {
      updateState({ blockedTopics: true });
    },
    hideBlockedTopics: () => {
      updateState({ blockedTopics: false });
    },
    showBlockedMessages: async () => {
      let cardMessages = await card.actions.getFlaggedTopics();
      let channelMessages = await channel.actions.getFlaggedTopics();
      let merged = cardMessages.map(setTopicItem).concat(channelMessages.map(setTopicItem));
      let sortedMerge = merged.sort((a, b) => {
        if (a.created === b.created) {
          return 0;
        }
        if (a.created < b.created) {
          return -1;
        }
        return 1;
      });
      updateState({ blockedMessages: true, messages: sortedMerge });
    },
    hideBlockedMessages: () => {
      updateState({ blockedMessages: false });
    },
    showLogin: () => {
      updateState({ login: true, username: state.handle, password: '', available: true, validated: true });
    },
    hideLogin: () => {
      updateState({ login: false });
    },
    changeLogin: async () => {
      await account.actions.setLogin(state.username, state.password);
    },
    deleteAccount: async () => {
      await app.actions.remove();
    },
    setUsername: (username) => {
      clearTimeout(debounce.current);
      checking.current = username;
      updateState({ username, validated: false });
      if (!username) {
        updateState({ available: false, validated: false });
      }
      else if (state.handle === username) {
        updateState({ available: true, validated: true });
      }
      else {
        debounce.current = setTimeout(async () => {
          let cur = JSON.parse(JSON.stringify(username));
          let available = await profile.actions.getHandleStatus(cur);
          if (checking.current === cur) {
            updateState({ available, validated: true });
          }
        }, 1000);
      }
    },
    setPassword: (password) => {
      updateState({ password });
    },
    setConfirm: (confirm) => {
      updateState({ confirm });
    },
    logout: async () => {
      await app.actions.logout();
    },
    showDelete: () => {
      updateState({ delete: true, confirm: '' });
    },
    hideDelete: () => {
      updateState({ delete: false });
    },
    promptLogout: () => {
      display.actions.showPrompt({
        title: state.strings.loggingOut,
        centerButtons: true,
        ok: { label: state.strings.confirmLogout, action: app.actions.logout, failed: () => {
          Alert.alert(
            state.strings.error,
            state.strings.tryAgain,
          );
        }},
        cancel: { label: state.strings.cancel },
      });
    },
    showEditSeal: () => {
      updateState({ editSeal: true, sealPassword: '', hidePassword: true, hideConfirm: true,
          sealDelete: '', sealRemove: false, sealUpdate: false });
    },
    hideEditSeal: () => {
      updateState({ editSeal: false });
    },
    showSealRemove: () => {
      updateState({ sealRemove: true });
    },
    hideSealRemove: () => {
      updateState({ sealRemove: false });
    },
    showSealUpdate: () => {
      updateState({ sealUpdate: true });
    },
    hideSealUpdate: () => {
      updateState({ sealUpdate: false });
    },
    setSealPassword: (sealPassword) => {
      updateState({ sealPassword });
    },
    setSealConfirm: (sealConfirm) => {
      updateState({ sealConfirm });
    },
    setSealDelete: (sealDelete) => {
      updateState({ sealDelete });
    },
    showPassword: () => {
      updateState({ hidePassword: false });
    },
    hidePassword: () => {
      updateState({ hidePassword: true });
    },
    showConfirm: () => {
      updateState({ hideConfirm: false });
    },
    hideConfirm: () => {
      updateState({ hideConfirm: true });
    },
    generateKey: async () => {
      await generateKey();
    },
    disableKey: async () => {
      await disableKey();
    },
    unlockKey: async () => {
      await unlockKey();
    },
    updateKey: async () => {
      await updateKey();
    },
    removeKey: async () => {
      await removeKey();
    },
    unblockContact: async ({ cardId }) => {
      await card.actions.clearCardFlag(cardId);
    },
    unblockTopic: async ({ cardId, channelId }) => {
      if (cardId) {
        await card.actions.clearChannelFlag(cardId, channelId);
      }
      else {
        await channel.actions.clearChannelFlag(channelId);
      }
    },
    unblockMessage: async ({ cardId, channelId, topicId }) => {
      if (cardId) {
        await card.actions.clearTopicFlag(cardId, channelId, topicId);
        updateState({ messages: state.messages.filter(item => item.cardId !== cardId || item.channelId !== channelId || item.topicId !== topicId) });
      }
      else {
        await channel.actions.clearTopicFlag(channelId, topicId);
        updateState({ messages: state.messages.filter(item => item.channelId !== channelId || item.topicId !== topicId) });
      }
    },
    enableMFA: async () => {
      updateState({ mfaModal: true, mfaImage: null, mfaText: null, mfaCode: '' });
      let mfa = await account.actions.enableMFA();
      updateState({ mfaImage: mfa.secretImage, mfaText: mfa.secretText });
    },
    disableMFA: async () => {
      updateState({ mfaEnabled: false });
      try {
        await account.actions.disableMFA();
      }
      catch (err) {
        updateState({ mfaEnabled: true });
        throw err;
      }
    },
    confirmMFA: async () => {
      try {
        updateState({ mfaEnabled: true });
        await account.actions.confirmMFA(state.mfaCode);
        updateState({ mfaModal: false });
      }
      catch (err) {
        updateState({ mfaEnabled: false, mfaError: err.message});
      }
    },
    dismissMFA: () => {
      updateState({ mfaModal: false });
    },
    setCode: (mfaCode) => {
      updateState({ mfaCode });
    },
  };

  return { state, actions };
}


