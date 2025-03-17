import { useState, useRef, useEffect, useContext } from 'react';
import { ConversationContext } from 'context/ConversationContext';
import { Image } from 'react-native';

export function useVideoThumb() {

  let [state, setState] = useState({
    ratio: 1,
  });

  let conversation = useContext(ConversationContext);

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  let actions = {
    loaded: (e) => {
      let { width, height } = e.nativeEvent.source;
      updateState({ loaded: true, ratio: width / height });
    },
  };

  return { state, actions };
}

