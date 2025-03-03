import { createContext } from 'react';
import { useChannelContext } from './useChannelContext.hook';

export let ChannelContext = createContext({});

export function ChannelContextProvider({ children }) {
  let { state, actions } = useChannelContext();
  return (
    <ChannelContext.Provider value={{ state, actions }}>
      {children}
    </ChannelContext.Provider>
  );
}

