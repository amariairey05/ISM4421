// Thin client for the Deck of Cards API (https://deckofcardsapi.com).
// No API key or login is required.

const API_BASE = "https://deckofcardsapi.com/api/deck";

export const CARD_BACK_IMAGE = "https://deckofcardsapi.com/static/img/back.png";

async function request(path) {
  const response = await fetch(`${API_BASE}/${path}`);
  if (!response.ok) {
    throw new Error(`Deck of Cards API error (${response.status})`);
  }
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || "Deck of Cards API request failed");
  }
  return data;
}

export class Deck {
  /** @param {number} deckCount number of standard 52-card decks in the shoe */
  constructor(deckCount = 6) {
    this.deckCount = deckCount;
    this.id = null;
    this.remaining = 0;
  }

  async open() {
    const data = await request(`new/shuffle/?deck_count=${this.deckCount}`);
    this.id = data.deck_id;
    this.remaining = data.remaining;
  }

  /** Returns every drawn card to the shoe and shuffles it. */
  async reshuffle() {
    const data = await request(`${this.id}/shuffle/`);
    this.remaining = data.remaining;
  }

  /** Opens the shoe if needed and reshuffles when it runs low. */
  async ensureCards(minimum) {
    if (!this.id) {
      await this.open();
    } else if (this.remaining < minimum) {
      await this.reshuffle();
    }
  }

  async draw(count = 1) {
    const data = await request(`${this.id}/draw/?count=${count}`);
    this.remaining = data.remaining;
    if (data.cards.length < count) {
      throw new Error("The shoe ran out of cards");
    }
    return data.cards;
  }
}
