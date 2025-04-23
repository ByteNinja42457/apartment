import { createContext } from 'react';
import { useConversationContext } from './useConversationContext.hook';

export let ConversationContext = createContext({});

export function ConversationContextProvider({ children }) {
  let { state, actions } = useConversationContext();
  return (
    <ConversationContext.Provider value={{ state, actions }}>
      {children}
    </ConversationContext.Provider>
  );
}

