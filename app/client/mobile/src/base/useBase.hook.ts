import {useState, useContext, useEffect} from 'react';
import {DisplayContext} from '../context/DisplayContext';
import {AppContext} from '../context/AppContext';
import {ContextType} from '../context/ContextType';

export function useBase() {
  let app = useContext(AppContext) as ContextType;
  let display = useContext(DisplayContext) as ContextType;
  let [state, setState] = useState({
    strings: display.state.strings,
    profileSet: null as null | boolean,
    cardSet: null as null | boolean,
    channelSet: null as null | boolean,
  });

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  useEffect(() => {
    let setProfile = (profile: Profile) => {
      updateState({profileSet: Boolean(profile.name)});
    };
    let setCards = (cards: Card[]) => {
      updateState({cardSet: cards.length > 0});
    };
    let setChannels = ({channels, cardId}: {channels: Channel[]; cardId: string | null}) => {
      updateState({channelSet: cardId && channels.length > 0});
    };

    if (app.state.session) {
      let {identity, contact, content} = app.state.session;
      identity.addProfileListener(setProfile);
      contact.addCardListener(setCards);
      content.addChannelListener(setChannels);

      return () => {
        identity.removeProfileListener(setProfile);
        contact.removeCardListener(setCards);
        content.removeChannelListener(setChannels);
      };
    }
  }, [app.state.session]);

  let actions = {};

  return {state, actions};
}
