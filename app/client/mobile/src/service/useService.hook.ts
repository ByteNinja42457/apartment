import {useEffect, useState, useContext} from 'react';
import {AppContext} from '../context/AppContext';
import {DisplayContext} from '../context/DisplayContext';
import {ContextType} from '../context/ContextType';

export function useService() {
  let display = useContext(DisplayContext) as ContextType;
  let app = useContext(AppContext) as ContextType;

  let [state, setState] = useState({
    layout: null,
    strings: {},
  });

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  useEffect(() => {
    let {layout, strings} = display.state;
    updateState({layout, strings});
  }, [display.state]);

  let actions = {
    logout: async () => {
      await app.actions.adminLogout();
    },
  };

  return {state, actions};
}
