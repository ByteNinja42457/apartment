import { useEffect, useContext, useState, useRef } from 'react';
import { setAccountSearchable } from 'api/setAccountSearchable';
import { setAccountNotifications } from 'api/setAccountNotifications';
import { setAccountSeal } from 'api/setAccountSeal';
import { getAccountStatus } from 'api/getAccountStatus';
import { setAccountLogin } from 'api/setAccountLogin';
import { addAccountMFA } from 'api/addAccountMFA';
import { setAccountMFA } from 'api/setAccountMFA';
import { removeAccountMFA } from 'api/removeAccountMFA';
import { StoreContext } from './StoreContext';

function urlB64ToUint8Array(base64String) {
  let padding = '='.repeat((4 - base64String.length % 4) % 4);
  let base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

  let rawData = window.atob(base64);
  let outputArray = new Uint8Array(rawData.length);

  for (var i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useAccountContext() {
  let [state, setState] = useState({
    offsync: false,
    status: null,
    seal: null,
    sealKey: null,
    webPushKey: null,
  });
  let access = useRef(null);
  let setRevision = useRef(null);
  let curRevision = useRef(null);
  let syncing = useRef(false);
  let force = useRef(false); 

  let storeContext = useContext(StoreContext);

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }))
  }

  useEffect(() => {
    updateState({ sealKey: storeContext.state.sealKey });
  }, [storeContext.state]);

  let sync = async () => {
    if (!syncing.current && (setRevision.current !== curRevision.current || force.current)) {
      syncing.current = true;
      force.current = false;

      try {
        let token = access.current;
        let revision = curRevision.current;
        let status = await getAccountStatus(token);
        let { seal, webPushKey } = status || {};

        setRevision.current = revision;
        updateState({ offsync: false, status, seal, webPushKey });
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
  }

  let actions = {
    setToken: (token) => {
      if (access.current || syncing.current) {
        throw new Error("invalid account session state");
      }
      access.current = token;
      curRevision.current = null;
      setRevision.current = null;
      setState({ offsync: false, status: null, seal: null, sealKey: null });
    },
    clearToken: () => {
      access.current = null;
    },
    setRevision: async (rev) => {
      curRevision.current = rev;
      await sync();
    },
    setSearchable: async (flag) => {
      await setAccountSearchable(access.current, flag);
    },
    setPushEnabled: async (flag) => {
      if (flag) {
        let status = await Notification.requestPermission();
        if (status === 'granted') {
          let registration = await navigator.serviceWorker.register('push.js');
          await navigator.serviceWorker.ready;
          let params = { userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(state.webPushKey) };
          let subscription = await registration.pushManager.subscribe(params);

          let endpoint = subscription.endpoint;
          let binPublicKey = subscription.getKey('p256dh');
          let binAuth = subscription.getKey('auth');

          if (endpoint && binPublicKey && binAuth) {
            let numPublicKey = [];
            (new Uint8Array(binPublicKey)).forEach(val => {
              numPublicKey.push(val);
            });
            let numAuth = [];
            (new Uint8Array(binAuth)).forEach(val => {
              numAuth.push(val);
            });
            let publicKey = btoa(String.fromCharCode.apply(null, numPublicKey));
            let auth = btoa(String.fromCharCode.apply(null, numAuth));

            await setAccountNotifications(access.current, endpoint, publicKey, auth, true);
          }
        }
      }
      else {
        await setAccountNotifications(access.current, '', '', '', false);
      }
    },
    enableMFA: async () => {
      let secret = await addAccountMFA(access.current);
      return secret;
    },
    disableMFA: async () => {
      await removeAccountMFA(access.current);
    },
    confirmMFA: async (code) => {
      await setAccountMFA(access.current, code);
    },
    setSeal: async (seal, sealKey) => {
      await setAccountSeal(access.current, seal);
      await storeContext.actions.setValue("sealKey", sealKey);
      updateState({ sealKey });
    },
    updateSeal: async (seal) => {
      await setAccountSeal(access.current, seal);
    },
    unlockSeal: async (sealKey) => {
      await storeContext.actions.setValue("sealKey", sealKey);
      updateState({ sealKey });
    },
    setLogin: async (username, password) => {
      await setAccountLogin(access.current, username, password);
    },
    resync: async () => {
      force.current = true;
      await sync();
    },
  }

  return { state, actions }
}


