let nextCardId = 1;
function pickRandomInt(maxExclusive) { return Math.floor(Math.random() * maxExclusive); }
function createRandomCard() { return { id: nextCardId++, n: pickRandomInt(CARD_NUMBER_MAX + 1), e: pickRandomInt(ELEMENT_COUNT) }; }
function createRandomHand(size) { const hand = []; for (let i = 0; i < size; i++) hand.push(createRandomCard()); return hand; }
function removeCardFromHand(hand, cardId) {
  const index = hand.findIndex(function (c) { return c.id === cardId; });
  return index < 0 ? null : hand.splice(index, 1)[0];
}
function addRandomCardIfHandNotFull(hand) {
  if (hand.length >= HAND_SIZE) return false;
  hand.push(createRandomCard());
  return true;
}
function peekCardInHand(hand, cardId) {
  const index = hand.findIndex(function (c) { return c.id === cardId; });
  return index < 0 ? null : hand[index];
}
