import { useContext, useState, useEffect, useRef } from 'react';
import { CardContext } from 'context/CardContext';
import { ConversationContext } from 'context/ConversationContext';
import { AccountContext } from 'context/AccountContext';
import { ProfileContext } from 'context/ProfileContext';
import { SettingsContext } from 'context/SettingsContext';
import { getCardByGuid } from 'context/cardUtil';
import { decryptChannelSubject, updateChannelSubject, getContentKey, getChannelSeals, isUnsealed } from 'context/sealUtil';

export function useDetails() {

  var [state, setState] = useState({
    logo: null,
    img: null,
    started: null,
    host: null,
    title: null,
    label: null,
    members: [],
    unknown: 0,

    showEditMembers: false,
    editMembers: new Set(),

    showEditSubject: false,
    editSubject: null,

    strings: {},
    display: 'small',
    menuStyle: {},
    sealed: false,
    contentKey: null,
    seals: null,
  });

  var conversation = useContext(ConversationContext);
  var card = useContext(CardContext);
  var account = useContext(AccountContext);
  var settings = useContext(SettingsContext);
  var profile = useContext(ProfileContext);

  var cardId = useRef();
  var channelId = useRef();
  var key = useRef();
  var detailRevision = useRef();

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    var { dataType, data } = conversation.state.channel?.data?.channelDetail || {};
    if (dataType === 'sealed') {
      try {
        var { sealKey } = account.state;
        var seals = getChannelSeals(data);
        if (isUnsealed(seals, sealKey)) {
          var decKey = getContentKey(seals, sealKey);
          updateState({ sealed: true, contentKey: decKey, seals });
        }
        else {
          updateState({ sealed: true, contentKey: null });
        }
      }
      catch (err) {
        console.log(err);
        updateState({ sealed: true, contentKey: null });
      }
    }
    else {
      updateState({ sealed: false, contentKey: null });
    }
    // eslint-disable-next-line
  }, [account.state.sealKey, conversation.state.channel?.data?.channelDetail]);

  useEffect(() => {
    var { menuStyle, strings, display } = settings.state;
    updateState({ menuStyle, strings, display });
  }, [settings.state]);

  useEffect(() => {

    var cardValue = conversation.state.card;
    var channelValue = conversation.state.channel;

    // extract channel created info
    let started;
    let host;
    var date = new Date(channelValue?.data?.channelDetail?.created * 1000);
    var now = new Date();
    if(now.getTime() - date.getTime() < 86400000) {
      if (settings.state.timeFormat === '12h') {
        started = date.toLocaleTimeString("en-US", {hour: 'numeric', minute:'2-digit'});
      }
      else {
        started = date.toLocaleTimeString("en-GB", {hour: 'numeric', minute:'2-digit'});
      }
    }
    else {
      if (settings.state.dateFormat === 'mm/dd') {
        started = date.toLocaleDateString("en-US");
      }
      else {
        started = date.toLocaleDateString("en-GB");
      }
    }
    if (cardValue) {
      host = cardValue.id;
    }
    else {
      host = null;
    }

    // extract member info
    let memberCount = 0;
    let names = [];
    let img;
    let logo;
    let members = [];
    let unknown = 0;
    if (cardValue) {
      members.push(cardValue.id);
      var profile = cardValue.data?.cardProfile;
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
    if (channelValue?.data?.channelDetail?.members) {
      for (let guid of channelValue.data.channelDetail.members) {
        if (guid !== profile.state.identity.guid) {
          var contact = getCardByGuid(card.state.cards, guid);
          if (contact) {
            members.push(contact.id);
          }
          else {
            unknown++;
          }
    
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
    }

    let label;
    if (memberCount === 0) {
      img = 'solution';
      label = state.strings.notes;
    }
    else if (memberCount === 1) {
      label = names.join(',');
    }
    else {
      img = 'appstore';
      label = names.join(',');
    }

    if (cardId.current !== cardValue?.id || channelId.current !== channelValue?.id ||
        detailRevision.current !== channelValue?.data?.detailRevision || key.current !== state.contentKey) {
      let title;
      try {
        var detail = channelValue?.data?.channelDetail;
        if (detail?.dataType === 'sealed') {
          if (state.contentKey) {
            var unsealed = decryptChannelSubject(detail.data, state.contentKey);
            title = unsealed.subject;
          }
          else {
            title = '...';
          }
        }
        else if (detail?.dataType === 'superbasic') {
          var data = JSON.parse(detail.data);
          title = data.subject;
        }
      }
      catch(err) {
        console.log(err);
      }
      cardId.current = cardValue?.id;
      channelId.current = channelValue?.id;
      detailRevision.current = channelValue?.data?.detailRevision;
      key.current = state.contentKey;
      updateState({ started, host, title, label, img, logo, unknown, members,
        editSubject: title, editMembers: new Set(members) });
    }
    else {
      updateState({ started, host, label, img, logo, unknown, members,
        editMembers: new Set(members) });
    }
    // eslint-disable-next-line
  }, [conversation.state, card.state, state.strings, state.contentKey]);

  var actions = {
    setEditSubject: () => {
      updateState({ showEditSubject: true });
    },
    clearEditSubject: () => {
      updateState({ showEditSubject: false });
    },
    setSubjectUpdate: (editSubject) => {
      updateState({ editSubject });
    },
    setSubject: async () => {
      if (state.sealed) {
        if (state.contentKey) {
          var updated = updateChannelSubject(state.editSubject, state.contentKey);
          updated.seals = state.seals;
          await conversation.actions.setChannelSubject('sealed', updated);
        }
      }
      else {
        var subject = { subject: state.editSubject };
        await conversation.actions.setChannelSubject('superbasic', subject);
      }
    },
    setEditMembers: () => {
      updateState({ editMembers: new Set(state.members), showEditMembers: true });
    },
    clearEditMembers: () => {
      updateState({ showEditMembers: false });
    },
    setMember: async (id) => {
      await conversation.actions.setChannelCard(id);
    },
    clearMember: async (id) => {
      await conversation.actions.clearChannelCard(id);
    },
    removeChannel: async () => {
      await conversation.actions.removeChannel();
    },
  };

  return { state, actions };
}

