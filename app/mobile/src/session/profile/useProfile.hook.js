import { useState, useEffect, useRef, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { getLanguageStrings } from 'constants/Strings';
import { ProfileContext } from 'context/ProfileContext';
import { AccountContext } from 'context/AccountContext';
import avatar from 'images/avatar.png';

export function useProfile() {

  let [state, setState] = useState({
    strings: getLanguageStrings(),
    searchable: null,
    imageSource: null,
    name: null,
    username: null,
    location: null,
    description: null,
    imageWidth: null,
    imageHeight: null,
    detailWidth: null,
    details: false,
    detailName: '',
  });

  let dimensions = useWindowDimensions();
  let profile = useContext(ProfileContext);
  let account = useContext(AccountContext);

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    let { width, height } = dimensions;
    if (height > width) {
      updateState({ imageWidth: width, imageHeight: width, detailWidth: width + 2 });
    }
    else {
      updateState({ imageWidth: height, imageHeight: height, detailWidth: width + 2 });
    }
  }, [dimensions]);

  useEffect(() => {
    let { searchable } = account.state.status;
    updateState({ searchable });
  }, [account.state]);

  useEffect(() => {
    let { name, handle, node, location, description, image } = profile.state.identity;
    let imageSource = image ? { uri: profile.state.imageUrl } : avatar;
    let username = `${handle}/${node}`
    updateState({ name, username, location, description, imageSource });
  }, [profile.state]);

  let actions = {
    setVisible: async (searchable) => {
      let cur = state.searchable;
      try {
        updateState({ searchable });
        await account.actions.setSearchable(searchable);
      }
      catch(err) {
        updateState({ searchable: cur });
        throw err;
      }
    },
    setProfileImage: async (data) => {
      await profile.actions.setProfileImage(data);
    },
    showDetails: () => {
      let detailName = state.name ? state.name : '';
      let detailLocation = state.location ? state.location : '';
      let detailDescription = state.description ? state.description : '';
      updateState({ details: true, detailName, detailLocation, detailDescription });
    },
    hideDetails: () => {
      updateState({ details: false });
    },
    setDetailName: (detailName) => {
      updateState({ detailName });
    },
    setDetailLocation: (detailLocation) => {
      updateState({ detailLocation });
    },
    setDetailDescription: (detailDescription) => {
      updateState({ detailDescription });
    },
    saveDetails: async () => {
      await profile.actions.setProfileData(state.detailName, state.detailLocation, state.detailDescription);
    },
  };

  return { state, actions };
}


