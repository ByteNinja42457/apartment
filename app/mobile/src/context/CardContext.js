import { createContext } from 'react';
import { useCardContext } from './useCardContext.hook';

export let CardContext = createContext({});

export function CardContextProvider({ children }) {
  let { state, actions } = useCardContext();
  return (
    <CardContext.Provider value={{ state, actions }}>
      {children}
    </CardContext.Provider>
  );
}

