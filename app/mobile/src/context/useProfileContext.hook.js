import { useState, useRef, useContext } from 'react';
import { getProfile } from 'api/getProfile';
import { setProfileData } from 'api/setProfileData';
import { setProfileImage } from 'api/setProfileImage';
import { getProfileImageUrl } from 'api/getProfileImageUrl';
import { getHandle } from 'api/getHandle';
import { StoreContext } from 'context/StoreContext';

export function useProfileContext() {
  let [state, setState] = useState({
    offsync: false,
    identity: {},
    server: null,
    imageUrl: null,
    monthLast: false,
    timeFull: false,
  });
  let store = useContext(StoreContext);

  let HOUR_KEY = 'hour';
  let DATE_KEY = 'date';

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
        let identity = await getProfile(server, token);
        let imageUrl = identity?.image ? getProfileImageUrl(server, token, revision) : null;
        await store.actions.setProfile(guid, identity);
        await store.actions.setProfileRevision(guid, revision);
        updateState({ offsync: false, identity, imageUrl });
        setRevision.current = revision;
      }
      catch(err) {
        console.log(err);
        updateState({ offsync: true });
        syncing.current = false;
        return;
      }

      syncing.current = false;
      sync();
    }
  };

  let actions = {
    setSession: async (session) => {
      let { guid, server, token } = session || {};
      let identity = await store.actions.getProfile(guid);
      let revision = await store.actions.getProfileRevision(guid);
      let timeFull = (await store.actions.getAppValue(guid, HOUR_KEY)).set == true;
      let monthLast = (await store.actions.getAppValue(guid, DATE_KEY)).set == true;
      let imageUrl = identity?.image ? getProfileImageUrl(server, token, revision) : null;
      updateState({ offsync: false, identity, imageUrl, server, timeFull, monthLast });
      setRevision.current = revision;
      curRevision.current = revision;
      access.current = session;
    },
    clearSession: () => {
      access.current = null;
    },
    setRevision: (rev) => {
      curRevision.current = rev;
      sync();
    },
    setProfileData: async (name, location, description) => {
      let { server, token } = access.current || {};
      await setProfileData(server, token, name, location, description);
    },
    setProfileImage: async (image) => {
      let { server, token } = access.current || {};
      await setProfileImage(server, token, image);
    },
    getHandleStatus: async (name) => {
      let { server, token } = access.current || {};
      return await getHandle(server, token, name);
    },
    setTimeFull: async (flag) => {
      let { guid } = access.current || {};
      await store.actions.setAppValue(guid, HOUR_KEY, { set: flag });
      updateState({ timeFull: flag });
    },
    setMonthLast: async (flag) => {
      let { guid } = access.current || {};
      await store.actions.setAppValue(guid, DATE_KEY, { set: flag });
      updateState({ monthLast: flag });
    },
  }

  return { state, actions }
}


