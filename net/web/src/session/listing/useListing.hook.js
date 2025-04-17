import { useContext, useState, useEffect } from 'react';
import { ProfileContext } from 'context/ProfileContext';
import { SettingsContext } from 'context/SettingsContext';
import { getListing } from 'api/getListing';
import { getListingImageUrl } from 'api/getListingImageUrl';

export function useListing() {

  let [state, setState] = useState({
    contacts: [],
    username: null,
    node: null,
    busy: false,
    disabled: true,
    showFilter: false,
    display: null,
    strings: {},
    menuStyle: {},
  });

  let profile = useContext(ProfileContext);
  let settings = useContext(SettingsContext);

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    updateState({ contacts: [] });
  }, [state.node]);

  let actions = {
    showFilter: () => {
      updateState({ showFilter: true });
    },
    hideFilter: () => {
      updateState({ showFilter: false });
    },
    setUsername: (username) => {
      updateState({ username });
    },
    onNode: (value) => {
      updateState({ node: value });
    },
    getListing: async () => {
      updateState({ busy: true });
      try {
        let listing = await getListing(state.node, state.username);
        let filtered = listing.filter(item => {
          return item.guid !== profile.state.identity.guid;
        });
        let contacts = filtered.map(item => {
          return {
            guid: item.guid,
            logo: item.imageSet ? getListingImageUrl(state.node, item.guid) : null,
            name: item.name,
            handle: item.handle,
            node: item.node,
          };
        });
        let sorted = contacts.sort((a, b) => {
          if (a?.name < b?.name) {
            return -1;
          }
          return 1;
        });
        updateState({ busy: false, contacts: sorted });
      }
      catch (err) {
        console.log(err);
        updateState({ busy: false });
        throw new Error("failed to list contacts");
      }
    },
  };

  useEffect(() => {
    let node = profile?.state?.identity?.node;
    updateState({ disabled: node == null || node === '', node });
  }, [profile.state]);

  useEffect(() => {
    let { display, strings, menuStyle } = settings.state;
    updateState({ display, strings, menuStyle });
  }, [settings.state]);

  return { state, actions };
}
