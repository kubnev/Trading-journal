# Journal — trading journal & net worth tracker

A private, local-first web app with two sections:

- **Trading journal**: trades with scale-in/out executions, R-multiples, a playbook, a daily journal, a P&L calendar, and reports on setups, time, risk (MAE/MFE) and psychology.
- **Net worth**: assets and debts, monthly balance snapshots, allocation, liquidity, cash flow and savings rate, and financial-independence planning (FI number, years to FI, Coast FI).

Each section has a **Simple / Pro** switch. Simple shows the essentials; Pro unlocks every field, report and chart. Both modes use the same data.

**All data stays in the visitor's own browser** (IndexedDB). There is no server, account or tracking. Visitors to the public site each get their own separate, empty journal. Use *Settings & data → Export full backup* regularly.

See [RESEARCH.md](RESEARCH.md) for the metrics, charts and design rationale.

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
js/main.js            router & navigation
js/demo.js            demo data generator
js/trading/           calc.js (all metrics) + views
js/networth/          calc.js (all metrics) + views
```
