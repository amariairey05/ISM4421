import {
  handTotal,
  isBlackjack,
  isBust,
  dealerShouldHit,
  determineOutcome,
  outcomeResult,
  OUTCOME_MESSAGES,
} from "./blackjack.js";
import { Deck, CARD_BACK_IMAGE } from "./deckApi.js";

const STATS_KEY = "fau-blackjack-stats";
const DEALER_DELAY_MS = 650;
// A round rarely needs more than ~12 cards; reshuffle before we get close.
const RESHUFFLE_THRESHOLD = 30;

const SUIT_SYMBOLS = { HEARTS: "♥", DIAMONDS: "♦", CLUBS: "♣", SPADES: "♠" };

const el = {
  dealerCards: document.getElementById("dealer-cards"),
  playerCards: document.getElementById("player-cards"),
  dealerTotal: document.getElementById("dealer-total"),
  playerTotal: document.getElementById("player-total"),
  status: document.getElementById("status"),
  deal: document.getElementById("deal-btn"),
  hit: document.getElementById("hit-btn"),
  stand: document.getElementById("stand-btn"),
  resetScore: document.getElementById("reset-score-btn"),
  playerWins: document.getElementById("player-wins"),
  dealerWins: document.getElementById("dealer-wins"),
  pushes: document.getElementById("pushes"),
  shoeCount: document.getElementById("shoe-count"),
};

const deck = new Deck(6);

const state = {
  // "idle" | "busy" | "player" | "over"
  phase: "idle",
  player: [],
  dealer: [],
  holeHidden: true,
  stats: loadStats(),
};

// ---------- Persistence ----------

function loadStats() {
  const empty = { wins: 0, losses: 0, pushes: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(STATS_KEY));
    if (saved && typeof saved === "object") return { ...empty, ...saved };
  } catch {
    // Storage unavailable (private mode, blocked cookies) — start fresh.
  }
  return empty;
}

function saveStats() {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(state.stats));
  } catch {
    // Non-fatal: the scoreboard simply won't survive a reload.
  }
}

// ---------- Rendering ----------

function cardLabel(card) {
  const rank = card.value.charAt(0) + card.value.slice(1).toLowerCase();
  const suit = card.suit.charAt(0) + card.suit.slice(1).toLowerCase();
  return `${rank} of ${suit}`;
}

/** Text-only card used if an image fails to load. */
function fallbackCard(card) {
  const div = document.createElement("div");
  div.className = "card card-fallback";
  if (!card) {
    div.classList.add("card-back-fallback");
    div.setAttribute("aria-label", "Face-down card");
    return div;
  }
  const red = card.suit === "HEARTS" || card.suit === "DIAMONDS";
  if (red) div.classList.add("red");
  const rank = card.value === "10" ? "10" : card.value.charAt(0);
  div.innerHTML = `<span class="rank">${rank}</span><span class="suit">${SUIT_SYMBOLS[card.suit] ?? ""}</span>`;
  div.setAttribute("aria-label", cardLabel(card));
  return div;
}

/** @param card API card, or null for a face-down card */
function cardElement(card) {
  const img = document.createElement("img");
  img.className = "card";
  img.src = card ? card.image : CARD_BACK_IMAGE;
  img.alt = card ? cardLabel(card) : "Face-down card";
  img.width = 113;
  img.height = 157;
  img.dataset.code = card ? card.code : "back";
  img.addEventListener(
    "error",
    () => {
      const fallback = fallbackCard(card);
      fallback.dataset.code = img.dataset.code;
      img.replaceWith(fallback);
    },
    { once: true }
  );
  return img;
}

function renderHand(container, cards, hideSecond) {
  // Keep cards that are already on the table so they don't replay their deal
  // animation; only add new cards or swap ones that changed (the hole card).
  cards.forEach((card, i) => {
    const shown = hideSecond && i === 1 ? null : card;
    const code = shown ? shown.code : "back";
    const existing = container.children[i];
    if (existing && existing.dataset.code === code) return;
    const node = cardElement(shown);
    if (existing) existing.replaceWith(node);
    else container.appendChild(node);
  });
  while (container.children.length > cards.length) {
    container.lastElementChild.remove();
  }
}

function totalText(cards) {
  if (cards.length === 0) return "–";
  const { total, soft } = handTotal(cards);
  if (total > 21) return `${total} · Bust`;
  if (isBlackjack(cards)) return "21 · Blackjack";
  return soft && total < 21 ? `${total} (soft)` : String(total);
}

function render() {
  renderHand(el.playerCards, state.player, false);
  renderHand(el.dealerCards, state.dealer, state.holeHidden);

  el.playerTotal.textContent = totalText(state.player);
  el.dealerTotal.textContent =
    state.holeHidden && state.dealer.length > 0
      ? `${handTotal([state.dealer[0]]).total} + ?`
      : totalText(state.dealer);

  const playing = state.phase === "player";
  el.hit.disabled = !playing;
  el.stand.disabled = !playing;
  el.deal.disabled = state.phase === "busy" || playing;
  el.deal.textContent = state.phase === "idle" ? "Deal" : "Deal Again";

  el.playerWins.textContent = state.stats.wins;
  el.dealerWins.textContent = state.stats.losses;
  el.pushes.textContent = state.stats.pushes;
  el.shoeCount.textContent = deck.id ? `${deck.remaining} cards left in the shoe` : "";
}

function setStatus(message, tone = "info") {
  el.status.textContent = message;
  el.status.dataset.tone = tone;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- Game flow ----------

function finishRound() {
  state.holeHidden = false;
  const outcome = determineOutcome(state.player, state.dealer);
  const result = outcomeResult(outcome);
  if (result === "win") state.stats.wins += 1;
  else if (result === "loss") state.stats.losses += 1;
  else state.stats.pushes += 1;
  saveStats();
  state.phase = "over";
  setStatus(OUTCOME_MESSAGES[outcome], result);
  render();
}

function handleError(error, fallbackPhase) {
  console.error(error);
  state.phase = fallbackPhase;
  setStatus(`Couldn't reach the card dealer: ${error.message}. Please try again.`, "error");
  render();
}

async function deal() {
  if (state.phase === "busy" || state.phase === "player") return;
  const previousPhase = state.phase;
  state.phase = "busy";
  setStatus("Shuffling up and dealing…");
  render();

  try {
    await deck.ensureCards(RESHUFFLE_THRESHOLD);
    const [p1, d1, p2, d2] = await deck.draw(4);
    state.player = [p1, p2];
    state.dealer = [d1, d2];
    state.holeHidden = true;
  } catch (error) {
    handleError(error, previousPhase);
    return;
  }

  if (isBlackjack(state.player) || isBlackjack(state.dealer)) {
    finishRound();
    return;
  }
  state.phase = "player";
  setStatus("Your move: Hit or Stand?");
  render();
}

async function hit() {
  if (state.phase !== "player") return;
  state.phase = "busy";
  render();
  try {
    const [card] = await deck.draw(1);
    state.player.push(card);
  } catch (error) {
    handleError(error, "player");
    return;
  }

  const { total } = handTotal(state.player);
  if (isBust(state.player)) {
    finishRound();
  } else if (total === 21) {
    // Nothing to gain by hitting on 21; play out the dealer automatically.
    await dealerTurn();
  } else {
    state.phase = "player";
    setStatus(`You have ${total}. Hit or Stand?`);
    render();
  }
}

async function dealerTurn() {
  state.phase = "busy";
  state.holeHidden = false;
  setStatus("Dealer's turn…");
  render();

  try {
    while (dealerShouldHit(state.dealer)) {
      await sleep(DEALER_DELAY_MS);
      const [card] = await deck.draw(1);
      state.dealer.push(card);
      render();
    }
  } catch (error) {
    // The hand can't be completed reliably; void it rather than score it.
    state.holeHidden = false;
    handleError(error, "over");
    return;
  }
  await sleep(DEALER_DELAY_MS / 2);
  finishRound();
}

function stand() {
  if (state.phase !== "player") return;
  dealerTurn();
}

function resetScore() {
  state.stats = { wins: 0, losses: 0, pushes: 0 };
  saveStats();
  render();
}

// ---------- Wiring ----------

el.deal.addEventListener("click", deal);
el.hit.addEventListener("click", hit);
el.stand.addEventListener("click", stand);
el.resetScore.addEventListener("click", resetScore);

document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof HTMLElement && event.target.closest("button, input, textarea")) {
    // Let Enter/Space activate the focused button normally.
    if (event.key === "Enter" || event.key === " ") return;
  }
  const key = event.key.toLowerCase();
  if (key === "h") hit();
  else if (key === "s") stand();
  else if (key === "d" || key === "n") deal();
});

setStatus("Press Deal to start a hand. Dealer stands on all 17s. Blackjack beats 21.");
render();
