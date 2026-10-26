# ISM4421 — FAU Owls Blackjack

A Blackjack game in Florida Atlantic University colors. Cards come from the free
[Deck of Cards API](https://deckofcardsapi.com), which needs no login or API key.

## Features

- Landing page with email + password sign-in (Supabase Auth)
- Bet with 5 / 25 / 100 / 500 chips from a 1,000-chip bankroll
- **Hit**, **Stand**, **Double down** and **Deal** (keys: `H`, `S`, `D`, `Enter`)
- Blackjack pays 3:2; dealer stands on all 17s
- Scoreboard of your wins vs. the dealer's, plus recent-hand history
- Bankroll and record saved per player in the browser
- 6-deck shoe from the Deck of Cards API that reshuffles when it runs low
- FAU navy, red and silver design (from a Claude Design mockup); works on phones

## Project layout

```
public/            <- everything Netlify serves
  index.html
  css/styles.css
  js/app.js        UI and game flow
  js/auth.js       sign in / create account / sign out (Supabase Auth)
  js/config.js     Supabase project URL and publishable key
  js/blackjack.js  pure Blackjack rules (unit-tested)
  js/deckApi.js    Deck of Cards API client
  assets/owl.png   FAU Owls logo (used for the favicon, cards and table)
  vendor/          supabase-js browser bundle (MIT license)
tests/             unit tests for the rules
netlify.toml       Netlify config (publish dir + security headers)
.github/workflows/supabase-keepalive.yml  keeps the free Supabase project awake
supabase/migrations/                      SQL already applied to the project
```

## Run locally

It's a static site with no build step. Serve the `public` folder with any
static server (ES modules don't load from `file://`):

```sh
npm start            # uses `npx serve public`
# or: python3 -m http.server 8000 -d public
```

Run the unit tests (Node 18+):

```sh
npm test
```

## Login (Supabase)

Players sign in with an email and password before the table appears. Accounts
are stored by Supabase Auth in project `aiitajwhzjcjlckgazhq`; no database
tables are needed. The publishable key in `js/config.js` is meant to be public.

**One required setting:** Supabase's built-in email sender only delivers to
members of your Supabase team, so other players would never get a
confirmation email. Turn confirmation off:

1. Open <https://supabase.com/dashboard/project/aiitajwhzjcjlckgazhq/auth/providers>
2. Click **Email**, switch **Confirm email** off, and **Save**.

To keep email confirmation instead, set up custom SMTP (Authentication →
Emails → SMTP Settings) and set **Site URL** to your Netlify address under
Authentication → URL Configuration.

### "Can't reach the login server"

Free Supabase projects pause after about a week with no activity, and login
fails while paused. The **Keep Supabase awake** GitHub Action pings the database
every three days to prevent this. If the project does pause, open the
[Supabase dashboard](https://supabase.com/dashboard/project/aiitajwhzjcjlckgazhq)
and click **Restore project**.

## Deploy to Netlify

`netlify.toml` already sets the publish directory to `public` with no build
command, so no settings need to be entered by hand.

**Option A: connect the GitHub repo (auto-deploys on every push)**
1. In Netlify, choose **Add new site → Import an existing project → GitHub**.
2. Pick this repository and the branch you want to deploy.
3. Leave the build settings as detected (build command empty, publish `public`) and click **Deploy**.

**Option B: drag and drop**
1. Go to <https://app.netlify.com/drop>.
2. Drag the `public` folder onto the page.

**Option C: Netlify CLI**
```sh
npx netlify-cli deploy --prod --dir public
```

## About the logo

`public/assets/owl.png` is the FAU Owls logo from the design mockup. FAU's logos
are trademarks, so check the university's brand guidelines before publishing
the site beyond class use.
