import { useEffect, useState } from 'react';

export function useStoreContext() {

  let [state, setState] = useState({});

  let resetState = () => {
    setState((s) => {
      localStorage.setItem('store', JSON.stringify({}));
      return {}
    });
  };

  let updateState = (value) => {
    setState((s) => {
      let store = { ...s, ...value };
      localStorage.setItem('store', JSON.stringify(store));
      return store;
    });
  };

  useEffect(() => {
    let store = localStorage.getItem('store');
    if (store != null) {
      updateState({ ...JSON.parse(store) });
    }
  }, []);

  let actions = {
    clear: () => {
      resetState();
    },
    setValue: (key, value) => {
      updateState({ [key]: value });
    },
    getValue: (key) => {
      return state[key];
    }
  }

  return { state, actions }
}


