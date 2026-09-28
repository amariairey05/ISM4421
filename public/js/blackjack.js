// Pure Blackjack rules. No DOM or network access, so this module can be
// unit-tested in Node and reused by the UI in app.js.

const FACE_VALUES = { KING: 10, QUEEN: 10, JACK: 10, ACE: 11 };

/** Point value of a single Deck of Cards API card (aces count 11 here). */
export function cardValue(card) {
  if (card.value in FACE_VALUES) return FACE_VALUES[card.value];
  const n = Number(card.value);
  if (Number.isNaN(n)) throw new Error(`Unknown card value: ${card.value}`);
  return n;
}

/**
 * Best total for a hand. Aces count 11 unless that would bust, in which case
 * they drop to 1 one at a time. `soft` is true when an ace is still counted 11.
 */
export function handTotal(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += cardValue(card);
    if (card.value === "ACE") aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cards) {
  return cards.length === 2 && handTotal(cards).total === 21;
}

export function isBust(cards) {
  return handTotal(cards).total > 21;
}

/** Dealer draws to 16 and stands on all 17s (including soft 17). */
export function dealerShouldHit(cards) {
  return handTotal(cards).total < 17;
}

export const OUTCOMES = Object.freeze({
  PLAYER_BLACKJACK: "player-blackjack",
  DEALER_BLACKJACK: "dealer-blackjack",
  PLAYER_BUST: "player-bust",
  DEALER_BUST: "dealer-bust",
  PLAYER_WIN: "player-win",
  DEALER_WIN: "dealer-win",
  PUSH: "push",
});

/** Result of a finished round, from the player's point of view. */
export function determineOutcome(player, dealer) {
  const playerBJ = isBlackjack(player);
  const dealerBJ = isBlackjack(dealer);
  if (playerBJ && dealerBJ) return OUTCOMES.PUSH;
  if (playerBJ) return OUTCOMES.PLAYER_BLACKJACK;
  if (dealerBJ) return OUTCOMES.DEALER_BLACKJACK;
  if (isBust(player)) return OUTCOMES.PLAYER_BUST;
  if (isBust(dealer)) return OUTCOMES.DEALER_BUST;

  const p = handTotal(player).total;
  const d = handTotal(dealer).total;
  if (p > d) return OUTCOMES.PLAYER_WIN;
  if (d > p) return OUTCOMES.DEALER_WIN;
  return OUTCOMES.PUSH;
}

/** Maps an outcome to "win" | "loss" | "push" for the scoreboard. */
export function outcomeResult(outcome) {
  switch (outcome) {
    case OUTCOMES.PLAYER_BLACKJACK:
    case OUTCOMES.DEALER_BUST:
    case OUTCOMES.PLAYER_WIN:
      return "win";
    case OUTCOMES.PUSH:
      return "push";
    default:
      return "loss";
  }
}

export const OUTCOME_MESSAGES = Object.freeze({
  [OUTCOMES.PLAYER_BLACKJACK]: "Blackjack! Go Owls — you win!",
  [OUTCOMES.DEALER_BLACKJACK]: "Dealer has Blackjack. You lose.",
  [OUTCOMES.PLAYER_BUST]: "Bust! You went over 21.",
  [OUTCOMES.DEALER_BUST]: "Dealer busts — you win!",
  [OUTCOMES.PLAYER_WIN]: "You win!",
  [OUTCOMES.DEALER_WIN]: "Dealer wins.",
  [OUTCOMES.PUSH]: "Push — it's a tie.",
});
