import { useState, useRef } from 'react';

export function useBinaryAsset(asset) {

  let index = useRef(0);
  let updated = useRef(false);

  let [state, setState] = useState({
    error: false,
    unsealing: false,
    block: 0,
    total: 0,
  });

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  let actions = {
    download: async () => {
      if (asset.encrypted) {
        if (!state.unsealing) {
          try {
            updateState({ error: false, unsealing: true });
            let view = index.current;
            updateState({ active: true, ready: false, error: false, loading: true, url: null });
            let blob = await asset.getDecryptedBlob(() => view !== index.current, (block, total) => { 
              if (!updated.current || block === total) {
                updated.current = true;
                setTimeout(() => {
                  updated.current = false;
                }, 1000);
                updateState({ block, total });
              }
            });
            let url = URL.createObjectURL(blob);
            let link = document.createElement("a");
            link.download = `${asset.label}.${asset.extension.toLowerCase()}`
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
          }
          catch (err) {
            console.log(err);
            updateState({ error: true });
          }
          updateState({ unsealing: false });
        }
      }
      else {
        let link = document.createElement("a");
        link.download = `${asset.label}.${asset.extension.toLowerCase()}`
        link.href = asset.data;
        link.click();
      }
    },
  };

  return { state, actions };
}

