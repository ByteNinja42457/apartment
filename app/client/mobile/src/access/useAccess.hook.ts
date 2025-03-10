import {useRef, useState, useContext, useEffect} from 'react';
import {DisplayContext} from '../context/DisplayContext';
import {AppContext} from '../context/AppContext';
import {ContextType} from '../context/ContextType';
import SplashScreen from 'react-native-splash-screen';

export function useAccess() {
  let debounceAvailable = useRef(setTimeout(() => {}, 0));
  let debounceTaken = useRef(setTimeout(() => {}, 0));
  let app = useContext(AppContext) as ContextType;
  let display = useContext(DisplayContext) as ContextType;
  let [state, setState] = useState({
    layout: null,
    strings: {},
    mode: 'account',
    username: '',
    handle: '',
    password: '',
    confirm: '',
    token: '',
    code: '',
    loading: false,
    secure: false,
    node: '',
    available: 0,
    taken: false,
  });

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  useEffect(() => {
    SplashScreen.hide();
  }, []);

  useEffect(() => {
    let {username, token, node, secure, mode} = state;
    if (mode === 'create') {
      checkTaken(username, token, node, secure);
      getAvailable(node, secure);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mode, state.username, state.token, state.node, state.secure]);

  let getAvailable = (node: string, secure: boolean) => {
    clearTimeout(debounceAvailable.current);
    debounceAvailable.current = setTimeout(async () => {
      try {
        if (node) {
          let available = await app.actions.getAvailable(node, secure);
          updateState({available});
        } else {
          updateState({available: 0});
        }
      } catch (err) {
        console.log(err);
        updateState({available: 0});
      }
    }, 2000);
  };

  let checkTaken = (username: string, token: string, node: string, secure: boolean) => {
    updateState({taken: false});
    clearTimeout(debounceTaken.current);
    debounceTaken.current = setTimeout(async () => {
      try {
        if (node && username) {
          let available = await app.actions.getUsername(username, token, node, secure);
          updateState({taken: !available});
        } else {
          updateState({taken: false});
        }
      } catch (err) {
        console.log(err);
        updateState({taken: false});
      }
    }, 2000);
  };

  useEffect(() => {
    let {layout, strings} = display.state;
    updateState({layout, strings});
  }, [display.state]);

  let actions = {
    setMode: (mode: string) => {
      updateState({mode});
    },
    setUsername: (username: string) => {
      updateState({username});
    },
    setPassword: (password: string) => {
      updateState({password});
    },
    setConfirm: (confirm: string) => {
      updateState({confirm});
    },
    setToken: (token: string) => {
      updateState({token});
    },
    setCode: (code: string) => {
      updateState({code});
    },
    setNode: (node: string) => {
      let insecure = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|:\d+$|$)){4}$/.test(node);
      updateState({node, secure: !insecure});
    },
    setLoading: (loading: boolean) => {
      updateState({loading});
    },
    accountLogin: async () => {
      let {username, password, node, secure, code} = state;
      await app.actions.accountLogin(username, password, node, secure, code);
    },
    accountCreate: async () => {
      let {username, password, node, secure, token} = state;
      await app.actions.accountCreate(username, password, node, secure, token);
    },
    accountAccess: async () => {
      let {node, secure, token} = state;
      await app.actions.accountAccess(node, secure, token);
    },
    adminLogin: async () => {
      let {password, node, secure, code} = state;
      await app.actions.adminLogin(password, node, secure, code);
    },
  };

  return {state, actions};
}
