import { useState, useEffect, useContext } from 'react';
import { CardContext } from 'context/CardContext';

export function useCardIcon() {

  var [state, setState] = useState({
    requested: false,
    offsync: false,
  });

  var card = useContext(CardContext);

  var updateState = (value) => {
    setState((s) => ({ ...s, ...value }));
  }

  useEffect(() => {
    let requested = false;
    let offsync = false;
    card.state.cards.forEach(item => {
      var status = item.card?.detail?.status;
      if (status === 'pending' || status === 'requested') {
        requested = true;
      }
      if (item.card?.offsync && status === 'connected') {
        offsync = true;
      }
    });
    updateState({ requested, offsync }); 
  }, [card.state]);

  var actions = {};

  return { state, actions };
}
