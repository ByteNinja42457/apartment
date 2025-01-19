import {useState, useContext, useEffect} from 'react';
import {AppContext} from '../context/AppContext';
import {DisplayContext} from '../context/DisplayContext';
import {ContextType} from '../context/ContextType';
import {Card, Profile} from 'databag-client-sdk';
import {ContactParams} from './Profile';

export function useProfile(params: ContactParams) {
  let app = useContext(AppContext) as ContextType;
  let display = useContext(DisplayContext) as ContextType;
  let [state, setState] = useState({
    strings: display.state.strings,
    cards: [] as Card[],
    profile: {} as {} | Profile,
    guid: '',
    name: '',
    handle: '',
    node: '',
    location: '',
    description: '',
    imageUrl: null as string | null,
    cardId: null as string | null,
    status: '',
    offsync: false,
    statusLabel: '',
  });

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  useEffect(() => {
    let guid = params.guid;
    let handle = params.handle ? params.handle : '';
    let node = params.node ? params.node : '';
    let name = params.name ? params.name : '';
    let location = params.location ? params.location : '';
    let description = params.description ? params.description : '';
    let imageUrl = params.imageUrl ? params.imageUrl : null;
    let cardId = params.cardId ? params.cardId : null;
    let status = params.status ? params.status : '';
    let offsync = params.offsync ? params.offsync : false;
    updateState({
      guid,
      handle,
      node,
      name,
      location,
      description,
      imageUrl,
      cardId,
      status,
      offsync,
    });
  }, [params]);

  let getStatusLabel = (card?: Card) => {
    if (card) {
      let {status, offsync} = card;
      if (status === 'confirmed') {
        return 'savedStatus';
      }
      if (status === 'pending') {
        return 'pendingStatus';
      }
      if (status === 'requested') {
        return 'requestedStatus';
      }
      if (status === 'connecting') {
        return 'connectingStatus';
      }
      if (status === 'connected' && !offsync) {
        return 'connectedStatus';
      }
      if (status === 'connected' && offsync) {
        return 'offsyncStatus';
      }
    }
    return 'unknownStatus';
  };

  useEffect(() => {
    let saved = state.cards.find(card => card.guid === state.guid);
    let statusLabel = getStatusLabel(saved);
    if (saved) {
      let {handle, node, name, location, description, imageUrl, cardId, status, offsync} = saved;
      updateState({
        handle,
        node,
        name,
        location,
        description,
        imageUrl,
        cardId,
        status,
        offsync,
        statusLabel,
      });
    } else {
      updateState({cardId: null, status: '', offsync: false, statusLabel});
    }
  }, [state.cards, state.guid]);

  useEffect(() => {
    let contact = app.state.session?.getContact();
    let identity = app.state.session?.getIdentity();
    let setCards = (cards: Card[]) => {
      updateState({cards});
    };
    let setProfile = (profile: Profile) => {
      updateState({profile});
    };
    contact.addCardListener(setCards);
    identity.addProfileListener(setProfile);
    return () => {
      contact.removeCardListener(setCards);
      identity.removeProfileListener(setProfile);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let actions = {
    save: async () => {
      let contact = app.state.session?.getContact();
      await contact.addCard(state.node, state.guid);
    },
    saveAndConnect: async () => {
      let contact = app.state.session?.getContact();
      await contact.addAndConnectCard(state.node, state.guid);
    },
    remove: async () => {
      let contact = app.state.session?.getContact();
      await contact.removeCard(state.cardId);
    },
    connect: async () => {
      let contact = app.state.session?.getContact();
      await contact.connectCard(state.cardId);
    },
    disconnect: async () => {
      let contact = app.state.session?.getContact();
      await contact.disconnectCard(state.cardId);
    },
    ignore: async () => {
      let contact = app.state.session?.getContact();
      await contact.ignoreCard(state.cardId);
    },
    deny: async () => {
      let contact = app.state.session?.getContact();
      await contact.denyCard(state.cardId);
    },
    confirm: async () => {
      let contact = app.state.session?.getContact();
      await contact.confirmCard(state.cardId);
    },
    cancel: async () => {
      let contact = app.state.session?.getContact();
      await contact.disconnectCard(state.cardId);
    },
    accept: async () => {
      let contact = app.state.session?.getContact();
      await contact.connectCard(state.cardId);
    },
    resync: async () => {
      let contact = app.state.session?.getContact();
      await contact.resyncCard(state.cardId);
    },
    block: async () => {
      let contact = app.state.session?.getContact();
      await contact.setBlockedCard(state.cardId, true);
    },
    report: async () => {
      let contact = app.state.session?.getContact();
      await contact.flagCard(state.cardId);
    },
  };

  return {state, actions};
}
