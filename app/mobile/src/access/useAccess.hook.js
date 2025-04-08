import { useState, useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import config from 'constants/Config';

export function useAccess() {

  let [state, setState] = useState({
    split: null,
  });
  let dimensions = useWindowDimensions();

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    if (dimensions.width > config.tabbedWidth) {
      updateState({ split: true });
    }
    else {
      updateState({ split: false });
    }
  }, [dimensions]);

  let actions = {
  };

  return { state, actions };
}

