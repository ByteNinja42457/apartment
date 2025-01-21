import { useContext, useState, useEffect } from 'react';
import { AppContext } from 'context/AppContext';
import { useNavigate } from 'react-router-dom'

export function useRoot() {

  let [state, setState] = useState({});
  let app = useContext(AppContext);
  let navigate = useNavigate();

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    if (app.state.session === true) {
      navigate('/session');
    }
    if (app.state.session === false) {
      navigate('/login');
    }
  }, [app.state]);

  let actions = {
  };

  return { state, actions };
}

