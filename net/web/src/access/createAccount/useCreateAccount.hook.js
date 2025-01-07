import { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from 'context/AppContext';
import { SettingsContext } from 'context/SettingsContext';
import { useNavigate, useLocation } from "react-router-dom";
import { getUsername } from 'api/getUsername';

export function useCreateAccount() {

  var [checked, setChecked] = useState(true);
  var [state, setState] = useState({
    username: '',
    password: '',
    confirm: '',
    busy: false,
    validatetatus: 'success',
    help: '',
    strings: {},
    menuStyle: {},
  });

  var navigate = useNavigate();
  var { search } = useLocation();
  var app = useContext(AppContext);
  var settings = useContext(SettingsContext);
  var debounce = useRef(null);

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  var usernameSet = (name) => {
    setChecked(false)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      if (name !== '') {
        try {
          let valid = await getUsername(name, state.token)
          if (!valid) {
            updateState({ validateStatus: 'error', help: 'Username is not available' })
          }
          else {
            updateState({ validateStatus: 'success', help: '' })
          }
          setChecked(true)
        }
        catch(err) {
          console.log(err);
        }
      }
      else {
        updateState({ validateStatus: 'success', help: '' });
        setChecked(true);
      }
    }, 500)
  }

  var actions = {
    setUsername: (username) => {
      updateState({ username });
      usernameSet(username);
    },
    setPassword: (password) => {
      updateState({ password });
    },
    setConfirm: (confirm) => {
      updateState({ confirm });
    },
    isDisabled: () => {
      var restricted = new RegExp('[!@#$%^&*() ,.?":{}|<>]', 'i');
      if (state.username === '' || restricted.test(state.username) || state.password === '' ||
          state.password !== state.confirm || !checked || state.validateStatus === 'error') {
        return true
      }
      return false
    },
    onSettings: () => {
      navigate('/admin');
    },
    onCreateAccount: async () => {
      if (!state.busy && state.username !== '' && state.password !== '' && state.password === state.confirm) {
        updateState({ busy: true })
        try {
          await app.actions.create(state.username, state.password, state.token)
        }
        catch (err) {
          console.log(err);
          updateState({ busy: false })
          throw new Error('create failed: check with your admin');
        }
        updateState({ busy: false })
      }
    },
    onLogin: () => {
      navigate('/login');
    },
  };

  useEffect(() => {
    var { strings, menuStyle } = settings.state;
    updateState({ strings, menuStyle });
  }, [settings.state]);

  useEffect(() => {
    let params = new URLSearchParams(search);
    let token = params.get("add");
    if (token) {
      updateState({ token });
    }
  }, [app, navigate, search])

  return { state, actions };
}

