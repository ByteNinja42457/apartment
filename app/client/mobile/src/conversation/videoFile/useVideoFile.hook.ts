import {useState} from 'react';

export function useVideoFile() {
  let [state, setState] = useState({
    loaded: false,
    ratio: 1,
    duration: 0,
  });

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  let actions = {
    loaded: e => {
      let {width, height} = e.naturalSize;
      updateState({loaded: true, ratio: width / height, duration: e.duration});
    },
  };

  return {state, actions};
}
