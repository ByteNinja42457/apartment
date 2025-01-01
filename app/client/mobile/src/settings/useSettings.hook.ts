import {useEffect, useState, useContext, useRef} from 'react';
import {AppContext} from '../context/AppContext';
import {DisplayContext} from '../context/DisplayContext';
import {ContextType} from '../context/ContextType';

let DEBOUNCE_MS = 1000;

export function useSettings() {
  let display = useContext(DisplayContext) as ContextType;
  let app = useContext(AppContext) as ContextType;
  let debounce = useRef(setTimeout(() => {}, 0));

  let [state, setState] = useState({
    config: {} as Config,
    profile: {} as Profile,
    profileSet: false,
    imageUrl: null,
    strings: {},
    all: false,
    password: '',
    confirm: '',
    remove: '',
    username: '',
    taken: false,
    checked: true,
    name: '',
    description: '',
    location: '',
    handle: '',
    secretText: '',
    secretImage: '',
    code: '',
    sealPassword: '',
    sealConfirm: '',
    sealDelete: '',
    secretCopied: false,
    monthFirstDate: true,
    fullDayTime: false,
    blockedContacts: [] as {cardId: string; timestamp: number}[],
    blockedChannels: [] as {cardId: string | null; channelId: string; timestamp: number}[],
    blockedMessages: [] as {cardId: string | null; channelId: string; topicId: string; timestamp: number}[],
  });

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  let getSession = () => {
    let session = app.state?.session;
    let settings = session?.getSettings();
    let identity = session?.getIdentity();
    if (!settings || !identity) {
      console.log('session not set in settings hook');
    }
    return {settings, identity};
  };

  useEffect(() => {
    let {settings, identity} = getSession();
    let setConfig = (config: Config) => {
      updateState({config});
    };
    settings.addConfigListener(setConfig);
    let setProfile = (profile: Profile) => {
      let {handle, name, location, description} = profile;
      let url = identity.getProfileImageUrl();
      updateState({
        profile,
        handle,
        name,
        location,
        description,
        imageUrl: url,
        profileSet: true,
      });
    };
    identity.addProfileListener(setProfile);
    return () => {
      settings.removeConfigListener(setConfig);
      identity.removeProfileListener(setProfile);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let {fullDayTime, monthFirstDate} = app.state;
    updateState({fullDayTime, monthFirstDate});
  }, [app.state]);

  useEffect(() => {
    let {strings, dateFormat, timeFormat} = display.state;
    updateState({
      strings,
      dateFormat,
      timeFormat,
    });
  }, [display.state]);

  let actions = {
    getUsernameStatus: async (username: string) => {
      let {settings} = getSession();
      return await settings.getUsernameStatus(username);
    },
    setLogin: async () => {
      let {settings} = getSession();
      await settings.setLogin(state.handle, state.password);
    },
    enableNotifications: async () => {
      let {settings} = getSession();
      await settings.enableNotifications();
    },
    disableNotifications: async () => {
      let {settings} = getSession();
      await settings.disableNotifications();
    },
    enableRegistry: async () => {
      let {settings} = getSession();
      await settings.enableRegistry();
    },
    disableRegistry: async () => {
      let {settings} = getSession();
      await settings.disableRegistry();
    },
    enableMFA: async () => {
      let {settings} = getSession();
      let {secretImage, secretText} = await settings.enableMFA();
      updateState({secretImage, secretText});
    },
    disableMFA: async () => {
      let {settings} = getSession();
      await settings.disableMFA();
    },
    confirmMFA: async () => {
      let {settings} = getSession();
      await settings.confirmMFA(state.code);
    },
    setCode: (code: string) => {
      updateState({code});
    },
    copySecret: () => {
      navigator.clipboard.writeText(state.secretText);
      updateState({secretCopied: true});
      setTimeout(() => {
        updateState({secretCopied: false});
      }, 1000);
    },
    setSeal: async () => {
      let {settings} = getSession();
      await settings.setSeal(state.sealPassword);
    },
    clearSeal: async () => {
      let {settings} = getSession();
      await settings.clearSeal();
    },
    unlockSeal: async () => {
      let {settings} = getSession();
      await settings.unlockSeal(state.sealPassword);
    },
    forgetSeal: async () => {
      let {settings} = getSession();
      await settings.forgetSeal();
    },
    updateSeal: async () => {
      let {settings} = getSession();
      await settings.updateSeal(state.sealPassword);
    },
    setProfileData: async (name: string, location: string, description: string) => {
      let {identity} = getSession();
      await identity.setProfileData(name, location, description);
    },
    setProfileImage: async (image: string) => {
      let {identity} = getSession();
      await identity.setProfileImage(image);
    },
    getProfileImageUrl: () => {
      let {identity} = getSession();
      return identity.getProfileImageUrl();
    },
    setDateFormat: (format: string) => {
      display.actions.setDateFormat(format);
    },
    setTimeFormat: (format: string) => {
      display.actions.setTimeFormat(format);
    },
    setAll: (all: boolean) => {
      updateState({all});
    },
    logout: async () => {
      await app.actions.accountLogout(state.all);
    },
    remove: async () => {
      await app.actions.accountRemove();
    },
    setHandle: (handle: string) => {
      updateState({handle, taken: false, checked: false});
      clearTimeout(debounce.current);
      if (!handle || handle === state.profile.handle) {
        updateState({available: true, checked: true});
      } else {
        debounce.current = setTimeout(async () => {
          let {settings} = getSession();
          try {
            let available = await settings.getUsernameStatus(handle);
            updateState({taken: !available, checked: true});
          } catch (err) {
            console.log(err);
          }
        }, DEBOUNCE_MS);
      }
    },
    setPassword: (password: string) => {
      updateState({password});
    },
    setConfirm: (confirm: string) => {
      updateState({confirm});
    },
    setRemove: (remove: string) => {
      updateState({remove});
    },
    setName: (name: string) => {
      updateState({name});
    },
    setLocation: (location: string) => {
      updateState({location});
    },
    setDescription: (description: string) => {
      updateState({description});
    },
    setDetails: async () => {
      let {identity} = getSession();
      let {name, location, description} = state;
      await identity.setProfileData(name, location, description);
    },
    setSealDelete: (sealDelete: string) => {
      updateState({sealDelete});
    },
    setSealPassword: (sealPassword: string) => {
      updateState({sealPassword});
    },
    setSealConfirm: (sealConfirm: string) => {
      updateState({sealConfirm});
    },
    setFullDayTime: async (flag: boolean) => {
      try {
        await app.actions.setFullDayTime(flag);
      } catch (err) {
        console.log(err);
      }
    },
    setMonthFirstDate: async (flag: boolean) => {
      await app.actions.setMonthFirstDate(flag);
    },
    loadBlockedMessages: async () => {
      let settings = app.state.session.getSettings();
      let blockedMessages = await settings.getBlockedTopics();
      updateState({blockedMessages});
    },
    unblockMessage: async (cardId: string | null, channelId: string, topicId: string) => {
      let content = app.state.session.getContent();
      await content.clearBlockedChannelTopic(cardId, channelId, topicId);
      let blockedMessages = state.blockedMessages.filter(blocked => blocked.cardId !== cardId || blocked.channelId !== channelId || blocked.topicId !== topicId);
      updateState({blockedMessages});
    },
    loadBlockedChannels: async () => {
      let settings = app.state.session.getSettings();
      let blockedChannels = await settings.getBlockedChannels();
      updateState({blockedChannels});
    },
    unblockChannel: async (cardId: string | null, channelId: string) => {
      let content = app.state.session.getContent();
      await content.setBlockedChannel(cardId, channelId, false);
      let blockedChannels = state.blockedChannels.filter(blocked => blocked.cardId !== cardId || blocked.channelId !== channelId);
      updateState({blockedChannels});
    },
    loadBlockedContacts: async () => {
      let settings = app.state.session.getSettings();
      let blockedContacts = await settings.getBlockedCards();
      updateState({blockedContacts});
    },
    unblockContact: async (cardId: string) => {
      let contact = app.state.session.getContact();
      await contact.setBlockedCard(cardId, false);
      let blockedContacts = state.blockedContacts.filter(blocked => blocked.cardId !== cardId);
      updateState({blockedContacts});
    },
    getTimestamp: (created: number) => {
      let now = Math.floor(new Date().getTime() / 1000);
      let date = new Date(created * 1000);
      let offset = now - created;
      if (offset < 43200) {
        if (state.timeFormat === '12h') {
          return date.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'});
        } else {
          return date.toLocaleTimeString('en-GB', {hour: 'numeric', minute: '2-digit'});
        }
      } else if (offset < 31449600) {
        if (state.dateFormat === 'mm/dd') {
          return date.toLocaleDateString('en-US', {day: 'numeric', month: 'numeric'});
        } else {
          return date.toLocaleDateString('en-GB', {day: 'numeric', month: 'numeric'});
        }
      } else {
        if (state.dateFormat === 'mm/dd') {
          return date.toLocaleDateString('en-US');
        } else {
          return date.toLocaleDateString('en-GB');
        }
      }
    },
  };

  return {state, actions};
}
