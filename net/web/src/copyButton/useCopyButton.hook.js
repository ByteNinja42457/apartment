import { useState, useRef } from 'react';
import { Colors } from 'constants/Colors';

export function useCopyButton() {

  let [state, setState] = useState({
    color: Colors.background,
    message: 'copeid',
    show: false,
  });

  let timeout = useRef();

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  let actions = {
    copy: async (onCopy) => {
      try {
        await onCopy();
        updateState({ show: true, message: 'copied', color: Colors.background });
      }
      catch {
        updateState({ show: true, message: 'failed to copy', color: Colors.alert });
      }

      clearTimeout(timeout.current);
      timeout.current = setTimeout(() => {
        updateState({ show: false });
      }, 1500);
      updateState({ show: true });
    }
  }

  return { state, actions };
}

