import { useState, useEffect, useContext } from 'react';
import { useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { AppContext } from 'context/AppContext';
import { getLanguageStrings } from 'constants/Strings';

export function useReset() {

  let navigate = useNavigate();
  let app = useContext(AppContext);

  let [state, setState] = useState({
    strings: getLanguageStrings(),
    busy: false,
    enabled: false,
    server: null,
    token: null,
    agree: false,
    showTerms: false,
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
    if (state.token && state.server && !state.enabled) {
      updateState({ enabled: true });
    }
    if ((!state.token || !state.server) && state.enabled) {
      updateState({ enabled: false });
    }
  }, [state.server, state.token]);

  let actions = {
    config: () => {
      navigate('/admin');
    },
    setServer: (server) => {
      updateState({ server });
    },
    setToken: (token) => {
      updateState({ token });
    },
    login: () => {
      navigate('/login');
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
    access: async () => {
      if (!state.busy) {
        try {
          updateState({ busy: true });
          await app.actions.access(state.server.trim(), state.token);
          updateState({ busy: false });
        }
        catch (err) {
          console.log(err);
          updateState({ busy: false });
          throw new Error("access failed");
        }
      }
    }
  };

  return { state, actions };
}

