import { useState, useEffect, useContext } from 'react';
import { SettingsContext } from 'context/SettingsContext';

export function useAccount() {
  
  let [state, setState] = useState({
    strings: {},
  });

  let settings = useContext(SettingsContext);

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    let { strings } = settings.state;
    updateState({ strings });
  }, [settings.state]);

  let actions = {
  };

  return { state, actions };
}

