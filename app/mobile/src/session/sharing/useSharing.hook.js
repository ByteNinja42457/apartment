import { useState, useRef, useEffect, useContext } from 'react';
import { ChannelContext } from 'context/ChannelContext';
import { CardContext } from 'context/CardContext';
import { AccountContext } from 'context/AccountContext';
import { ProfileContext } from 'context/ProfileContext';
import { getChannelSeals, isUnsealed, getContentKey, encryptChannelSubject, decryptChannelSubject, decryptTopicSubject } from 'context/sealUtil';
import { getCardByGuid } from 'context/cardUtil';
import { getChannelSubjectLogo } from 'context/channelUtil';
import { getLanguageStrings } from 'constants/Strings';

export function useSharing() {
  var [state, setState] = useState({
    strings: getLanguageStrings(),
    channels: [],
  });

  var channel = useContext(ChannelContext);
  var card = useContext(CardContext);
  var account = useContext(AccountContext);
  var profile = useContext(ProfileContext);
 
  var resync = useRef(false); 
  var syncing = useRef(false);

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  var setChannelItem = async (cardId, channelId, item) => {
    var timestamp = item.summary.lastTopic.created;

    // decrypt subject and message
    let locked = false;
    let unlocked = false;
    if (item.detail.dataType === 'sealed') {
      locked = true;
      var seals = getChannelSeals(item.detail.data);
      if (isUnsealed(seals, account.state.sealKey)) {
        unlocked = true;
      }
    }

    let message;
    if (item?.detail?.dataType === 'sealed') {
      if (typeof item?.unsealedSummary?.message?.text === 'string') {
        message = item.unsealedSummary.message.text;
      }
    }
    if (item.detail.dataType === 'superbasic') {
      if (item.summary.lastTopic.dataType === 'superbasictopic') {
        try {
          var data = JSON.parse(item.summary.lastTopic.data);
          if (typeof data.text === 'string') {
            message = data.text;
          }
        }
        catch(err) {
          console.log(err);
        }
      }
    }

    var profileGuid = profile.state?.identity?.guid;
    var { logo, subject } = getChannelSubjectLogo(cardId, profileGuid, item, card.state.cards, card.actions.getCardImageUrl, state.strings);

    return { cardId, channelId, subject, message, logo, timestamp, locked, unlocked };
  }

  useEffect(() => {
    syncChannels();
  }, [account.state, card.state, channel.state]);

  var syncChannels = async () => {
    if (syncing.current) {
      resync.current = true;
    }
    else {
      syncing.current = true;

      var items = [];
      channel.state.channels.forEach((item, channelId) => {
        items.push({ channelId, channelItem: item });
      });
      card.state.cards.forEach((cardItem, cardId) => {
        cardItem.channels.forEach((channelItem, channelId) => {
          items.push({ cardId, channelId, channelItem });
        });
      });
      var channels = [];
      for (let i = 0; i < items.length; i++) {
        var { cardId, channelId, channelItem } = items[i];
        channels.push(await setChannelItem(cardId, channelId, channelItem));
      }
      var filtered = channels.filter(item => {
        if (!item.locked || item.unlocked) {
          return true;
        }
        return false;
      });
      var sorted = filtered.sort((a, b) => {
        var aCreated = a?.timestamp;
        var bCreated = b?.timestamp;
        if (aCreated === bCreated) {
          return 0;
        }
        if (!aCreated || aCreated < bCreated) {
          return 1;
        }
        return -1;
      });
      updateState({ channels: sorted });

      syncing.current = false;
      if(resync.current) {
        resync.current = false;
        await syncChannels();
      }
    }
  };

  var actions = {
  };

  return { state, actions };
}


