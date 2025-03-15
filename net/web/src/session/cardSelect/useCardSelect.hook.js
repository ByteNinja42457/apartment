import { useContext, useState, useEffect } from 'react';
import { CardContext } from 'context/CardContext';

export function useCardSelect(filter) {

  var [state, setState] = useState({
    cards: [],
  });

  var card = useContext(CardContext);

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    let contacts = Array.from(card.state.cards.values());
    let filtered = contacts.filter(filter);
    updateState({ cards: filtered });
  }, [card, filter]);

  var actions = {
  };

  return { state, actions };
}

