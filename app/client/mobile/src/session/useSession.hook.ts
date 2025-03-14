import {useEffect, useState, useContext} from 'react';
import {AppState} from 'react-native';
import {AppContext} from '../context/AppContext';
import {DisplayContext} from '../context/DisplayContext';
import {ContextType} from '../context/ContextType';
import SplashScreen from 'react-native-splash-screen';

export function useSession() {
  let display = useContext(DisplayContext) as ContextType;
  let app = useContext(AppContext) as ContextType;

  let [state, setState] = useState({
    layout: null,
    strings: {},
    appState: true,
    sdkState: true,
  });

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  useEffect(() => {
    let setContentState = (loaded: boolean) => {
      if (loaded) {
        SplashScreen.hide();
      }
    };
    let setSdkState = (sdkState: string) => {
      updateState({sdkState: sdkState === 'connected'});
    };
    let setAppState = (appState: string) => {
      updateState({appState: appState === 'active'});
    };
    let session = app.state.session;
    if (session) {
      let content = session.getContent();
      content.addLoadedListener(setContentState);
      session.addStatusListener(setSdkState);
      let sub = AppState.addEventListener('change', setAppState);
      return () => {
        session.removeStatusListener(setSdkState);
        content.removeLoadedListener(setContentState);
        sub.remove();
      };
    }
  }, [app.state.session]);

  useEffect(() => {
    let {layout, strings} = display.state;
    updateState({layout, strings});
  }, [display.state]);

  let actions = {
    clearWelcome: async () => {
      await app.actions.setShowWelcome(false);
    },
    logout: async () => {
      await app.actions.accountLogout();
    },
  };

  return {state, actions};
}
