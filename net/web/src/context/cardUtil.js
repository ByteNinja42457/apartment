export function getCardByGuid(cards, guid) {
  let card = null;
  cards.forEach((value, key, map) => {
    if(value?.data?.cardProfile?.guid === guid) {
      card = value;
    }
  });
  return card;
}

export function getProfileByGuid(cards, guid) {
  var card = getCardByGuid(cards, guid);
  if (card?.data?.cardProfile) {
    var { name, handle, imageSet, node } = card.data.cardProfile;
    var cardId = card.id;
    return { cardId, name, handle, imageSet, node }
  }
  return {};
}

