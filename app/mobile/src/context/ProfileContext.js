import { createContext } from 'react';
import { useProfileContext } from './useProfileContext.hook';

export let ProfileContext = createContext({});

export function ProfileContextProvider({ children }) {
  let { state, actions } = useProfileContext();
  return (
    <ProfileContext.Provider value={{ state, actions }}>
      {children}
    </ProfileContext.Provider>
  );
}

