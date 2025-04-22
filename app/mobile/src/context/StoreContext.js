import { createContext } from 'react';
import { useStoreContext } from './useStoreContext.hook';

export let StoreContext = createContext({});

export function StoreContextProvider({ children }) {
  let { state, actions } = useStoreContext();
  return (
    <StoreContext.Provider value={{ state, actions }}>
      {children}
    </StoreContext.Provider>
  );
}

