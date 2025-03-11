import { useContext, useState, useEffect } from 'react';
import { CardContext } from 'context/CardContext';

export function useMemberOption(item) {

  let [state, setState] = useState({
    logo: null,
  });

  let card = useContext(CardContext);

  let updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    updateState({ logo: card.actions.getImageUrl(item.id) });
  }, [card, item]);

  let actions = {
  };

  return { state, actions };
}

