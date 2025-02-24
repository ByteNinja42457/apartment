import { useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { AppContext } from 'context/AppContext';
import { SettingsContext } from 'context/SettingsContext';

export function useAccess() {

  var [state, setState] = useState({
    display: null,
    scheme: null,
    colors: {},
    theme: null,
    themes: [],
    language: null,
    languages: [],
    strings: {},
  });

  var navigate = useNavigate();
  var location = useLocation();
  var app = useContext(AppContext);
  var settings = useContext(SettingsContext);

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    if (app.state.status || app.state.adminToken) {
      navigate('/');
    }
  }, [app.state, navigate]);

  useEffect(() => {
    let params = new URLSearchParams(location);
    let token = params.get("access");
    if (token) {
      var access = async () => {
        try {
          await app.actions.access(token)
        }
        catch (err) {
          console.log(err);
        }
      }
      access();
    }
    // eslint-disable-next-line
  }, [navigate, location]);


  useEffect(() => {
    var { theme, themes, strings, language, languages, colors, display, scheme } = settings.state;
    updateState({ theme, themes, language, languages, strings, colors, display, scheme });
  }, [settings.state]);

  var actions = {
    setTheme: (theme) => {
      settings.actions.setTheme(theme);
    },
    setLanguage: (language) => {
      settings.actions.setLanguage(language);
    },
  };

  return { state, actions };
}

