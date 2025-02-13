import { useState, useRef } from 'react';
import { getUsername } from 'api/getUsername';
import { getProfile } from 'api/getProfile';
import { setProfileData } from 'api/setProfileData';
import { setProfileImage } from 'api/setProfileImage';
import { getProfileImageUrl } from 'api/getProfileImageUrl';

export function useProfileContext() {
  let [state, setState] = useState({
    offsync: false,
    identity: {},
    imageUrl: null,
  });
  let access = useRef(null);
  let curRevision = useRef(null);
  let setRevision = useRef(null);
  let syncing = useRef(false);

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }))
  }

  let sync = async () => {
    if (!syncing.current && setRevision.current !== curRevision.current) {
      syncing.current = true;

      try {
        let token = access.current;
        let revision = curRevision.current;
        let identity = await getProfile(access.current);
        let imageUrl = identity.image ? getProfileImageUrl(token, identity.revision) : null;
        setRevision.current = revision;
        updateState({ offsync: false, identity, imageUrl });
      }
      catch(err) {
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
        throw new Error("invalid profile session state");
      }
      access.current = token;
      curRevision.current = null;
      setRevision.current = null;
      setState({ offsync: false, identity: {}, imageUrl: null });
    },
    clearToken: () => {
      access.current = null;
    },
    setRevision: async (rev) => {
      curRevision.current = rev;
      await sync();
    },
    setProfileData: async (name, location, description) => {
      await setProfileData(access.current, name, location, description);
    },
    setProfileImage: async (image) => {
      await setProfileImage(access.current, image);
    },
    getHandleStatus: async (name) => {
      return await getUsername(name, access.current);
    },
    resync: async () => {
      await sync();
    },
  }

  return { state, actions }
}


