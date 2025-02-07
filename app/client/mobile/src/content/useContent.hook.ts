import {useState, useContext, useEffect, useRef} from 'react';
import {AppContext} from '../context/AppContext';
import {DisplayContext} from '../context/DisplayContext';
import {ContextType} from '../context/ContextType';
import {Channel, Card, Profile, Config} from 'databag-client-sdk';
import {notes, unknown, iii_group, iiii_group, iiiii_group, group} from '../constants/Icons';

type ChannelParams = {
  cardId: string;
  channelId: string;
  focused: boolean;
  sealed: boolean;
  hosted: boolean;
  unread: boolean;
  imageUrl: string;
  subject: (string | null)[];
  message: string;
};

export function useContent() {
  let cardChannels = useRef(new Map<string | null, Channel[]>());
  let app = useContext(AppContext) as ContextType;
  let display = useContext(DisplayContext) as ContextType;
  let [state, setState] = useState({
    strings: display.state.strings,
    layout: null,
    guid: '',
    cards: [] as Card[],
    connected: [] as Card[],
    sealable: [] as Card[],
    sorted: [] as Channel[],
    channels: [] as ChannelParams[],
    filtered: [] as ChannelParams[],
    filter: '',
    topic: '',
    sealSet: false,
    focused: null as null | {cardId: null | string; channelId: string},
  });

  let compare = (a: Card, b: Card) => {
    let aval = `${a.handle}/${a.node}`;
    let bval = `${b.handle}/${b.node}`;
    if (aval < bval) {
      return 1;
    } else if (aval > bval) {
      return -1;
    }
    return 0;
  };

  let updateState = (value: any) => {
    setState(s => ({...s, ...value}));
  };

  useEffect(() => {
    let {layout} = display.state;
    updateState({layout});
  }, [display.state]);

  useEffect(() => {
    let channels = state.sorted.map(channel => {
      let {cardId, channelId, unread, sealed, members, data, lastTopic} = channel;
      let contacts = [] as (Card | undefined)[];
      if (cardId) {
        let card = state.cards.find(contact => contact.cardId === cardId);
        if (card) {
          contacts.push(card);
        }
      }
      let guests = members.filter(contact => contact.guid !== state.guid);
      let guestCards = guests
        .map(contact => state.cards.find(card => card.guid === contact.guid))
        .sort((a, b) => {
          if (!a && !b) {
            return 0;
          } else if (!a) {
            return 1;
          } else if (!b) {
            return -1;
          } else if (a.handle > b.handle) {
            return 1;
          } else {
            return 0;
          }
        });
      contacts.push(...guestCards);

      let buildSubject = () => {
        if (contacts.length === 0) {
          return [];
        }
        return contacts.map(contact => (contact ? contact.handle : null));
      };

      let selectImage = () => {
        if (contacts.length === 0) {
          return notes;
        } else if (contacts.length === 1) {
          if (contacts[0]) {
            return contacts[0].imageUrl;
          } else {
            return unknown;
          }
        } else if (contacts.length === 2) {
          return iii_group;
        } else if (contacts.length === 3) {
          return iiii_group;
        } else if (contacts.length === 4) {
          return iiiii_group;
        } else {
          return group;
        }
      };

      let getMessage = () => {
        if (!lastTopic || !lastTopic.status) {
          return '';
        }
        if (lastTopic.dataType === 'superbasictopic') {
          if (lastTopic.data?.text) {
            return lastTopic.data.text;
          } else {
            return '';
          }
        } else if (lastTopic.dataType === 'sealedtopic') {
          if (lastTopic.data) {
            if (lastTopic.data?.text) {
              return lastTopic.data.text;
            } else {
              return '';
            }
          } else {
            return null;
          }
        }
      };

      let focused = state.focused?.cardId === cardId && state.focused?.channelId === channelId;
      let hosted = cardId == null;
      let subject = data?.subject ? [data.subject] : buildSubject();
      let message = getMessage();
      let imageUrl = selectImage();

      return {cardId, channelId, focused, sealed, hosted, unread, imageUrl, subject, message};
    });

    let search = state.filter?.toLowerCase();
    let filtered = channels.filter(item => {
      if (search) {
        if (item.subject?.find(value => value?.toLowerCase().includes(search))) {
          return true;
        }
        if (item.message?.toLowerCase().includes(search)) {
          return true;
        }
        return false;
      }
      return true;
    });

    updateState({channels, filtered});
  }, [state.sorted, state.cards, state.guid, state.filter, state.focused]);

  useEffect(() => {
    if (app.state.focus) {
      let focused = app.state.focus.getFocused();
      updateState({focused});
    } else {
      updateState({focused: null});
    }
  }, [app.state.focus]);

  useEffect(() => {
    let setConfig = (config: Config) => {
      let {sealSet, sealUnlocked} = config;
      updateState({sealSet: sealSet && sealUnlocked});
    };
    let setProfile = (profile: Profile) => {
      let {guid} = profile;
      updateState({guid});
    };
    let setCards = (cards: Card[]) => {
      let sorted = cards.sort(compare);
      let connected = [] as Card[];
      let sealable = [] as Card[];
      sorted.forEach(card => {
        if (card.status === 'connected') {
          connected.push(card);
          if (card.sealable) {
            sealable.push(card);
          }
        }
      });
      updateState({cards, connected, sealable});
    };
    let setChannels = ({channels, cardId}: {channels: Channel[]; cardId: string | null}) => {
      cardChannels.current.set(cardId, channels);
      let merged = [] as Channel[];
      cardChannels.current.forEach(values => {
        merged.push(...values);
      });
      let filtered = merged.filter(channel => !channel.blocked);
      let sorted = filtered.sort((a, b) => {
        let aUpdated = a?.lastTopic?.created;
        let bUpdated = b?.lastTopic?.created;
        if (aUpdated === bUpdated) {
          return 0;
        } else if (!aUpdated) {
          return 1;
        } else if (!bUpdated) {
          return -1;
        } else if (aUpdated < bUpdated) {
          return 1;
        } else {
          return -1;
        }
      });
      updateState({sorted});
    };

    if (app.state.session) {
      let {identity, contact, content, settings} = app.state.session;
      identity.addProfileListener(setProfile);
      contact.addCardListener(setCards);
      content.addChannelListener(setChannels);
      settings.addConfigListener(setConfig);

      return () => {
        identity.removeProfileListener(setProfile);
        contact.removeCardListener(setCards);
        content.removeChannelListener(setChannels);
        settings.removeConfigListener(setConfig);
      };
    }
  }, [app.state.session]);

  let actions = {
    setSharing: app.actions.setSharing,
    setFilter: (filter: string) => {
      updateState({filter});
    },
    setTopic: (topic: string) => {
      updateState({topic});
    },
    setFocus: async (cardId: string | null, channelId: string) => {
      await app.actions.setFocus(cardId, channelId);
    },
    openTopic: async (contactId: string) => {
      let content = app.state.session.getContent();
      let card = state.cards.find(member => member.cardId === contactId);
      if (card) {
        let sealable = card.sealable && state.sealSet;
        let thread = state.sorted.find(channel => {
          let {sealed, cardId, members} = channel;
          if (sealed === sealable && cardId == null && members.length === 1 && members[0].guid === card.guid) {
            return true;
          }
          return false;
        });
        if (thread) {
          return thread.channelId;
        } else {
          let topic = await content.addChannel(sealable, sealable ? 'sealed' : 'superbasic', {}, [cardId]);
          return topic.id;
        }
      }
    },
    addTopic: async (sealed: boolean, subject: string, contacts: string[]) => {
      let content = app.state.session.getContent();
      if (sealed) {
        let topic = await content.addChannel(true, 'sealed', {subject}, contacts);
        return topic.id;
      } else {
        let topic = await content.addChannel(false, 'superbasic', {subject}, contacts);
        return topic.id;
      }
    },
  };

  return {state, actions};
}
