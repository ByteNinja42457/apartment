import { useState, useEffect, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { AppContext } from 'context/AppContext';
import { getLanguageStrings } from 'constants/Strings';

export function useLogin() {

  let navigate = useNavigate();
  let app = useContext(AppContext);

  let [state, setState] = useState({
    strings: getLanguageStrings(),
    busy: false,
    enabled: false,
    login: null,
    password: null,
    showPassword: false,
    agree: false,
    showTerms: false,
    mfaModal: false,
    mfaCode: '',
    mfaError: null,
  });

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    if (app.state.session) {
      navigate('/session');
    }
  }, [app.state.session]);

  useEffect(() => {
    if (state.password && state.login && !state.enabled && (state.login.includes('@') || state.login.includes('/'))) {
      updateState({ enabled: true });
    }
    if ((!state.password || !state.login || (!state.login.includes('@') && !state.login.includes('/'))) && state.enabled) {
      updateState({ enabled: false });
    }
  }, [state.login, state.password]);

  let actions = {
    config: () => {
      navigate('/admin');
    },
    setLogin: (login) => {
      updateState({ login });
    },
    setPassword: (password) => {
      updateState({ password });
    },
    create: () => {
      navigate('/create');
    },
    reset: () => {
      navigate('/reset');
    },
    showPassword: () => {
      updateState({ showPassword: true });
    },
    hidePassword: () => {
      updateState({ showPassword: false });
    },
    showTerms: () => {
      updateState({ showTerms: true });
    },
    hideTerms: () => {
      updateState({ showTerms: false });
    },
    agree: (agree) => {
      updateState({ agree });
    },
    login: async () => {
      if (!state.busy) {
        updateState({ busy: true });
        try {
          await app.actions.login(state.login.trim(), state.password, state.mfaCode);
        }
        catch (err) {
console.log(err);
          if (err.message == '405' || err.message == '403' || err.message == '429') {
            updateState({ mfaModal: true, mfaError: err.message });
          }
          else {
            console.log(err.message);
            updateState({ busy: false, showAlert: true });
            throw new Error('login failed');
          }
        }
        updateState({ busy: false });
      }
    },
    setCode: (mfaCode) => {
      updateState({ mfaCode });
    },
    dismissMFA: () => {
      updateState({ mfaModal: false });
    },
  };

  return { state, actions };
}
