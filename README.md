# ISM4421 — FAU Owls Blackjack

A Blackjack game in Florida Atlantic University colors. Cards come from the free
[Deck of Cards API](https://deckofcardsapi.com), which needs no login or API key.

## Features

- **Deal**, **Hit**, and **Stand** (keyboard shortcuts: `D`, `H`, `S`)
- Live hand totals for you and the dealer (soft totals and Blackjack shown)
- Scoreboard of your wins vs. the dealer's wins, plus pushes, saved in the browser
- 6-deck shoe that reshuffles automatically when it runs low
- Standard rules: dealer stands on all 17s, natural Blackjack wins immediately
- Email + password login (Supabase Auth); each player has their own scoreboard
- FAU Blue `#003366`, FAU Red `#CC0000`, and FAU Gray; works on phones

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
  assets/fau-logo.svg
  vendor/          supabase-js browser bundle (MIT license)
tests/             unit tests for the rules
netlify.toml       Netlify config (publish dir + security headers)
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

`public/assets/fau-logo.svg` is a placeholder owl mark drawn in FAU colors. To use
the official FAU logo, save it over that file with the same name (or update the
two `fau-logo.svg` references in `index.html`). FAU's logos are trademarks, so
check the university's brand guidelines before publishing them.
