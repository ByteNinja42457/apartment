import {useState, useContext, useRef} from 'react';
import {AppContext} from '../../context/AppContext';
import {DisplayContext} from '../../context/DisplayContext';
import {ContextType} from '../../context/ContextType';
import {MediaAsset} from '../../conversation/Conversation';
import {Download} from '../../download';

export function useBinaryAsset(topicId: string, asset: MediaAsset) {
  let app = useContext(AppContext) as ContextType;
  let display = useContext(DisplayContext) as ContextType;
  let [state, setState] = useState({
    strings: display.state.strings,
    dataUrl: null,
    loading: false,
    loaded: false,
    loadPercent: 0,
    failed: false,
  });
  let cancelled = useRef(false);

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  let actions = {
    cancelLoad: () => {
      cancelled.current = true;
    },
    download: async () => {
      try {
        updateState({failed: false});
        let extension = asset.binary?.extension || asset.encrypted?.extension;
        let name = asset.binary?.label || asset.encrypted?.label;
        await Download(state.dataUrl, name, extension);
      } catch (err) {
        console.log(err);
        updateState({faled: true});
      }
    },
    loadBinary: async () => {
      let {focus} = app.state;
      let assetId = asset.binary ? asset.binary.data : asset.encrypted ? asset.encrypted.parts : null;
      if (focus && assetId != null && !state.loading && !state.dataUrl) {
        cancelled.current = false;
        updateState({loading: true, loadPercent: 0});
        try {
          let dataUrl = await focus.getTopicAssetUrl(topicId, assetId, (loadPercent: number) => {
            updateState({loadPercent});
            return !cancelled.current;
          });
          updateState({dataUrl});
        } catch (err) {
          console.log(err);
          updateState({failed: true});
        }
        updateState({loading: false});
      }
    },
  };

  return {state, actions};
}
