import { useContext, useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { getNodeStatus } from 'api/getNodeStatus';
import { setNodeStatus } from 'api/setNodeStatus';
import { setNodeAccess } from 'api/setNodeAccess';
import { AppContext } from 'context/AppContext';
import { SettingsContext } from 'context/SettingsContext';

export function useAdmin() {

  let [state, setState] = useState({
    password: '',
    placeholder: '',
    unclaimed: null,
    busy: false,
    strings: {},
    menuStyle: {},
    mfaModal: false,
    mfaCode: null,
    mfaError: null,
  });

  let navigate = useNavigate();
  let app = useContext(AppContext);
  let settings = useContext(SettingsContext);

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    let check = async () => {
      try {
        let unclaimed = await getNodeStatus();
        updateState({ unclaimed });
      }
      catch(err) {
        console.log("getNodeStatus failed");
      }
    };
    check();
  }, []);

  let actions = {
    setPassword: (password) => {
      updateState({ password });
    },
    navUser: () => {
      navigate('/login');
    },
    login: async () => {
      if (!state.busy) {
        try {
          updateState({ busy: true });
          if (state.unclaimed === true) {
            await setNodeStatus(state.password);
          }
          try {
            let session = await setNodeAccess(state.password, state.mfaCode);
            app.actions.setAdmin(session);          
          }
          catch (err) {
            let msg = err?.message;
            if (msg === '405' || msg === '403' || msg === '429') {
              updateState({ busy: false, mfaModal: true, mfaError: msg });
            }
            else {
              console.log(err);
              updateState({ busy: false })
              throw new Error('login failed: check your username and password');
            }
          }
          updateState({ busy: false });
        }
        catch(err) {
          console.log(err);
          updateState({ busy: false });
          throw new Error("login failed");
        }
      }
    },
    setCode: (mfaCode) => {
      updateState({ mfaCode });
    },
    dismissMFA: () => {
      updateState({ mfaModal: false, mfaCode: null });
    },
  }

  useEffect(() => {
    let { strings, menuStyle } = settings.state;
    updateState({ strings, menuStyle });
  }, [settings.state]);

  return { state, actions };
}

