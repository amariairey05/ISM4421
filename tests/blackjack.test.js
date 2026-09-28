import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cardValue,
  handTotal,
  isBlackjack,
  dealerShouldHit,
  determineOutcome,
  outcomeResult,
  OUTCOMES,
} from "../public/js/blackjack.js";

const c = (value) => ({ value, suit: "SPADES", code: `${value[0]}S` });

test("card values", () => {
  assert.equal(cardValue(c("2")), 2);
  assert.equal(cardValue(c("10")), 10);
  assert.equal(cardValue(c("KING")), 10);
  assert.equal(cardValue(c("ACE")), 11);
});

test("aces drop from 11 to 1 to avoid busting", () => {
  assert.deepEqual(handTotal([c("ACE"), c("6")]), { total: 17, soft: true });
  assert.deepEqual(handTotal([c("ACE"), c("6"), c("10")]), { total: 17, soft: false });
  assert.deepEqual(handTotal([c("ACE"), c("ACE")]), { total: 12, soft: true });
  assert.deepEqual(handTotal([c("ACE"), c("ACE"), c("KING")]), { total: 12, soft: false });
  assert.deepEqual(handTotal([c("KING"), c("QUEEN"), c("5")]), { total: 25, soft: false });
});

test("blackjack only on the first two cards", () => {
  assert.ok(isBlackjack([c("ACE"), c("KING")]));
  assert.ok(!isBlackjack([c("7"), c("7"), c("7")]));
});

test("dealer hits 16, stands on 17 including soft 17", () => {
  assert.ok(dealerShouldHit([c("10"), c("6")]));
  assert.ok(!dealerShouldHit([c("10"), c("7")]));
  assert.ok(!dealerShouldHit([c("ACE"), c("6")]));
});

test("outcomes", () => {
  const bj = [c("ACE"), c("KING")];
  assert.equal(determineOutcome(bj, bj), OUTCOMES.PUSH);
  assert.equal(determineOutcome(bj, [c("10"), c("5"), c("6")]), OUTCOMES.PLAYER_BLACKJACK);
  assert.equal(determineOutcome([c("10"), c("5"), c("6")], bj), OUTCOMES.DEALER_BLACKJACK);
  assert.equal(determineOutcome([c("10"), c("5"), c("9")], [c("10"), c("5"), c("9")]), OUTCOMES.PLAYER_BUST);
  assert.equal(determineOutcome([c("10"), c("8")], [c("10"), c("5"), c("9")]), OUTCOMES.DEALER_BUST);
  assert.equal(determineOutcome([c("10"), c("9")], [c("10"), c("8")]), OUTCOMES.PLAYER_WIN);
  assert.equal(determineOutcome([c("10"), c("7")], [c("10"), c("8")]), OUTCOMES.DEALER_WIN);
  assert.equal(determineOutcome([c("10"), c("8")], [c("10"), c("8")]), OUTCOMES.PUSH);
});

test("scoreboard mapping", () => {
  assert.equal(outcomeResult(OUTCOMES.DEALER_BUST), "win");
  assert.equal(outcomeResult(OUTCOMES.PLAYER_BUST), "loss");
  assert.equal(outcomeResult(OUTCOMES.PUSH), "push");
});
