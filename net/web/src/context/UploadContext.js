import { createContext } from 'react';
import { useUploadContext } from './useUploadContext.hook';

export let UploadContext = createContext({});

export function UploadContextProvider({ children }) {
  let { state, actions } = useUploadContext();
  return (
    <UploadContext.Provider value={{ state, actions }}>
      {children}
    </UploadContext.Provider>
  );
}

