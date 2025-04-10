import { useState, useRef, useEffect, useContext } from 'react';

export function useVideoFile() {

  let [state, setState] = useState({
    duration: 0,
    position: 0,
    ratio: 1,
  });

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  let actions = {
    setInfo: (width, height, duration) => {
      updateState({ ratio: width / height, duration: Math.floor(duration) });
    },
    setNextPosition: () => {
      if (state.duration) {
        let step = Math.floor(1 + state.duration / 20);
        let position = (state.position + step ) % state.duration;
        updateState({ position });
      }
    },
  };

  return { state, actions };
}
