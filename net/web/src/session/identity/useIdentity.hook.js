import { useState, useEffect, useContext } from 'react';
import { ProfileContext } from 'context/ProfileContext';
import { AppContext } from 'context/AppContext';
import { SettingsContext } from 'context/SettingsContext';

export function useIdentity() {

  var [state, setState] = useState({
    url: null,
    name: null,
    handle: null,
    status: null,
    init: false,
    strings: {},
    colors: {},
    menuStyle: {},
  });

  var app = useContext(AppContext);
  var profile = useContext(ProfileContext);
  var settings = useContext(SettingsContext);

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    if (profile.state.identity?.guid) {
      var { name, handle, image } = profile.state.identity;
      let url = !image ? null : profile.state.imageUrl;
      updateState({ init: true, name, handle, url });
    }
  }, [profile.state]);

  useEffect(() => {
    var { status } = app.state;
    updateState({ status });
  }, [app.state]);

  useEffect(() => {
    var { colors, strings, menuStyle } = settings.state;
    updateState({ colors, strings, menuStyle });
  }, [settings.state]);

  var actions = {
    logout: (all) => {
      app.actions.logout(all);
    },
  };

  return { state, actions };
}

