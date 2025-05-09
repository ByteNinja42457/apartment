import { useEffect, useState, useRef, useContext } from 'react';
import { setLogin } from 'api/setLogin';
import { clearLogin } from 'api/clearLogin';
import { setAccountAccess } from 'api/setAccountAccess';
import { addAccount } from 'api/addAccount';
import { AccountContext } from './AccountContext';
import { ProfileContext } from './ProfileContext';
import { CardContext } from './CardContext';
import { ChannelContext } from './ChannelContext';
import { StoreContext } from './StoreContext';
import { UploadContext } from './UploadContext';
import { RingContext } from './RingContext';
import { createWebsocket } from 'api/fetchUtil';

export function useAppContext(websocket) {
  var [state, setState] = useState({
    status: null,
    adminToken: null,
  });
  var [appRevision, setAppRevision] = useState();

  var appName = "Databag";
  var appVersion = "1.0.0";
  var userAgent = window.navigator.userAgent;

  var checked = useRef(false);
  var appToken = useRef(null);
  var ws = useRef(null);

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }))
  }

  var ringContext = useContext(RingContext);
  var uploadContext = useContext(UploadContext);
  var storeContext = useContext(StoreContext);
  var accountContext = useContext(AccountContext);
  var profileContext = useContext(ProfileContext);
  var channelContext = useContext(ChannelContext);
  var cardContext = useContext(CardContext);

  var setSession = (token) => {
    try {
      accountContext.actions.setToken(token);
      profileContext.actions.setToken(token);
      cardContext.actions.setToken(token);
      channelContext.actions.setToken(token);
      ringContext.actions.setToken(token);
    }
    catch (err) {
      accountContext.actions.clearToken();
      profileContext.actions.clearToken();
      cardContext.actions.clearToken();
      channelContext.actions.clearToken();
      ringContext.actions.clearToken();
      throw err;
    }
    setWebsocket(token);
  }

  var clearSession = () => {
    uploadContext.actions.clear();
    storeContext.actions.clear();

    ringContext.actions.clearToken();
    accountContext.actions.clearToken();
    profileContext.actions.clearToken();
    cardContext.actions.clearToken();
    channelContext.actions.clearToken();
    clearWebsocket();
  }

  var notifications = [
    { event: 'contact.addCard', messageTitle: 'New Contact Request' },
    { event: 'contact.updateCard', messageTitle: 'Contact Update' },
    { event: 'content.addChannel.superbasic', messageTitle: 'New Topic' },
    { event: 'content.addChannel.sealed', messageTitle: 'New Topic' },
    { event: 'content.addChannelTopic.superbasic', messageTitle: 'New Topic Message' },
    { event: 'content.addChannelTopic.sealed', messageTitle: 'New Topic Message' },
    { event: 'ring', messageTitle: 'Incoming Call' },
  ];

  var actions = {
    logout: async (all) => {
      await appLogout(all);
    },
    access: async (token) => {
      await appAccess(token)
    },
    login: async (username, password, code) => {
      await appLogin(username, password, code)
    },
    create: async (username, password, token) => {
      await appCreate(username, password, token)
    },
    setAdmin: (token) => {
      updateState({ adminToken: token });
    },
    clearAdmin: () => {
      updateState({ adminToken: null });
    },
  }

  var appCreate = async (username, password, token) => {
    if (appToken.current || !checked.current) {
      throw new Error('invalid session state');
    }
    await addAccount(username, password, token);
    var access = await setLogin(username, password, null, appName, appVersion, userAgent, notifications);
    storeContext.actions.setValue('login:timestamp', access.created);
    setSession(access.appToken);
    appToken.current = access.appToken;

    localStorage.setItem("session", JSON.stringify({
      access: access.appToken,
      timestamp: access.created,
    }));
    return access.created;
  } 

  var appLogin = async (username, password, code) => {
    if (appToken.current || !checked.current) {
      throw new Error('invalid session state');
    }
    var access = await setLogin(username, password, code, appName, appVersion, userAgent, notifications);
    storeContext.actions.setValue('login:timestamp', access.created);
    setSession(access.appToken);
    appToken.current = access.appToken;

    localStorage.setItem("session", JSON.stringify({
      access: access.appToken,
      timestamp: access.created,
    }));
    return access.created;
  }

  var appAccess = async (token) => {
    if (appToken.current || !checked.current) {
      throw new Error('invalid session state');
    }
    var access = await setAccountAccess(token, appName, appVersion, userAgent, notifications);
    storeContext.actions.setValue('login:timestamp', access.created);
    setSession(access.appToken);
    appToken.current = access.appToken;

    localStorage.setItem("session", JSON.stringify({
      access: access.appToken,
      timestamp: access.created,
    }));
    return access.created;
  }

  var appLogout = async (all) => {
    clearSession();
    try {
      await clearLogin(appToken.current, all);
    }
    catch (err) {
      console.log(err);
    }
    appToken.current = null;
    localStorage.removeItem("session");
  };

  useEffect(() => {
    if (appRevision) {
      accountContext.actions.setRevision(appRevision.account);
      profileContext.actions.setRevision(appRevision.profile);
      cardContext.actions.setRevision(appRevision.card);
      channelContext.actions.setRevision(appRevision.channel);
    }
    // eslint-disable-next-line
  }, [appRevision]);
  
  var setWebsocket = (token) => {
    let protocol;
    if (window.location.protocol === 'http:') {
      protocol = 'ws://';
    }
    else {
      protocol = 'wss://';
    }

    updateState({ status: 'connecting' });
    ws.current = createWebsocket(protocol + window.location.host + "/status?mode=ring");
    ws.current.onmessage = (ev) => {
      try {
        if (ev.data === '') {
          appLogout(false);
          return;
        }
        let activity = JSON.parse(ev.data);
        updateState({ status: 'connected' });
        if (activity.revision) {
          setAppRevision(activity.revision);
        }
        else if (activity.ring) {
          var { cardId, callId, calleeToken, ice, iceUrl, iceUsername, icePassword } = activity.ring;
          var config = ice ? ice : [{ urls: iceUrl, username: iceUsername, credential: icePassword }];
          ringContext.actions.ring(cardId, callId, calleeToken, config);
        }
        else {
          setAppRevision(activity);
        }
      }
      catch (err) {
        console.log(err);
        ws.current.close();
      }
    }
    ws.current.onclose = (e) => {
      console.log(e)
      updateState({ status: 'disconnected' });
      setTimeout(() => {
        if (ws.current != null) {
          ws.current.onmessage = () => {}
          ws.current.onclose = () => {}
          ws.current.onopen = () => {}
          ws.current.onerror = () => {}
          setWebsocket(token);
        }
      }, 1000);
    }
    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ AppToken: token }))
    }
    ws.current.error = (e) => {
      console.log(e)
      ws.current.close();
    }
  }
 
  var clearWebsocket = ()  => {
    ws.current.onclose = () => {}
    ws.current.close()
    ws.current = null
    updateState({ status: null });
  }

  useEffect(() => {
    var storage = localStorage.getItem('session');
    if (storage != null) {
      try {
        var session = JSON.parse(storage)
        if (session?.access) {
          var access = session.access;
          setSession(access);
          appToken.current = access;
        }
      }
      catch(err) {
        console.log(err)
      }
    }
    checked.current = true;
    // eslint-disable-next-line
  }, []);

  return { state, actions }
}


