import { useState, useRef, useEffect, useContext } from 'react';
import { ConversationContext } from 'context/ConversationContext';
import { Image } from 'react-native';

export function useImageThumb() {

  let [state, setState] = useState({
    loaded: false,
    ratio: 1,
    url: null,
  });

  let conversation = useContext(ConversationContext);

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  let actions = {
    loaded: (e) => {
      let { width, height } = e.nativeEvent;
      updateState({ loaded: true, ratio: width / height });
    },
  };

  return { state, actions };
}

