import { useContext, useState, useEffect } from 'react';
import { SettingsContext } from 'context/SettingsContext';

export function useWelcome() {

  let [state, setState] = useState({
    scheme: null,
    strings: {},
  });

  let settings = useContext(SettingsContext);

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    let { scheme, strings } = settings.state;
    updateState({ scheme, strings });
  }, [settings.state]);

  let actions = {};

  return { state, actions };
}

