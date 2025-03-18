import { createContext } from 'react';
import { useSettingsContext } from './useSettingsContext.hook';

export let SettingsContext = createContext({});

export function SettingsContextProvider({ children }) {
  let { state, actions } = useSettingsContext();
  return (
    <SettingsContext.Provider value={{ state, actions }}>
      {children}
    </SettingsContext.Provider>
  );
}

