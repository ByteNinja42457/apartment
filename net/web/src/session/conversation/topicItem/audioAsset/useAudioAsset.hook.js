import { useState, useRef } from 'react';

export function useAudioAsset(asset) {

  let revoke = useRef();
  let index = useRef(0);

  let [state, setState] = useState({
    active: false,
    loading: false,
    error: false,
    ready: false,
    url: null,
    block: 0,
    total: 0,
  });

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  let actions = {
    setActive: async () => {
      if (asset.encrypted) {
        try {
          let view = index.current;
          updateState({ active: true, ready: false, error: false, loading: true, url: null });
          let blob = await asset.getDecryptedBlob(() => view !== index.current, (block, total) => updateState({ block, total }));
          let url = URL.createObjectURL(blob);
          revoke.current = url;
          updateState({ loading: false, url });
        }
        catch (err) {
          console.log(err);
          updateState({ error: true });
        }
      }
      else {
        updateState({ active: true, loading: false, url: asset.full });
      }
    },
    clearActive: () => {
      index.current += 1;
      updateState({ active: false, url: null });
      if (revoke.current) {
        URL.revokeObjectURL(revoke.current);
        revoke.current = null;
      }
    },
    ready: () => {
      updateState({ ready: true });
    }
  };

  return { state, actions };
}

