import { useState, useRef, useContext } from 'react';
import { StoreContext } from 'context/StoreContext';
import { setAccountSeal } from 'api/setAccountSeal';
import { setAccountSearchable } from 'api/setAccountSearchable';
import { setAccountNotifications } from 'api/setAccountNotifications';
import { getAccountStatus } from 'api/getAccountStatus';
import { setAccountLogin } from 'api/setAccountLogin';
import { addAccountMFA } from 'api/addAccountMFA';
import { setAccountMFA } from 'api/setAccountMFA';
import { removeAccountMFA } from 'api/removeAccountMFA';

export function useAccountContext() {
  let [state, setState] = useState({
    offsync: false,
    status: {},
  });
  let store = useContext(StoreContext);

  let access = useRef(null);
  let curRevision = useRef(null);
  let setRevision = useRef(null);
  let syncing = useRef(false);

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }))
  }

  let sync = async () => {
    if (access.current && !syncing.current && setRevision.current !== curRevision.current) {
      syncing.current = true;
      try {
        let revision = curRevision.current;
        let { server, token, guid } = access.current || {};
        let status = await getAccountStatus(server, token);
        await store.actions.setAccountStatus(guid, status);
        await store.actions.setAccountRevision(guid, revision);
        updateState({ status });
        setRevision.current = revision;
      }
      catch(err) {
        console.log(err);
        syncing.current = false;
        return;
      }

      syncing.current = false;
      sync();
    }
  };

  let actions = {
    setSession: async (session) => {
      if (access.current || syncing.current) {
        throw new Error('invalid account state');
      }
      access.current = session;
      let { guid, server, token } = session || {};
      let status = await store.actions.getAccountStatus(guid);
      let sealKey = await store.actions.getAccountSealKey(guid);
      let revision = await store.actions.getAccountRevision(guid);
      updateState({ status, sealKey });
      setRevision.current = revision;
      curRevision.current = revision;
    },
    clearSession: () => {
      access.current = null;
      updateState({ account: {} });
    },
    setRevision: (rev) => {
      curRevision.current = rev;
      sync();
    },
    setNotifications: async (flag) => {
      let { server, token } = access.current || {};
      await setAccountNotifications(server, token, flag);
    },
    setSearchable: async (flag) => {
      let { server, token } = access.current || {};
      await setAccountSearchable(server, token, flag);
    },
    enableMFA: async () => {
      let { server, token } = access.current || {};
      let secret = await addAccountMFA(server, token);
      return secret;
    },
    disableMFA: async () => {
      let { server, token } = access.current || {};
      await removeAccountMFA(server, token);
    },
    confirmMFA: async (code) => {
      let { server, token } = access.current || {};
      await setAccountMFA(server, token, code);
    },
    setAccountSeal: async (seal, key) => {
      let { guid, server, token } = access.current || {};
      await setAccountSeal(server, token, seal);
      await store.actions.setAccountSealKey(guid, key);
      updateState({ sealKey: key });
    },
    unlockAccountSeal: async (key) => {
      let { guid } = access.current || {};
      await store.actions.setAccountSealKey(guid, key);
      updateState({ sealKey: key });
    },
    setLogin: async (username, password) => {
      let { server, token } = access.current || {};
      await setAccountLogin(server, token, username, password);
    },
    resync: async () => {
      await sync();
    }
  }

  return { state, actions }
}


