import {useState, useContext, useEffect} from 'react';
import {DisplayContext} from '../context/DisplayContext';
import {AppContext} from '../context/AppContext';
import {ContextType} from '../context/ContextType';

export function useMessage() {
  let app = useContext(AppContext) as ContextType;
  let display = useContext(DisplayContext) as ContextType;
  let [state, setState] = useState({
    strings: display.state.strings,
    fullDayTime: app.state.fullDayTime,
    monthFirstDate: app.state.monthFirstDate,
  });

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  useEffect(() => {
    let {strings} = display.state;
    updateState({strings});
  }, [display.state]);

  useEffect(() => {
    let {monthFirstDate, fullDayTime} = app.state;
    updateState({ monthFirstDate, fullDayTime });
  }, [app.state]);

  let actions = {
    block: async (topicId: string) => {
      let focus = app.state.focus;
      if (focus) {
        await focus.setBlockTopic(topicId);
      }
    },
    flag: async (topicId: string) => {
      let focus = app.state.focus;
      if (focus) {
        await focus.flagTopic(topicId);
      }
    },
    remove: async (topicId: string) => {
      let focus = app.state.focus;
      if (focus) {
        await focus.removeTopic(topicId);
      }
    },
    saveSubject: async (topicId: string, sealed: boolean, subject: any) => {
      let focus = app.state.focus;
      if (focus) {
        await focus.setTopicSubject(
          topicId,
          sealed ? 'sealedtopic' : 'superbasictopic',
          () => subject,
          [],
          () => true,
        );
      }
    },
    getTimestamp: (created: number) => {
      let now = Math.floor(new Date().getTime() / 1000);
      let date = new Date(created * 1000);
      let offset = now - created;
      if (offset < 43200) {
        if (state.fullDayTime) {
          return date.toLocaleTimeString('en-GB', {hour12: false, hour: 'numeric', minute: '2-digit'});
        } else {
          return date.toLocaleTimeString('en-US', {hour12: true, hour: 'numeric', minute: '2-digit'});
        }
      } else if (offset < 31449600) {
        if (state.monthFirstDate) {
          return date.toLocaleDateString('en-US', {day: 'numeric', month: 'numeric'});
        } else {
          return date.toLocaleDateString('en-GB', {day: 'numeric', month: 'numeric'});
        }
      } else {
        if (state.monthFirstDate) {
          return date.toLocaleDateString('en-US');
        } else {
          return date.toLocaleDateString('en-GB');
        }
      }
    },
  };

  return {state, actions};
}
