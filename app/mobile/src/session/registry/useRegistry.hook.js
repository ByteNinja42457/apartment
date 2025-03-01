import { useState, useEffect, useRef, useContext } from 'react';
import { ProfileContext } from 'context/ProfileContext';
import { getListing } from 'api/getListing';
import { getListingImageUrl } from 'api/getListingImageUrl';

export function useRegistry(search, handle, server) {

  let [state, setState] = useState({
    accounts: [],
    searching: false,
  });

  let profile = useContext(ProfileContext);
  let debounce = useRef();

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    if (debounce.current) {
      clearTimeout(debounce.current);
    }
    updateState({ searching: true });
    debounce.current = setTimeout(async () => {
      debounce.current = null;

      try {
        let accounts = handle ? await getListing(server, handle) : await getListing(server);
        let filtered = accounts.filter(item => {
          if (item.guid === profile.state.identity.guid) {
            return false;
          }
          return true;
        });
        let items = filtered.map(setAccountItem);
        updateState({ searching: false, accounts: items });
      }
      catch (err) {
        console.log(err);
        updateState({ searching: false, accounts: [] });
      }
    }, 1000);
  }, [handle, server]);

  let setAccountItem = (item) => {
    let { guid, name, handle, node, location, description, imageSet } = item;
    let server = node ? node : profile.state.server;
    let logo = imageSet ? getListingImageUrl(server, guid) : 'avatar';
    let username = node ? `${handle}/${node}` : handle;
    return { guid, name, handle, username, node: server, location, description, guid, imageSet, logo };
  };

  let actions = {};

  return { state, actions };
}
