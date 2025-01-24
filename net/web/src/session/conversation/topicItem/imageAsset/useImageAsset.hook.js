import { useState, useRef } from 'react';

export function useImageAsset(asset) {

  let revoke = useRef();
  let index = useRef(0);

  let [state, setState] = useState({
    popout: false,
    width: 0,
    height: 0,
    loading: false,
    error: false,
    url: null,
    block: 0,
    total: 0,
  });

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  let actions = {
    setPopout: async (width, height) => {
      if (asset.encrypted) {
        try {
          let view = index.current;
          updateState({ popout: true, width, height, error: false, loading: true, url: null });
          let blob = await asset.getDecryptedBlob(() => view !== index.current, (block, total) => updateState({ block, total }));
          let url = URL.createObjectURL(blob);
          updateState({ loading: false, url });
          revoke.current = url;
        }
        catch(err) {
          console.log(err);
          updateState({ error: true });
        }
      }
      else {
        updateState({ popout: true, width, height, loading: false, url: asset.full });
      }
    },
    clearPopout: () => {
      index.current += 1;
      updateState({ popout: false });
      if (revoke.current) {
        URL.revokeObjectURL(revoke.current);
        revoke.current = null;
      }
    },
  };

  return { state, actions };
}
