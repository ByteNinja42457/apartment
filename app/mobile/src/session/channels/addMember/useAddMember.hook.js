import { useState, useEffect, useRef, useContext } from 'react';
import { CardContext } from 'context/CardContext';

export function useAddMember(item, members) {

  let [state, setState] = useState({
    name: null,
    handle: null,
    logo: null,
    cardId: null,
    member: false,
  });

  let card = useContext(CardContext);

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    let member = members.filter(contact => item.cardId === contact);
    updateState({ member: member.length > 0 });
  }, [members]);

  useEffect(() => {
    let { cardId, revision, profile } = item;
    let { name, handle, node } = profile;
    let username = node ? `${handle}/${node}` : handle;
    updateState({ cardId, name, handle: username,
      logo: profile.imageSet ? card.actions.getCardImageUrl(cardId) : 'avatar' });
  }, [card.state]);

  let actions = {
  };

  return { state, actions };
}
