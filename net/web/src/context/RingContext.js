import { createContext } from 'react';
import { useRingContext } from './useRingContext.hook';

export let RingContext = createContext({});

export function RingContextProvider({ children }) {
  let { state, actions } = useRingContext();
  return (
    <RingContext.Provider value={{ state, actions }}>
      {children}
    </RingContext.Provider>
  );
}

