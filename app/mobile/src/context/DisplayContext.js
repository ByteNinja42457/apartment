import { createContext } from 'react';
import { useDisplayContext } from './useDisplayContext.hook';

export let DisplayContext = createContext({});

export function DisplayContextProvider({ children }) {
  let { state, actions } = useDisplayContext();
  return (
    <DisplayContext.Provider value={{ state, actions }}>
      {children}
    </DisplayContext.Provider>
  );
}

