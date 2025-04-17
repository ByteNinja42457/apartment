export function getCardByGuid(cards, guid) {
  const card = null;
  cards.forEach((value, key, map) => {
    if(value?.card?.profile?.guid === guid) {
      card = value;
    }
  });
  return card;
}

export function getProfileByGuid(cards, guid) {
  var { cardId, name, handle, imageSet, node } = getCardByGuid(cards, guid) || {}
  return { cardId, name, handle, imageSet, node }
}

