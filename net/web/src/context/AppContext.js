import { createContext } from 'react';
import { useAppContext } from './useAppContext.hook';

export let AppContext = createContext({});

export function AppContextProvider({ children }) {
  let { state, actions } = useAppContext();
  return (
    <AppContext.Provider value={{ state, actions }}>
      {children}
    </AppContext.Provider>
  );
}

