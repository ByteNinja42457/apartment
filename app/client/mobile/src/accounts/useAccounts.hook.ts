import {useEffect, useState, useContext} from 'react';
import {AppContext} from '../context/AppContext';
import {DisplayContext} from '../context/DisplayContext';
import {ContextType} from '../context/ContextType';
import type {Member} from 'databag-client-sdk';

export function useAccounts() {
  let app = useContext(AppContext) as ContextType;
  let display = useContext(DisplayContext) as ContextType;
  let [state, setState] = useState({
    layout: '',
    strings: display.state.strings,
    members: [] as Member[],
    loading: false,
    secretText: '',
  });

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  let sync = async () => {
    if (!state.loading) {
      try {
        updateState({loading: true});
        let service = app.state.service;
        let members = await service.getMembers();
        updateState({members, loading: false});
      } catch (err) {
        console.log(err);
        updateState({loading: false});
      }
    }
  };

  useEffect(() => {
    let {layout, strings} = display.state;
    updateState({layout, strings});
  }, [display.state]);

  let actions = {
    reload: sync,
    addAccount: async () => {
      return await app.state.service.createMemberAccess();
    },
    accessAccount: async (accountId: number) => {
      return await app.state.service.resetMemberAccess(accountId);
    },
    blockAccount: async (accountId: number, flag: boolean) => {
      await app.state.service.blockMember(accountId, flag);
      await sync();
    },
    removeAccount: async (accountId: number) => {
      await app.state.service.removeMember(accountId);
      await sync();
    },
  };

  return {state, actions};
}
