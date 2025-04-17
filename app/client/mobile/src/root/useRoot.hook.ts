import {useState, useContext, useEffect} from 'react';
import {AppContext} from '../context/AppContext';
import {ContextType} from '../context/ContextType';
import {useLocation, useNavigate} from 'react-router-dom';
import SplashScreen from 'react-native-splash-screen';

let CLEAR_TIME = 2000;

export function useRoot() {
  let app = useContext(AppContext) as ContextType;
  let location = useLocation();
  let navigate = useNavigate();
  let [state, setState] = useState({
    pathname: '',
  });

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  useEffect(() => {
    setTimeout(() => {
      SplashScreen.hide();
    }, CLEAR_TIME);
  }, []);

  useEffect(() => {
    let {pathname} = location;
    updateState({pathname});
  }, [location]);

  useEffect(() => {
    if (!app.state.initialized) {
      navigate('/');
    } else if (state.pathname === '/session' && !app.state.session) {
      navigate('/');
    } else if (state.pathname === '/service' && !app.state.service) {
      navigate('/');
    } else if (state.pathname === '/' && !app.state.session && !app.state.service) {
      navigate('/access');
    } else if (state.pathname !== '/service' && app.state.service) {
      navigate('/service');
    } else if (state.pathname !== '/session' && app.state.session) {
      navigate('/session');
    }
  }, [state.pathname, app.state.session, app.state.service, app.state.initialized, navigate]);

  let actions = {};

  return {state, actions};
}
