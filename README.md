# Ledgerline — spending & net worth tracker

A private, local-first finance tracker that runs in the browser. It does two things:

- **Spending** — log expenses and income in seconds (button or the `N` key), see where money goes month by month, set budgets, and track bills & subscriptions.
- **Net worth** — everything you own and owe, valued over time, with analytics and financial-independence planning.

Everything is stored in the browser (IndexedDB). There is no server, no account and no tracking, and backups are password-encrypted.

**Live:** https://kubnev.github.io/Trading-journal/

## Spending
- **Transactions:** amount, category, date and a note. Pro input adds subcategory, merchant, payment method, account, tags, need/want, "repeats" and "leave out of totals".
- **Spending dashboard** (month by month):
  - spending through the month vs last month and your budget pace
  - projected month-end and a safe amount to spend per day
  - categories vs your 3-month average
  - income vs spending and savings rate
  - needs · wants · saved compared with the 50/30/20 guideline
  - spending by weekday and top merchants
- **Calendar:** daily spending heat-map, income, and bills coming up.
- **Budgets:** a monthly total plus optional per-category limits, an even-pace marker, and "fill from my averages".
- **Bills & subscriptions:** recurring items (weekly, monthly, quarterly or yearly) are added automatically on their due date or kept as reminders. The page shows fixed costs per month and subscriptions per year.
- **Categories:** 15 editable categories, each marked need or want, with optional subcategories.
- **Bank CSV import:** handles signed amounts or separate money-out/money-in columns and European number formats. Duplicates are skipped, and merchants you've categorised before are recognised. Everything can be exported back to CSV.

## Net worth
Six simple account types (Cash, Savings, Trading capital, Investments, Assets, Debt), or detailed categories in Pro mode. The rest of the net-worth side:
- dated balance snapshots, plus accounts with a fixed yield (APY) that grow daily
- holdings with live prices
- custody, purpose and liquidity analytics
- FI planning that uses your real spending history

## Simple or Pro input
Chosen on first launch and changeable in Settings. The mode only changes **how much you fill in**. Every page, chart and report is available in both, and switching never deletes anything.

## Currencies
Every account, transaction and bill keeps its own currency. Totals are converted to the display currency using ECB reference rates (via Frankfurter, with Coinbase as fallback), at the rate of each transaction's or snapshot's date.

## The old trading-journal version
The full previous app (trading journal, daily journal and net worth) is preserved on the branch [`archive/trading-journal-v0.7.1`](https://github.com/kubnev/Trading-journal/tree/archive/trading-journal-v0.7.1). Use *Code → Download ZIP* on that branch to get it. Data from that version is converted automatically:
- Net-worth accounts that were linked to a trading account become normal accounts holding their value at the time of conversion.
- Monthly cash-flow totals become transactions.
- Old trades and journal entries stay untouched in the browser database. They're not shown, and "Delete all data" removes them.

## Live prices for holdings
Net-worth accounts can track individual holdings (quantity × price). **Update prices** fetches prices directly from the browser:
- **Crypto:** Binance public API, with Coinbase as fallback. No key needed. Binance is unavailable from US IPs, so US users get Coinbase.
- **Stocks/ETFs:** Finnhub. It needs a free API key, which you add under Settings → Price data. The key is stored only in your browser.
- **Currency:** USD prices are converted to your base currency with ECB rates (Frankfurter), with Coinbase rates as fallback.

Each update writes today's snapshot, so the history builds itself.

## Releasing a new version
1. Bump `APP_VERSION` in `js/version.js` and add a `CHANGELOG` line.
2. Run `node scripts/version.mjs "release notes"`. This regenerates `version.json`, which the in-app "Check for app update" reads.
3. Commit and push to `main`.

## Design language
Modelled on Claude's interface. The colour tokens at the top of `css/app.css` are close approximations, not official values:
- **Light:** ivory `#faf9f5` with a clay `#c96442` accent.
- **Dark:** charcoal `#262624` with a clay `#d97757` accent.
- **Type:** headings use a serif. Source Serif 4 (OFL, in `vendor/fonts`) stands in for Claude's proprietary typefaces.
- **Modes:** Light / Dark / Auto.

To reuse the design in other apps, copy the token block and the `@font-face` rules.

## Run locally
The app uses ES modules, so it must be served over HTTP rather than opened as a file:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Publish with GitHub Pages
Repository → **Settings → Pages** → *Deploy from a branch* → pick the branch and `/ (root)` → Save.
There is no build step: `index.html` at the root is the site.

## Structure
```
index.html               app shell (Content-Security-Policy, no inline scripts)
css/app.css              styles (light/dark tokens)
vendor/                  Chart.js 4 (MIT) and Source Serif 4 (OFL), vendored — no CDN
js/main.js               router, navigation, quick add, notices
js/store.js              IndexedDB persistence, backup validation, wipe
js/migrate.js            one-time conversion from the trading-journal version
js/backup.js, crypto.js  password-encrypted backups (AES-256-GCM, PBKDF2)
js/fx.js                 currencies & exchange rates
js/spend/                categories, calculations, transaction form, views, CSV
js/networth/             calculations, live prices, views
js/home.js               overview page
js/mode.js               Simple / Pro input mode
js/tips.js               "?" help on every field
js/help.js               help drawer + guided tour
js/demo.js               demo data
```
