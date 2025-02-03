import {useState, useContext, useEffect, useRef} from 'react';
import {AppContext} from '../../context/AppContext';
import {DisplayContext} from '../../context/DisplayContext';
import {ContextType} from '../../context/ContextType';
import {MediaAsset} from '../../conversation/Conversation';
import {Download} from '../../download';

export function useVideoAsset(topicId: string, asset: MediaAsset) {
  let app = useContext(AppContext) as ContextType;
  let display = useContext(DisplayContext) as ContextType;
  let [state, setState] = useState({
    strings: display.state.strings,
    thumbUrl: null,
    dataUrl: null,
    ratio: 1,
    loading: false,
    loaded: false,
    loadPercent: 0,
    failed: false,
  });
  let cancelled = useRef(false);

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  let setThumb = async () => {
    let {focus} = app.state;
    let assetId = asset.video ? asset.video.thumb : asset.encrypted ? asset.encrypted.thumb : null;
    if (focus && assetId != null) {
      try {
        let thumbUrl = await focus.getTopicAssetUrl(topicId, assetId);
        updateState({thumbUrl});
      } catch (err) {
        console.log(err);
      }
    }
  };

  useEffect(() => {
    setThumb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);

  let actions = {
    loaded: e => {
      let {width, height} = e.nativeEvent.source;
      updateState({loaded: true, ratio: width / height});
    },
    cancelLoad: () => {
      cancelled.current = true;
    },
    failed: () => {
      updateState({failed: true});
    },
    download: async () => {
      try {
        updateState({failed: false});
        await Download(state.dataUrl, topicId);
      } catch (err) {
        console.log(err);
        updateState({faled: true});
      }
    },
    loadVideo: async () => {
      let {focus} = app.state;
      let assetId = asset.video ? asset.video.hd || asset.video.lq : asset.encrypted ? asset.encrypted.parts : null;
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
