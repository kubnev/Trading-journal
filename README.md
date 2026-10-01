# Journal — trading journal & net worth tracker

A private, local-first web app with two sections:

- **Trading journal**: trades with scale-in/out executions, R-multiples, a playbook, a daily journal, a P&L calendar, and reports on setups, time, risk (MAE/MFE) and psychology.
- **Net worth**: assets and debts, monthly balance snapshots, allocation, liquidity, cash flow and savings rate, and financial-independence planning (FI number, years to FI, Coast FI).

One global **Simple / Pro** switch (top of the sidebar) applies to both sections. Simple shows the essentials; Pro unlocks every field, report and chart. Both modes use the same data.

**All data stays in the visitor's own browser** (IndexedDB). There is no server, account or tracking. Visitors to the public site each get their own separate, empty journal. Use *Settings & data → Export full backup* regularly.

See [RESEARCH.md](RESEARCH.md) for the metrics, charts and design rationale.

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
The colour tokens at the top of `css/app.css` are shared with `kubnev/bruh-lad`:
- **Light:** warm paper neutrals with an amber `#9a5b13` accent.
- **Dark:** `#151517` background with an amber `#e0a458` accent.
- **Status colours:** green for good/profit, red for danger/loss.
- **Modes:** Light / Dark / Auto.

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
index.html            app shell
css/app.css           styles (dark/light themes)
vendor/chart.umd.min.js  Chart.js 4 (MIT), vendored — no CDN
js/store.js           IndexedDB persistence, backup/restore
js/ui.js              formatting, templating, modal, toasts
js/charts.js          chart presets & theme
js/main.js            router, navigation, notices
js/version.js         app version, changelog, update check
scripts/version.mjs   regenerates version.json
js/demo.js            demo data generator
js/trading/           calc.js (all metrics) + views
js/networth/          calc.js (all metrics), prices.js (live prices) + views
```
