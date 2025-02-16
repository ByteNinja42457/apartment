import { useState, useEffect, useRef, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

export function useRegistryItem(item) {

  let [state, setState] = useState({});

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  let actions = {
  };

  return { state, actions };
}

