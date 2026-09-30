# Research notes & design decisions

What a serious trading journal and a net-worth tracker need, and how each finding maps to the app. Sources at the bottom.

---

## Part 1 — Trading journal

### What professionals actually use a journal for

A journal is useful when it answers three questions:

1. **Do I have an edge?** Expectancy, profit factor and the R-multiple distribution answer this. Win rate on its own does not.
2. **Where does the edge come from, and where does it leak?** Break results down by setup, instrument, time of day, weekday, holding time and side.
3. **Is the problem the strategy or me?** Track rule adherence, mistakes and emotional state. A common guideline: if you follow your rules on fewer than about 75% of trades, the problem is execution, not strategy.

Commercial journals (Tradervue, TraderSync, TradeZella, TradesViz) share a common core: trade import, tagging, a P&L calendar, an equity curve, reports sliced by tag/setup/time, MAE/MFE analysis, a playbook of setups, and a daily journal. The differences between them are mostly broker sync, trade replay and AI features, which all need a server. This app covers the common core and runs entirely in the browser.

### Metrics implemented

| Metric | Formula / meaning | Where |
|---|---|---|
| Net P&L, gross profit/loss, fees | realised on average cost, fees subtracted | Dashboard, Reports |
| Win rate, W/L/BE counts | wins ÷ closed trades | Dashboard |
| Profit factor | gross profit ÷ gross loss (>1.5 solid, >2 strong) | Dashboard |
| Expectancy ($) | net ÷ trades = WR×avgWin − LR×avgLoss | Dashboard |
| Payoff ratio | avg win ÷ avg loss | Dashboard |
| **R-multiple** | net ÷ initial risk (entry→stop × size × multiplier) | every trade |
| Avg R, total R, σ(R) | | Pro dashboard |
| **SQN** (Van Tharp) | √min(N,100) × mean R ÷ σ R | Pro dashboard |
| Max drawdown ($ and % of equity) | peak-to-trough on the closed-P&L equity curve | Pro |
| Recovery factor | net ÷ max DD | Pro |
| Sharpe / Sortino (daily) | mean daily P&L ÷ σ (or downside σ) × √252 | Pro |
| Kelly % | W − (1−W)/payoff (shown as a theoretical ceiling) | Reports |
| Streaks | current, max consecutive W/L | Pro |
| **MAE / MFE** (in R) | worst/best price during the trade vs entry, divided by the stop distance | Risk tab |
| Exit efficiency | (exit−entry)/(MFE−entry), winners only | Risk tab |
| Planned vs realised R | target R:R compared with what you actually got | Risk tab |
| Rule adherence | % of rated trades marked "followed plan" | Psychology tab |
| Cost of mistakes | net P&L of trades tagged with each mistake | Psychology tab |
| Day stats | green/red days, best/worst/avg day | Calendar |

### Charts (and why each one)

| Chart | Type | Question it answers |
|---|---|---|
| Equity curve | line/area | Is the account going up, and how smoothly? |
| Drawdown ("underwater") | area below 0 | How deep and how long are the losing stretches? |
| Daily P&L | bars coloured by sign | Is performance consistent from day to day? |
| P&L calendar + 12-month heatmap | grid | Which days and weeks were good or bad? Clicking a day shows its trades and journal entry. |
| P&L by setup / symbol / tag / emotion / mistake | horizontal bars | Which categories make or lose money? |
| P&L by weekday / hour / hold time / month | bars | When do you trade best? |
| R-multiple distribution | histogram | What does the edge look like? You want small losses and a fat right tail. |
| MAE vs MFE | scatter | Are stops too wide or too tight? Are you leaving profit on the table? |
| Planned vs realised R | scatter with diagonal | Do you follow through on your targets? |
| Position size vs result | scatter | Do big positions lose more often? (a sign of tilt) |
| Rolling expectancy / win rate | line | Is the edge decaying? |
| Trades by asset class | doughnut | Where is your activity concentrated? (part-to-whole of counts, so a doughnut fits) |
| Monthly returns | heat table | Year-by-month view |

Pie/doughnut charts are used only for part-to-whole of positive quantities. They are not used for P&L, which can be negative, and so has no meaningful "share of a whole".

### Trade data model
- **Executions** (buy/sell, time, qty, price, fee) are the source of truth. Scaling in and out is supported, and P&L is realised on average cost.
- Long/short, asset class and **multiplier** (options ×100; point values for common futures such as ES $50, NQ $20, MES $5, CL $1000, GC $100). The multiplier is filled in automatically from the futures symbol.
- Initial stop, target and risk override. MAE/MFE prices.
- Setup (playbook) with a rule checklist, grade A–F (**process, not outcome**), confidence 1–5, a followed-plan flag, and mistake/emotion/condition tags.
- Notes, lessons, and screenshots (paste / drop / pick, stored as blobs in IndexedDB).

### Daily journal
Pre-market: mood/readiness, sleep, bias, max loss for the day, game plan, watchlist/levels, news.
Post-market: recap, what went well, what to improve, lesson for tomorrow, discipline score, day grade, whether you followed your daily rules.
Research consistently finds the daily **routine** is what makes a journal work, so the calendar shows a dot on days that have a journal entry.

### Simple vs Pro
- **Simple:** dashboard (6 KPIs, equity curve, daily P&L), trade list, calendar, daily journal, accounts. The trade form has only the essentials: symbol, side, entry/exit, qty, fees, stop, notes.
- **Pro:** adds Reports (5 tabs), Playbook, the extra KPI row, drawdown, P&L by setup, R distribution, auto-generated insights, and the 12-month heatmap. The trade form adds executions, target, MAE/MFE, psychology fields and screenshots.
- Both modes use the same data, so switching never hides or loses anything.

---

## Part 2 — Net worth

### How net-worth tracking works
Net worth = **assets − liabilities**. You record balances periodically; monthly is the standard cadence. The value comes from the **trend** over time, not from any single number. Each snapshot records the value of every account on a date. Accounts you don't update carry their last known value forward, so you only change what moved.

### What to track
- **Assets** by category: cash, savings, taxable investments, trading accounts, retirement, crypto, real estate, business equity, vehicles, receivables, other.
- **Liabilities**: mortgage, auto, student, credit card, personal, margin, taxes, other. Each can carry an APR and a monthly payment.
- Each asset is classed as **liquid or illiquid** and **investable or not**. The category sets a default, and you can override it per account. A home counts toward net worth but not toward financial independence.
- **Cash flow**: monthly income and expenses. This drives the savings rate, emergency-fund months and the FI number.

### Metrics implemented

| Metric | Definition |
|---|---|
| Net worth, change since last update, change over range, YoY | |
| Liquid net worth | liquid assets − all liabilities (the conservative definition) |
| Debt-to-asset ratio | liabilities ÷ assets (>50% = fragile) |
| Emergency fund (months) | cash + savings ÷ avg monthly expenses (target 3–6) |
| Savings rate (3m, 12m) | (income − expenses) ÷ income |
| Liquid share of assets | warns under 15% |
| Weighted debt APR | balance-weighted interest rate |
| **FI number** | annual expenses ÷ safe withdrawal rate (4% → 25×) |
| FI progress | investable assets ÷ FI number |
| Years to FI / FI age | month-by-month simulation at the expected **real** return plus monthly investing |
| **Coast FI** | FI number ÷ (1 + real return)^(years to target age) |
| Allocation drift | current % vs target % per category, with the $ amount to rebalance |
| Change decomposition | Δ net worth split into **savings** (from cash flow) and **market & other** |

### Charts

| Chart | Type | Why |
|---|---|---|
| Net worth over time (+ assets, liabilities in Pro) | line/area | the core trend |
| Asset allocation | doughnut (≤7 slices, rest folded into "Other") | part-to-whole, where a pie is the right tool |
| Debt breakdown | doughnut | part-to-whole of what you owe |
| Assets by category over time | stacked area | how the mix changes over time |
| Liquidity | meter | a two-part split, so a meter is clearer than a two-slice pie |
| Change per period | stacked bars: savings vs market | shows whether growth came from saving or from returns |
| Income vs expenses | grouped bars | monthly cash flow |
| Savings rate | bars | consistency |
| FI projection | line vs FI-number line | when the lines cross |
| Current vs target allocation | paired horizontal bars | rebalancing |
| Per-account sparklines | tiny lines | trend per account in the table |

### Integration with the trading side
A net-worth account can be **linked to a trading account**. Its balance is then computed automatically as starting balance + deposits − withdrawals + closed P&L from the journal, so you never enter it twice.

---

## Architecture decisions
- **Static site, no build step, no server.** It runs on GitHub Pages as is.
- **IndexedDB** instead of localStorage. localStorage has a ~5 MB cap and can't store screenshots. The app asks the browser for persistent storage so data isn't evicted.
- **Per-visitor privacy:** each browser has its own database. Visitors to the public site never see each other's data.
- **Backups:** full JSON export/import (screenshots included as data URLs), CSV export of trades, and CSV import with column mapping and US/EU date detection.
- **Chart.js 4 vendored** into `vendor/`, so there are no CDN calls and it works offline after the first load.
- **Colour:** P&L polarity is always encoded twice, by bar direction or sign as well as colour. Settings has a blue/orange option for colour-blind users. Category hues come from a colour-vision-validated palette in a fixed order, so a category keeps its colour across charts.

## Known limitations / next steps
- There is one base currency. Multi-currency accounts must be entered at their converted value.
- There are no broker API connections, by design, since there is no server. Use CSV import instead.
- There is no intraday chart with entry/exit markers, which would need market data.
- Possible later additions: broker-specific CSV presets (IBKR, TOS, Tradovate, MT4/5), prop-firm rule tracking (daily loss limit, trailing drawdown), goal tracking for net worth, PWA offline install.

## Sources
- [Optimus Futures — MAE, MFE and R-Multiple](https://optimusfutures.com/blog/the-metrics-to-help-you-improve-your-trading/)
- [Trading journal metrics: expectancy, drawdowns & R-multiples](https://liquidityfinder.com/news/trading-journal-metrics-expectancy-drawdowns-and-r-multiples-explained-fc2af)
- [TradesViz — advanced statistics (MFE/MAE, best exit)](https://www.tradesviz.com/blog/advanced-stats/)
- [TradeZella — what to write in a trading journal](https://www.tradezella.com/blog/what-to-write-in-trading-journal)
- [WealthBee — emotional discipline checklist](https://wealthbee.io/learn/trading-journal-emotional-discipline-checklist/)
- [Tradezella vs Tradervue vs TraderSync comparison](https://www.supertrader.me/compare/tradezella-vs-tradervue-vs-tradersync/)
- [NerdWallet — liquid net worth](https://www.nerdwallet.com/finance/learn/liquid-net-worth)
- [SmartAsset — liquid net worth](https://smartasset.com/financial-advisor/liquid-net-worth)
- [SoFi — personal finance ratios](https://www.sofi.com/learn/content/important-personal-finance-ratios/)
- [Mad Fientist — financial independence spreadsheet](https://www.madfientist.com/financial-independence-spreadsheet/)
- [WalletBurst — savings rate & FIRE calculators](https://walletburst.com/tools/savings-rate-calculator/)
