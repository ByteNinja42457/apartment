import { useState, useEffect, useContext } from 'react';
import { AppContext } from 'context/AppContext';
import { useNavigate } from 'react-router-dom';

export function useProfileIcon() {

  let [state, setState] = useState({
    disconnected: false,
  });

  let navigate = useNavigate();
  let app = useContext(AppContext);

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    let { status } = app.state
    updateState({ disconnected: status === 'disconnected' });
    if (app.state.loggedOut) {
      navigate("/");
    }
  }, [app]);

  let actions = {};

  return { state, actions };
}
