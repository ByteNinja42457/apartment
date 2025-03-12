import { useEffect, useState, useRef, useContext } from 'react';
import { Alert } from 'react-native';
import { setLogin } from 'api/setLogin';
import { clearLogin } from 'api/clearLogin';
import { removeProfile } from 'api/removeProfile';
import { setAccountAccess } from 'api/setAccountAccess';
import { addAccount } from 'api/addAccount';
import { createWebsocket } from 'api/fetchUtil';
import { StoreContext } from 'context/StoreContext';
import { AccountContext } from 'context/AccountContext';
import { ProfileContext } from 'context/ProfileContext';
import { CardContext } from 'context/CardContext';
import { ChannelContext } from 'context/ChannelContext';
import { RingContext } from 'context/RingContext';
import { getVersion, getApplicationName, getDeviceId } from 'react-native-device-info'
import messaging from '@react-native-firebase/messaging';
import { DeviceEventEmitter } from 'react-native';

export function useAppContext() {
  var [state, setState] = useState({
    session: null,
    status: null,
    loggingOut: false,
    loggedOut: false,
    adminToken: null,
    version: getVersion(),
  });

  var store = useContext(StoreContext);
  var account = useContext(AccountContext);
  var profile = useContext(ProfileContext);
  var card = useContext(CardContext);
  var channel = useContext(ChannelContext);
  var ring = useContext(RingContext);
  var delay = useRef(0);

  var ws = useRef(null);
  var deviceToken = useRef(null);
  var pushType = useRef(null);
  var access = useRef(null);
  var init = useRef(false);

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }))
  }

  var setDeviceToken = async () => {
    if (!deviceToken.current) {
      try {
        var token = await messaging().getToken();
        if (!token) {
          throw new Error('null push token');
        }
        deviceToken.current = token;
        pushType.current = "fcm";
      }
      catch(err) {
        console.log(err);
      }
    }
  }

  useEffect(() => {

    // select the unified token if available
    DeviceEventEmitter.addListener('unifiedPushURL', (e) => {
      deviceToken.current = e.endpoint;
      pushType.current = "up";
    });

    (async () => {
      await setDeviceToken();
      access.current = await store.actions.init();
      if (access.current) {
        await setSession();
      }
      else {
        updateState({ session: false });
      }
      init.current = true;
    })();
  }, []);

  var setSession = async () => {
    var { loginTimestamp, guid } = access.current;
    updateState({ session: true, loginTimestamp, status: 'connecting' });
    await store.actions.updateDb(guid);
    await account.actions.setSession(access.current);
    await profile.actions.setSession(access.current);
    await card.actions.setSession(access.current);
    await channel.actions.setSession(access.current);
    await ring.actions.setSession(access.current);
    setWebsocket(access.current);
  }

  var clearSession = async () => {
    account.actions.clearSession();
    profile.actions.clearSession();
    card.actions.clearSession();
    channel.actions.clearSession();
    ring.actions.clearSession();
    updateState({ session: false });
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
    create: async (server, username, password, token) => {
      if (!init.current || access.current) {
        throw new Error('invalid session state');
      }
      await setDeviceToken();
      updateState({ loggedOut: false });
      await addAccount(server, username, password, token);
      var session = await setLogin(username, server, password, null, getApplicationName(), getVersion(), getDeviceId(), deviceToken.current, pushType.current, notifications)
      access.current = { loginTimestamp: session.created, server, token: session.appToken, guid: session.guid };
      await store.actions.setSession(access.current);
      await setSession();
      if (session.pushSupported) {
        messaging().requestPermission().then(status => {})
      }
    },
    access: async (server, token) => {
      if (!init.current || access.current) {
        throw new Error('invalid session state');
      }
      await setDeviceToken();
      updateState({ loggedOut: false });
      var session = await setAccountAccess(server, token, getApplicationName(), getVersion(), getDeviceId(), deviceToken.current, pushType.current, notifications);
      access.current = { loginTimestamp: session.created, server, token: session.appToken, guid: session.guid };
      await store.actions.setSession(access.current);
      await setSession();
      if (session.pushSupported) {
        messaging().requestPermission().then(status => {})
      }
    },
    login: async (username, password, code) => {
      if (!init.current || access.current) {
        throw new Error('invalid session state');
      }
      await setDeviceToken();
      updateState({ loggedOut: false });
      var acc = username.includes('/') ? username.split('/') : username.split('@');
      var session = await setLogin(acc[0], acc[1], password, code, getApplicationName(), getVersion(), getDeviceId(), deviceToken.current, pushType.current, notifications)
      access.current = { loginTimestamp: session.created, server: acc[1], token: session.appToken, guid: session.guid };
      await store.actions.setSession(access.current);
      await setSession(); 
      if (session.pushSupported) {
        messaging().requestPermission().then(status => {})
      }
    },
    logout: async () => {
      if (!access.current) {
        throw new Error('invalid session state');
      }
      updateState({ loggingOut: true });
      try {
        if (pushType.current == "fcm") {
          await messaging().deleteToken();
          deviceToken.current = await messaging().getToken();
        }
        var { server, token } = access.current || {};
        await clearLogin(server, token);
      }
      catch (err) {
        console.log(err);
      }
      await clearSession();
      access.current = null;
      await store.actions.clearSession();
      await store.actions.clearFirstRun();
      updateState({ loggedOut: true, loggingOut: false });
    },
    remove: async () => {
      if (!access.current) {
        throw new Error('invalid session state');
      }
      var { server, token } = access.current || {};
      await removeProfile(server, token);
      await clearSession();
      await store.actions.clearSession();
    },
  }

  var setWebsocket = (session) => {
    var insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(session.server);
    var protocol = insecure ? 'ws' : 'wss';
    ws.current = createWebsocket(`${protocol}://${session.server}/status?mode=ring`);
    ws.current.onmessage = (ev) => {
      if (ev.data == '') {
        actions.logout();
        return;
      }
      try {
        delay.current = 0;
        let activity = JSON.parse(ev.data);
        updateState({ status: 'connected' });

        if (activity.revision) {
          var { profile: profileRev, account: accountRev, channel: channelRev, card: cardRev } = activity.revision;
          profile.actions.setRevision(profileRev);
          account.actions.setRevision(accountRev);
          channel.actions.setRevision(channelRev);
          card.actions.setRevision(cardRev);
        }
        else if (activity.ring) {
          var { cardId, callId, calleeToken, ice, iceUrl, iceUsername, icePassword } = activity.ring;
          var config = ice ? ice : [{ urls: iceUrl, username: iceUsername, credential: icePassword }];
          ring.actions.ring(cardId, callId, calleeToken, config);
        }
        else {
          var { profile: profileRev, account: accountRev, channel: channelRev, card: cardRev } = activity;
          profile.actions.setRevision(profileRev);
          account.actions.setRevision(accountRev);
          channel.actions.setRevision(channelRev);
          card.actions.setRevision(cardRev);
        }
      }
      catch (err) {
        console.log(err);
        ws.current.close();
      }
    }
    ws.current.onopen = () => {
      if (ws.current) {
        ws.current.send(JSON.stringify({ AppToken: session.token }))
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
          delay.current = 1;
          setWebsocket(session);
        }
      }, 1000 * delay.current)
    }
    ws.current.error = (e) => {
      console.log(e);
      ws.current.close();
    }
  }
 
  var clearWebsocket = ()  => {
    if (ws.current) {
      ws.current.onmessage = () => {};
      ws.current.onclose = () => {};
      ws.current.onerror = () => {};
      ws.current.close();
      ws.current = null;
    }
  }

  return { state, actions }
}

