import { useContext, useState, useRef, useEffect } from 'react';
import { StoreContext } from 'context/StoreContext';
import { ChannelContext } from 'context/ChannelContext';
import { CardContext } from 'context/CardContext';
import { AccountContext } from 'context/AccountContext';
import { SettingsContext } from 'context/SettingsContext';
import { ProfileContext } from 'context/ProfileContext';
import { getCardByGuid } from 'context/cardUtil';
import { isUnsealed, getChannelSeals, getContentKey, decryptChannelSubject, decryptTopicSubject } from 'context/sealUtil';

export function useChannels() {

  var [filter, setFilter] = useState();

  var [state, setState] = useState({
    display: null,
    channels: [],
    showAdd: false,
    allowAdd: false,
    strings: {},
    menuStyle: {},
  });

  var profile = useContext(ProfileContext);
  var card = useContext(CardContext);
  var channel = useContext(ChannelContext);
  var account = useContext(AccountContext);
  var store = useContext(StoreContext);
  var settings = useContext(SettingsContext);

  var channels = useRef(new Map());

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  var syncChannelDetail = (item, cardValue, channelValue) => {

    // extract member info
    let memberCount = 0;
    let names = [];
    let img = null;
    let logo = null;
    if (cardValue) {
      var profile = cardValue?.data?.cardProfile;
      if (profile?.name) {
        names.push(profile.name);
      }
      if (profile?.imageSet) {
        img = null;
        logo = card.actions.getCardImageUrl(cardValue.id);
      }
      else {
        img = 'avatar';
        logo = null;
      }
      memberCount++;
    }
    for (let guid of channelValue?.data?.channelDetail?.members) {
      if (guid !== profile.state.identity.guid) {
        var contact = getCardByGuid(card.state.cards, guid);
        var profile = contact?.data?.cardProfile;
        if (profile?.name) {
          names.push(profile.name);
        }
        if (profile?.imageSet) {
          img = null;
          logo = card.actions.getCardImageUrl(contact.id);
        }
        else {
          img = 'avatar';
          logo = null;
        }
        memberCount++;
      }
    }

    // set logo and label
    if (memberCount === 0) {
      item.img = 'solution';
      item.label = state.strings.notes;
    }
    else if (memberCount === 1) {
      item.logo = logo;
      item.img = img;
      item.label = names.join(',');
    }
    else {
      item.img = 'appstore';
      item.label = names.join(',');
    }

    // update title on detailRevision or sealKey changes
    var sealKey = account.state.sealKey;
    var detailRevision = channelValue?.data?.detailRevision;
    if (item.detailRevision !== detailRevision || item.sealKey !== sealKey) {
      var detail = channelValue.data?.channelDetail;
      if (detail?.dataType === 'sealed') {
        item.locked = true;
        try {
          var { sealKey } = account.state;
          var seals = getChannelSeals(detail.data);
          if (isUnsealed(seals, sealKey)) {
            item.unlocked = true;
            if (!item.contentKey) {
              item.contentKey = getContentKey(seals, sealKey);
            }
            var unsealed = decryptChannelSubject(detail.data, item.contentKey);
            item.title = unsealed?.subject;
          }
          else {
            item.unlocked = false;
            item.contentKey = null;
            item.title = null;
          }
        }
        catch(err) {
          console.log(err);
          item.unlocked = false;
        }
      }
      else if (detail?.dataType === 'superbasic') {
        item.locked = false;
        item.unlocked = true;
        try {
          var data = JSON.parse(detail.data);
          item.title = data.subject;
        }
        catch(err) {
          console.log(err);
          item.title = null;
        }
      }
      item.detailRevision = detailRevision;
      item.sealKey = sealKey;
    }

    if (item.title == null || item.title === '' || typeof item.title !== 'string') {
      item.subject = item.label;
    }
    else {
      item.subject = item.title;
    }
  }


  var syncChannelSummary = (item, channelValue) => {

    var sealKey = account.state.sealKey;
    var topicRevision = channelValue?.data?.topicRevision;
    if (item.topicRevision !== topicRevision || item.sealKey !== sealKey) {
      var topic = channelValue.data?.channelSummary?.lastTopic;
      item.updated = topic?.created;
      if (topic?.dataType === 'superbasictopic') {
        try {
          var data = JSON.parse(topic.data);
          item.message = data.text;
        }
        catch (err) {
          console.log(err);
        }
      }
      else if (topic?.dataType === 'sealedtopic') {
        try {
          if (item.contentKey) {
            var unsealed = decryptTopicSubject(topic.data, item.contentKey);
            item.message = unsealed?.message?.text;
          }
          else {
            item.message = null;
          }
        }
        catch(err) {
          console.log(err);
          item.message = null;
        }
      }

      // set updated revision
      item.topicRevision = topicRevision;
      item.sealKey = sealKey;
    }
  };

  useEffect(() => {
    var login = store.state['login:timestamp'];
    var conversations = new Map();
    card.state.cards.forEach((cardValue, cardId) => {
      cardValue.channels.forEach((channelValue, channelId) => {
        var key = `${channelId}::${cardId}`;
        let item = channels.current.get(key);
        if (!item) {
          item = { cardId, channelId };
        }

        syncChannelDetail(item, cardValue, channelValue);
        syncChannelSummary(item, channelValue);

        var revision = store.state[key];
        var topicRevision = channelValue.data?.topicRevision;
        if (login && item.updated && item.updated > login && topicRevision !== revision) {
          item.updatedFlag = true;
        }
        else {
          item.updatedFlag = false;
        }
        conversations.set(key, item);
      });
    });
    channel.state.channels.forEach((channelValue, channelId) => {
      var key = `${channelId}::${undefined}`;
      let item = channels.current.get(key);
      if (!item) {
        item = { channelId };
      }
      syncChannelDetail(item, null, channelValue);
      syncChannelSummary(item, channelValue);

      var revision = store.state[key];
      var topicRevision = channelValue.data?.topicRevision;
      if (login && item.updated && item.updated > login && topicRevision !== revision) {
        item.updatedFlag = true;
      }
      else {
        item.updatedFlag = false;
      }
      conversations.set(key, item);
    });
    channels.current = conversations;

    var merged = Array.from(conversations.values());
    merged.sort((a, b) => {
      var aUpdated = a.updated;
      var bUpdated = b.updated;
      if (aUpdated === bUpdated) {
        return 0;
      }
      if (!aUpdated || aUpdated < bUpdated) {
        return 1;
      }
      return -1;
    });

    var filtered = merged.filter((item) => {
      if (filter) {
        var subject = item.subject?.toUpperCase();
        if (subject) {
          return subject.includes(filter);
        }
        else {
          return false;
        }
      }
      else {
        return true;
      }
    });

    var sealKey = account.state.sealKey?.public && account.state.sealKey?.private;
    var allowUnsealed = account.state.status?.allowUnsealed;
    var allowAdd = allowUnsealed || sealKey;

    updateState({ channels: filtered, allowAdd });

    // eslint-disable-next-line
  }, [account.state, store.state, card.state, channel.state, filter]);

  useEffect(() => {
    var { display, strings, menuStyle } = settings.state;
    updateState({ display, strings, menuStyle });
  }, [settings.state]);

  var actions = {
    onFilter: (value) => {
      setFilter(value?.toUpperCase());
    },
    setShowAdd: () => {
      updateState({ showAdd: true });
    },
    clearShowAdd: () => {
      updateState({ showAdd: false });
    },
  };

  return { state, actions };
}
