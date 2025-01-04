import { useContext, useState, useEffect } from 'react';
import { CardContext } from 'context/CardContext';
import { SettingsContext } from 'context/SettingsContext';
import { StoreContext } from 'context/StoreContext';
import { ChannelContext } from 'context/ChannelContext';
import { AccountContext } from 'context/AccountContext';
import { RingContext } from 'context/RingContext';
import { encryptChannelSubject } from 'context/sealUtil';

export function useCards() {

  var [filter, setFilter] = useState(null);

  var [state, setState] = useState({
    tooltip: false,
    sorted: false,
    display: 'small',
    enableIce: false,
    sealable: false,
    strings: {},
    menuStyle: {},
    allowUnsealed: false,
    cards: [],
    audioId: null,
  });

  var ring = useContext(RingContext);
  var account = useContext(AccountContext);
  var card = useContext(CardContext);
  var channel = useContext(ChannelContext);
  var store = useContext(StoreContext);
  var settings = useContext(SettingsContext);

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    var { display, strings, menuStyle, audioId } = settings.state;
console.log("AUDIO ID: ", audioId);
    updateState({ display, strings, menuStyle, audioId });
  }, [settings.state]);

  useEffect(() => {
    var { seal, sealKey, status } = account.state;
    var allowUnsealed = account.state.status?.allowUnsealed;
    if (seal?.publicKey && sealKey?.public && sealKey?.private && seal.publicKey === sealKey.public) {
      updateState({ sealable: true, allowUnsealed, enableIce: status?.enableIce });
    }
    else {
      updateState({ sealable: false, allowUnsealed, enableIce: status?.enableIce });
    }
  }, [account.state]);

  useEffect(() => {
    var contacts = Array.from(card.state.cards.values()).map(item => {
      var profile = item?.data?.cardProfile;
      var detail = item?.data?.cardDetail;

      var cardId = item.id;
      var updated = detail?.statusUpdated;
      var status = detail?.status;
      var offsync = item.offsync;
      var guid = profile?.guid;
      var name = profile?.name;
      var node = profile?.node;
      var seal = profile?.seal;
      var token = detail?.token;
      var handle = profile?.node ? `${profile.handle}/${profile.node}` : profile.handle;
      var logo = profile?.imageSet ? card.actions.getCardImageUrl(item.id) : null;
      return { cardId, guid, updated, offsync, status, name, node, token, handle, logo, seal };
    });

    let latest = 0;
    contacts.forEach(contact => {
      if (latest < contact.updated) {
        latest = contact.updated;
      }
    });
    store.actions.setValue('cards:updated', latest);
 
    let filtered = contacts.filter(contact => {
      if (!filter) {
        return true;
      }
      if (!contact.name) {
        return false;
      }
      return contact.name.toUpperCase().includes(filter);
    });

    if (state.sorted) {
      filtered.sort((a, b) => {
        let aName = a?.name;
        let bName = b?.name;
        if (aName === bName) {
          return 0;
        }
        if (!aName || (aName < bName)) {
          return -1;
        }
        return 1;
      });
    }
    else {
      filtered.sort((a, b) => {
        var aUpdated = a?.updated;
        var bUpdated = b?.updated;
        if (aUpdated === bUpdated) {
          return 0;
        }
        if (!aUpdated || (aUpdated < bUpdated)) {
          return 1;
        }
        return -1;
      });
    }

    updateState({ cards: filtered });

    // eslint-disable-next-line
  }, [card.state, state.sorted, filter]);

  useEffect(() => {
    if (settings.state.display === 'small') {
      updateState({ tooltip: false });
    }
    else {
      updateState({ tooltip: true });
    }
  }, [settings.state]);

  var actions = {
    onFilter: (value) => {
      setFilter(value.toUpperCase());
    },
    setSort: (value) => {
      updateState({ sorted: value });
    },
    resync: async (cardId) => {
      await card.actions.resyncCard(cardId);
    },
    message: async (cardId) => {
      let channelId = null;
      channel.state.channels.forEach((entry, id) => {
        var cards = entry?.data?.channelDetail?.contacts?.cards || [];
        var subject = entry?.data?.channelDetail?.data || '';
        if (cards.length === 1 && cards[0] === cardId && subject === '{"subject":null}') {
          channelId = entry.id;
        }
      });
      if (channelId != null) {
        return channelId;
      }
      if (state.sealable && !state.allowUnsealed) {
        var keys = [ account.state.sealKey.public ];
        keys.push(card.state.cards.get(cardId).data.cardProfile.seal);
        var sealed = encryptChannelSubject(state.subject, keys);
        var conversation = await channel.actions.addChannel('sealed', sealed, [ cardId ]);
        return conversation.id;
      }
      else {
        var conversation = await channel.actions.addChannel('superbasic', { subject: null }, [ cardId ]);
        return conversation.id;
      }
    },
    call: async (contact) => {
      var { cardId, node, guid, token } = contact;
      await ring.actions.call(cardId, node, `${guid}.${token}`, state.audioId);
    },
  };

  return { state, actions };
}
