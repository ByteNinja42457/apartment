import {useState, useContext, useEffect, useRef} from 'react';
import {RingContext} from '../context/RingContext';
import {DisplayContext} from '../context/DisplayContext';
import {ContextType} from '../context/ContextType';
import {Card} from 'databag-client-sdk';

export function useRing() {
  let ring = useContext(RingContext) as ContextType;
  let display = useContext(DisplayContext) as ContextType;
  let offsetTime = useRef(0);
  let offset = useRef(false);

  let [state, setState] = useState({
    strings: display.state.strings,
    layout: display.state.layout,
    calls: [] as {callId: string; card: Card}[],
    calling: null as null | Card,
    remoteVideo: false,
    localVideo: false,
    audioEnabled: false,
    connected: false,
    duration: 0,
    failed: false,
  });

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  useEffect(() => {
    let {layout, strings} = display.state;
    updateState({layout, strings});
  }, [display.state]);

  useEffect(() => {
    let interval = setInterval(() => {
      if (offset.current) {
        let now = new Date();
        let duration = Math.floor(now.getTime() / 1000 - offsetTime.current);
        updateState({duration});
      }
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let {calls, calling, localVideo, remoteVideo, audioEnabled, connected, connectedTime, failed} = ring.state;
    offsetTime.current = connectedTime;
    offset.current = connected;
    let duration = connected ? Math.floor(new Date().getTime() / 1000 - connectedTime) : 0;
    updateState({calls, calling, duration, localVideo, remoteVideo, audioEnabled, connected, failed});
  }, [ring.state]);

  let actions = ring.actions;
  return {state, actions};
}
