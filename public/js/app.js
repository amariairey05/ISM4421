import {
  handTotal,
  isBlackjack,
  isBust,
  dealerShouldHit,
  determineOutcome,
  outcomeResult,
  payout,
  OUTCOMES,
} from "./blackjack.js";
import { Deck } from "./deckApi.js";

const START_BANK = 1000;
const MIN_CHIP = 5;
const CHIP_VALUES = [500, 100, 25, 5];
const MAX_PILE = 7;
const HISTORY_LENGTH = 6;
const DEALER_DELAY_MS = 600;
// A round rarely needs more than ~12 cards; reshuffle well before that.
const RESHUFFLE_THRESHOLD = 30;
const STORAGE_PREFIX = "fau-owls-blackjack";
const OWL = "assets/owl.png";

const SUIT_SYMBOLS = { SPADES: "♠", HEARTS: "♥", DIAMONDS: "♦", CLUBS: "♣" };
const SUIT_NAMES = { "♠": "spades", "♥": "hearts", "♦": "diamonds", "♣": "clubs" };
const RANKS = { ACE: "A", KING: "K", QUEEN: "Q", JACK: "J" };

const $ = (id) => document.getElementById(id);
const el = {
  bankTop: $("bank-top"),
  bankBig: $("bank-big"),
  inPlay: $("in-play"),
  refill: $("refill-btn"),
  betAmt: $("bet-amt"),
  pile: $("pile"),
  shoeCount: $("shoe-count"),
  dealerHand: $("dealer-hand"),
  playerHand: $("player-hand"),
  dealerScore: $("dealer-score"),
  playerScore: $("player-score"),
  banner: $("banner"),
  dockLbl: $("dock-lbl"),
  chips: [...document.querySelectorAll(".rack .chip")],
  clear: $("clear-btn"),
  hit: $("hit-btn"),
  stand: $("stand-btn"),
  double: $("double-btn"),
  deal: $("deal-btn"),
  status: $("status"),
  hist: $("hist"),
  playerWins: $("player-wins"),
  dealerWins: $("dealer-wins"),
  pushes: $("pushes"),
  fan: $("fan"),
};

const deck = new Deck(6);

const state = {
  // "bet" (placing a bet) | "busy" (waiting on cards) | "play" (your move) | "done"
  phase: "bet",
  bet: 0,
  doubled: false,
  player: [],
  dealer: [],
  holeHidden: true,
  lastDelta: 0,
  history: [],
  userId: null,
  // Bumped when the signed-in user changes so in-flight hands are dropped.
  table: 0,
  saved: freshSave(),
};

function freshSave() {
  return { bank: START_BANK, wins: 0, losses: 0, pushes: 0 };
}

// ---------- Persistence (per user, on this device) ----------

function storageKey() {
  return `${STORAGE_PREFIX}:${state.userId}`;
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()));
    if (saved && typeof saved === "object") return { ...freshSave(), ...saved };
  } catch {
    // Storage unavailable (private mode, blocked cookies): start fresh.
  }
  return freshSave();
}

function save() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state.saved));
  } catch {
    // Non-fatal: progress just won't survive a reload.
  }
}

// ---------- Cards ----------

/** Converts a Deck of Cards API card into { r, s, code } for display. */
function face(card) {
  return { r: RANKS[card.value] ?? card.value, s: SUIT_SYMBOLS[card.suit], code: card.code };
}

/** @param c display card, or null for a face-down card */
function cardElement(c) {
  const div = document.createElement("div");
  if (!c) {
    div.className = "card back";
    div.setAttribute("role", "img");
    div.setAttribute("aria-label", "Face-down card");
    div.innerHTML = `<div class="seal"><img src="${OWL}" alt=""></div>`;
    div.dataset.code = "back";
    return div;
  }
  const red = c.s === "♥" || c.s === "♦";
  div.className = red ? "card red" : "card";
  div.setAttribute("role", "img");
  div.setAttribute("aria-label", `${c.r} of ${SUIT_NAMES[c.s]}`);
  const index = `<span>${c.r}</span><span>${c.s}</span>`;
  const middle = /[JQK]/.test(c.r)
    ? `<div class="court"><img src="${OWL}" alt=""></div>`
    : `<div class="pip">${c.s}</div>`;
  div.innerHTML = `<div class="ix">${index}</div>${middle}<div class="ix br">${index}</div>`;
  div.dataset.code = c.code ?? `${c.r}${c.s}`;
  return div;
}

function renderHand(container, cards, hideSecond) {
  // Keep cards already on the table so they don't replay the deal animation;
  // only add new cards or swap ones that changed (the dealer's hole card).
  cards.forEach((card, i) => {
    const shown = hideSecond && i === 1 ? null : face(card);
    const code = shown ? shown.code : "back";
    const existing = container.children[i];
    if (existing && existing.dataset.code === code) return;
    const node = cardElement(shown);
    if (existing) existing.replaceWith(node);
    else container.appendChild(node);
  });
  while (container.children.length > cards.length) container.lastElementChild.remove();
}

// ---------- Rendering ----------

const fmt = (n) => n.toLocaleString("en-US");

function renderPile() {
  el.pile.replaceChildren();
  let rest = state.bet;
  let n = 0;
  for (const v of CHIP_VALUES) {
    while (rest >= v && n < MAX_PILE) {
      const chip = document.createElement("div");
      chip.className = `chip c${v}`;
      chip.style.top = `${20 - n * 6}px`;
      chip.innerHTML = `<span>${v}</span>`;
      el.pile.appendChild(chip);
      rest -= v;
      n += 1;
    }
  }
}

function renderHistory() {
  if (state.history.length === 0) {
    el.hist.innerHTML = '<li class="empty">No hands yet. Place a bet and deal.</li>';
    return;
  }
  el.hist.replaceChildren(
    ...state.history.map((h) => {
      const li = document.createElement("li");
      const cards = h.cards
        .map((c) => `<span${c.s === "♥" || c.s === "♦" ? ' class="rd"' : ""}>${c.r}${c.s}</span>`)
        .join(" ");
      const tone = h.delta > 0 ? "up" : h.delta < 0 ? "down" : "even";
      const amount = h.delta > 0 ? `+${fmt(h.delta)}` : h.delta < 0 ? `−${fmt(-h.delta)}` : "±0";
      li.innerHTML = `<span class="cards">${cards}</span><span class="what">${h.label}</span><span class="d ${tone}">${amount}</span>`;
      return li;
    })
  );
}

function scoreText(cards) {
  if (cards.length === 0) return "–";
  const { total, soft } = handTotal(cards);
  return soft && total < 21 ? `SOFT ${total}` : String(total);
}

function render() {
  const { phase, bet, saved } = state;
  const bank = saved.bank;
  const inHand = phase === "play" || phase === "busy";

  el.bankTop.textContent = fmt(bank);
  el.bankBig.textContent = fmt(bank);
  el.betAmt.textContent = fmt(bet);
  el.inPlay.textContent =
    bet > 0 ? (inHand ? `${fmt(bet)} in play this hand` : `Next bet: ${fmt(bet)}`) : "Tap a chip to bet";
  el.refill.hidden = !(bank < MIN_CHIP && bet === 0 && !inHand);
  if (deck.id) el.shoeCount.textContent = `${deck.remaining} cards left`;
  renderPile();

  renderHand(el.dealerHand, state.dealer, state.holeHidden);
  renderHand(el.playerHand, state.player, false);
  el.dealerScore.textContent =
    state.holeHidden && state.dealer.length ? scoreText([state.dealer[0]]) : scoreText(state.dealer);
  el.playerScore.textContent = scoreText(state.player);
  el.playerScore.className = phase === "done" && state.lastDelta > 0 ? "score you win" : "score you";

  // While a hand is in play its bet is already out of the bank.
  const available = inHand ? bank : bank - bet;
  for (const chip of el.chips) chip.disabled = inHand || Number(chip.dataset.v) > available;
  el.clear.disabled = inHand || bet === 0;
  el.hit.disabled = phase !== "play";
  el.stand.disabled = phase !== "play";
  el.double.disabled = phase !== "play" || state.player.length !== 2 || bank < bet;
  el.deal.disabled = inHand || bet === 0 || bet > bank;
  el.deal.textContent = phase === "done" ? "DEAL AGAIN" : "DEAL";
  el.dockLbl.textContent = inHand ? "YOUR MOVE" : "PLACE YOUR BET";

  el.playerWins.textContent = saved.wins;
  el.dealerWins.textContent = saved.losses;
  el.pushes.textContent = saved.pushes;
}

function setStatus(message = "", tone = "info") {
  el.status.textContent = message;
  el.status.dataset.tone = tone;
}

function showBanner(title, sub, tone) {
  el.banner.className = tone ? `banner ${tone}` : "banner";
  el.banner.innerHTML = "<b></b><span></span>";
  el.banner.querySelector("b").textContent = title;
  el.banner.querySelector("span").textContent = sub;
  el.banner.hidden = false;
}

// ---------- Betting ----------

function clearTable() {
  state.player = [];
  state.dealer = [];
  state.holeHidden = true;
  state.phase = "bet";
  el.banner.hidden = true;
}

function addChip(value) {
  if (!state.userId) return;
  if (state.phase === "done") clearTable();
  if (state.phase !== "bet" || state.bet + value > state.saved.bank) return;
  state.bet += value;
  setStatus();
  render();
}

function clearBet() {
  if (state.phase === "done") clearTable();
  if (state.phase !== "bet") return;
  state.bet = 0;
  render();
}

function refill() {
  state.saved.bank = START_BANK;
  save();
  render();
}

// ---------- Game flow ----------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const OUTCOME_BANNERS = {
  [OUTCOMES.PLAYER_BUST]: (b) => ["BUST", `Over 21. Dealer takes ${fmt(b.bet)}.`, "lose"],
  [OUTCOMES.PLAYER_BLACKJACK]: (b) => ["BLACKJACK!", `You win ${fmt(b.won)} chips. Go Owls!`, ""],
  [OUTCOMES.DEALER_BLACKJACK]: (b) => ["DEALER BLACKJACK", `Dealer takes ${fmt(b.bet)}.`, "lose"],
  [OUTCOMES.DEALER_BUST]: (b) => ["DEALER BUSTS", `You win ${fmt(b.won)} chips. Go Owls!`, ""],
  [OUTCOMES.PLAYER_WIN]: (b) => ["YOU WIN", `${b.p} beats ${b.d}. +${fmt(b.won)} chips.`, ""],
  [OUTCOMES.DEALER_WIN]: (b) => ["DEALER WINS", `${b.d} beats ${b.p}.`, "lose"],
  [OUTCOMES.PUSH]: (b) => ["PUSH", `Tie at ${b.p}. Your bet comes back.`, "push"],
};

/** A doubled bet drops back to the original stake for the next hand. */
function restoreStake() {
  if (state.doubled) state.bet /= 2;
  state.doubled = false;
}

function finishRound() {
  state.holeHidden = false;
  const outcome = determineOutcome(state.player, state.dealer);
  const returned = payout(outcome, state.bet);
  const result = outcomeResult(outcome);
  const { saved } = state;

  saved.bank += returned;
  if (result === "win") saved.wins += 1;
  else if (result === "loss") saved.losses += 1;
  else saved.pushes += 1;
  save();

  state.lastDelta = returned - state.bet;
  const [title, sub, tone] = OUTCOME_BANNERS[outcome]({
    bet: state.bet,
    won: state.lastDelta,
    p: handTotal(state.player).total,
    d: handTotal(state.dealer).total,
  });
  showBanner(title, sub, tone);

  state.history.unshift({
    cards: state.player.map(face),
    label: title.charAt(0) + title.slice(1).toLowerCase().replace("!", ""),
    delta: state.lastDelta,
  });
  state.history = state.history.slice(0, HISTORY_LENGTH);
  renderHistory();

  restoreStake();
  if (state.bet > saved.bank) state.bet = 0;
  state.phase = "done";
  render();
}

/** The card server failed mid-hand: void the hand and refund the bet. */
function voidHand(error) {
  console.error(error);
  state.saved.bank += state.bet;
  save();
  restoreStake();
  clearTable();
  setStatus(`Couldn't reach the card dealer (${error.message}). Your bet was returned. Please try again.`, "error");
  render();
}

async function deal() {
  if (!state.userId || state.phase === "busy" || state.phase === "play") return;
  if (state.phase === "done") clearTable();
  if (state.bet <= 0 || state.bet > state.saved.bank) return render();

  const table = state.table;
  state.saved.bank -= state.bet;
  save();
  state.phase = "busy";
  state.doubled = false;
  setStatus();
  render();

  try {
    await deck.ensureCards(RESHUFFLE_THRESHOLD);
    const [p1, d1, p2, d2] = await deck.draw(4);
    if (table !== state.table) return;
    state.player = [p1, p2];
    state.dealer = [d1, d2];
    state.holeHidden = true;
  } catch (error) {
    if (table === state.table) voidHand(error);
    return;
  }

  if (isBlackjack(state.player) || isBlackjack(state.dealer)) {
    finishRound();
    return;
  }
  state.phase = "play";
  render();
}

/** Draws one card into `hand`; false if the table changed while waiting. */
async function drawFor(hand, table) {
  const [card] = await deck.draw(1);
  if (table !== state.table) return false;
  hand.push(card);
  return true;
}

async function hit() {
  if (state.phase !== "play") return;
  const table = state.table;
  state.phase = "busy";
  render();
  try {
    if (!(await drawFor(state.player, table))) return;
  } catch (error) {
    if (table === state.table) voidHand(error);
    return;
  }

  const { total } = handTotal(state.player);
  if (isBust(state.player)) finishRound();
  else if (total === 21) await dealerTurn();
  else {
    state.phase = "play";
    render();
  }
}

async function doubleDown() {
  if (state.phase !== "play" || state.player.length !== 2 || state.saved.bank < state.bet) return;
  const table = state.table;
  state.saved.bank -= state.bet;
  state.bet *= 2;
  state.doubled = true;
  save();
  state.phase = "busy";
  render();
  try {
    if (!(await drawFor(state.player, table))) return;
  } catch (error) {
    if (table === state.table) voidHand(error);
    return;
  }
  if (isBust(state.player)) finishRound();
  else await dealerTurn();
}

async function dealerTurn() {
  const table = state.table;
  state.phase = "busy";
  state.holeHidden = false;
  render();
  try {
    while (dealerShouldHit(state.dealer)) {
      await sleep(DEALER_DELAY_MS);
      if (!(await drawFor(state.dealer, table))) return;
      render();
    }
  } catch (error) {
    if (table === state.table) voidHand(error);
    return;
  }
  await sleep(DEALER_DELAY_MS / 2);
  if (table !== state.table) return;
  finishRound();
}

function stand() {
  if (state.phase !== "play") return;
  dealerTurn();
}

// ---------- Wiring ----------

for (const chip of el.chips) chip.addEventListener("click", () => addChip(Number(chip.dataset.v)));
el.clear.addEventListener("click", clearBet);
el.refill.addEventListener("click", refill);
el.deal.addEventListener("click", deal);
el.hit.addEventListener("click", hit);
el.stand.addEventListener("click", stand);
el.double.addEventListener("click", doubleDown);

document.addEventListener("keydown", (event) => {
  if (!state.userId || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target instanceof HTMLElement ? event.target : null;
  if (target?.closest("input, textarea")) return;
  const key = event.key.toLowerCase();
  if (key === "h") hit();
  else if (key === "s") stand();
  else if (key === "d") doubleDown();
  else if (key === "enter" && !target?.closest("button")) {
    event.preventDefault();
    deal();
  }
});

// auth.js announces sign-in / sign-out; load that player's chips and record.
document.addEventListener("auth-change", (event) => {
  const userId = event.detail.user?.id ?? null;
  if (userId === state.userId) return;
  state.userId = userId;
  state.table += 1;
  state.saved = userId ? load() : freshSave();
  state.bet = 0;
  state.doubled = false;
  state.history = [];
  clearTable();
  setStatus();
  renderHistory();
  render();
});

// Decorative card fan on the landing page.
[
  ["J", "♣", 0, 40, -16],
  ["Q", "♦", 90, 14, -6],
  ["K", "♥", 184, 8, 5],
  ["A", "♠", 280, 30, 15],
].forEach(([r, s, left, top, angle]) => {
  const card = cardElement({ r, s });
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
  card.style.transform = `rotate(${angle}deg)`;
  el.fan.appendChild(card);
});

render();
