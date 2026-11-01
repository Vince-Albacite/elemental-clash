let nextCardId = 1;
function pickRandomInt(maxExclusive) { return Math.floor(Math.random() * maxExclusive); }
function createRandomCard() { return { id: nextCardId++, number: pickRandomInt(CARD_NUMBER_MAX + 1), element: pickRandomInt(ELEMENT_COUNT) }; }
function createRandomHand(size) { const hand = []; for (let cardIndex = 0; cardIndex < size; cardIndex++) hand.push(createRandomCard()); return hand; }
function removeCardFromHand(hand, cardId) {
  const index = hand.findIndex(function (card) { return card.id === cardId; });
  return index < 0 ? null : hand.splice(index, 1)[0];
}
function addRandomCardIfHandNotFull(hand) {
  if (hand.length >= HAND_SIZE) return false;
  hand.push(createRandomCard());
  return true;
}
function peekCardInHand(hand, cardId) {
  const index = hand.findIndex(function (card) { return card.id === cardId; });
  return index < 0 ? null : hand[index];
}
