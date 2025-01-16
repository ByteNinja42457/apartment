import {useContext} from 'react';
import {AppContext} from '../context/AppContext';
import {DisplayContext} from '../context/DisplayContext';
import {ContextType} from '../context/ContextType';

export function useSelector() {
  let app = useContext(AppContext) as ContextType;
  let display = useContext(DisplayContext) as ContextType;

  let state = {
    strings: display.state.strings,
  };

  let actions = {
    clearFocus: app.actions.clearFocus,
  };

  return {state, actions};
}
