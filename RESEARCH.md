# Research notes & design decisions

## v1.3 — tracking money without a salary

The owner is a trader: income is irregular (profits are cashed out a few times a year), so income-based measures — savings rate, 50/30/20 "saved", FI number from income − spending — say little or mislead. v1.3 drops income, savings rate and FI planning entirely and builds on **balance snapshots**. Later sections of this file describe the earlier design; the parts about income, savings rate and FI no longer apply.

**Snapshots instead of cash flow.** Net-worth trackers that don't sync banks (spreadsheet trackers, Monarch/Origin-style manual accounts) rely on periodic balance updates; monthly is the common rhythm, and the change between snapshots *is* the result — no need to split it into "saved" vs "market". The app shows change per update, 12-month change and cash runway (cash & savings ÷ usual monthly spending).

**Allocation & rebalancing.** Allocation is shown by type, custody and purpose. Target allocation uses the **5/25 threshold rule** (Larry Swedroe; widely used by Bogleheads-style investors): rebalance an asset class when it drifts more than 5 percentage points from target, or more than 25% of its target weight, whichever is smaller. Out-of-band types are listed on the Moves page with the amount to add or take out.

**Interest follow-up.** Banks typically quote APY, compound daily and credit monthly. The app grows each yield account at its APY daily from the last recorded balance — (1 + APY)^(days/365) — so the curve matches the bank's between updates. "Earned since last update" and "this year" are estimates from that curve; each manual balance update (which includes the interest actually paid) restarts it. APY changes are kept with a start date so past periods use the old rate. Idle cash (cash/savings with no APY) and debt APR costs are shown alongside; paying a debt whose APR beats the blended savings APY is flagged as a guaranteed return.

**Moves.** A planned transfer between two of your own accounts is not spending. Marking it done writes both new balances into today's snapshot (converted between currencies, or the amount you say arrived), and can be undone. Each move shows its interest effect: amount × (APY of destination − APY of source), or the APR of a debt it pays down.

**Linking spending to balances (optional).** An expense can be taken off the account it was paid from; the change goes into today's snapshot, is reversed on edit/delete, and is overridden by the next manual balance update — so manual updates stay the source of truth.

**Journal.** The emotional journal returned (no trading fields). Insights compares everyday spending (bills excluded) on good vs low mood, calm vs stressed and rested vs tired days, as a reflection prompt rather than a statistical claim.

Sources: Monarch — net worth tracking (monarch.com/features/tracking); Origin (useorigin.com); Young and the Invested — net worth tracking cadence (youngandtheinvested.com); NerdWallet — compound interest; Marcus — savings calculator (daily compounding, monthly crediting); The Finance Buff — 5% rebalancing band; Monevator — threshold rebalancing; Equicurious — rebalancing bands.


## Part 0 — Expense tracking (v1.0, finance-only app)

The app was split in v1.0: the trading journal and daily journal moved to the archive branch, and the app became a finance tracker (spending + net worth). Research summary for the spending side:

**What good expense trackers do** (Rocket Money, Simplifi, Monarch, Copilot, YNAB and similar):
- quick manual entry
- customizable categories (emoji, user-defined)
- budgets per category and overall
- recurring-bill / subscription detection with an annual-cost view
- a calendar of spending and upcoming bills
- spending trends and month-over-month comparison
- payee/merchant breakdowns

**Categories:** keep 10–20 main categories and add subcategories only when you'll act on them. Categories carry budgets; tags are free-form labels across categories (e.g. a trip). Split a transaction only when it adds value — not implemented in v1.

**50/30/20 rule:** of after-tax income, about 50% goes to needs (housing, utilities, groceries, transport, insurance, minimum debt payments), 30% to wants (dining out, entertainment, travel, hobbies) and 20% to savings. Each category is tagged need or want, and "saved" = income − spending. Moving money into savings is *not* logged as spending.

**Fixed vs variable:** fixed costs (rent, insurance, subscriptions) are predictable and compound silently, so they're worth an annual audit. The app shows monthly fixed costs, cost per year and subscriptions per year.

**Pace / safe to spend:** daily budgeting apps (DaySum, DailyBudget, BUDGT) show "budget left ÷ days left". This app also subtracts bills still due this month. The month-end projection = spent so far + current daily pace × days left + bills still due.

**Sources:**
- [CNBC — best expense tracker apps](https://www.cnbc.com/select/best-expense-tracker-apps/)
- [Engadget — best budgeting apps](https://www.engadget.com/apps/best-budgeting-apps-120036303.html)
- [NerdWallet — 50/30/20 calculator](https://www.nerdwallet.com/finance/learn/nerdwallet-budget-calculator)
- [Ramsey — 50/30/20 explained](https://www.ramseysolutions.com/budgeting/50-20-30-budget-rule)
- [Quicken — categories and tags](https://www.quicken.com/blog/best-tools-for-tracking-and-managing-expenses-with-detailed-categories-and-tags-2026/)
- [Quicken — splitting a transaction](https://info.quicken.com/sim/splitting-a-transaction-across-categories)
- [Expense categorisation guide](https://expensekitapp.com/blog/5-smart-ways-to-categorize-expenses/)
- [PocketGuard — recurring expenses](https://pocketguard.com/blog/recurring-and-non-recurring-expenses/)
- [Subscription audit](https://usfinancecalculators.com/personal-finance/subscription-audit-annual-cost-calculator/)
- [DaySum (safe-to-spend)](https://apps.apple.com/us/app/daysum-daily-spending-limit/id6778561064)
- [BUDGT](https://www.budgt.ch/)

---

*The notes below are from the earlier trading-journal version and are kept for reference; the net-worth parts still apply.*


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


---

## Part 3 — Swing trading (v0.4 focus)

The app is now tuned for a swing trader taking roughly 10 trades a month and holding them for days to weeks, rather than a day trader. Low trade frequency changes what matters:

| What changes | Why | Where in the app |
|---|---|---|
| **Thesis written at entry** (setup + catalyst + invalidation) | The single most useful field. You can compare the outcome with what you expected, not just with the price. | Trade form, *Thesis* section |
| **Catalyst, timeframe, market regime, sector, conviction** | With few trades, you learn from *categories*. Win rate on earnings plays vs technical breakouts, and whether high conviction actually pays. | Pro form → Reports › Setups |
| **Planned vs actual holding period**, days held | Swing edges usually live in a specific holding window. Holding losers longer than winners is the classic leak. | Reports › Timing, Performance "R vs days held" |
| **Initial stop (= 1R) vs current/trailed stop** | R is measured on the initial risk. The trailed stop decides what's still at risk. | Form + Open positions |
| **Mid-trade updates** | A two-minute daily note per open position builds a timeline you review at exit. | Daily journal check-in → trade timeline |
| **Exit reason** | Target / stopped / trailed / thesis invalidated / time stop… shows *how* trades end and which exits leak. | Close dialog, Reports › Risk |
| **Overnight costs**: funding, borrow, swap | Real money on multi-day crypto perps and shorts. | Pro form |
| **Open positions with live prices**: unrealised P&L, R now, distance to stop/target | For swing trading the open book is what you manage daily. | Open positions |
| **Portfolio heat** = Σ loss if every current stop is hit ÷ capital | The key risk number for overlapping positions. Common guideline: keep it under ~6%. | Open positions, Performance |
| **Risk % of capital per trade** | Standard sizing discipline (0.5–1% typical). | Form preview |

Intraday-only analytics were removed or demoted: hour-of-day, minutes-held buckets, and daily Sharpe and green/red days, which are meaningless at around 10 trades a month.

## Part 4 — Net worth, deeper

Commercial trackers (Kubera, Empower, Monarch) centre on aggregation plus a dashboard. Planners add ratio analysis and concentration checks. What was added in v0.4:

- **Fixed-yield accounts:** APY on savings, money-market funds and staking. Balances grow daily as `last balance × (1 + APY)^(days/365)`, and a live "earned today" ticker shows yield per day, month and year.
- **Custody / counterparty:** each asset is tagged bank, broker, crypto exchange (CEX), DeFi/DEX protocol, self-custody wallet, or physical. Exchange balances carry counterparty risk (insolvency, freezes); self-custody trades that for key-loss risk. Analytics shows the split and its history.
- **Purpose buckets:** emergency fund, trading capital, long-term, retirement, crypto, short-term goals… These answer "what is this money *for*", alongside "what is it".
- **Liquidity ladder:** cash (instant) → liquid investments (days) → locked/retirement → illiquid (months+).
- **Concentration:** largest investments as % of investable assets, plus the *effective number of positions* = 1 ÷ Herfindahl index of weights. The home is excluded on purpose.
- **Balance-sheet health scorecard:** planner rules of thumb, shown as guidelines.

  | Measure | Guideline |
  |---|---|
  | Emergency fund | 3–6+ months |
  | Savings rate | 20%+ |
  | Debt-to-asset | < 50% |
  | Solvency | > 50% |
  | Investable share of net worth | 25–50%+ |
  | Passive-income coverage | yield income ÷ expenses |
  | Largest position | < ~20% |
  | Single custodian type, exchange exposure | flagged as concentration |
- **Growth:** CAGR of net worth, average change per update, share of periods that were up.

Trading capital can sit in net worth either as a *linked* account (balance follows the journal) or as a manual one. They are kept separate by default, as decided.

## Part 5 — Daily journal

Research on trading psychology and performance journaling points to a short, *daily* routine as the habit that matters:
- **Morning check-in:** mood, energy, focus, sleep, intention, habits, optional market plan.
- **Evening reflection:** day rating, discipline, what went well, what to improve, gratitude, a lesson for tomorrow.
- **Insights:** streaks, 7-day-smoothed mood/energy, sleep, habit completion, mood by weekday, and day P&L when in a good vs low mood and after 7h+ vs short sleep. Small samples are labelled as noisy.

## Design language (v0.4)

The design is modelled on Claude's interface:
- **Colours:** warm ivory (#faf9f5) and charcoal (#262624) neutrals, with a clay accent (#c96442 / #d97757).
- **Typography:** serif display type for headings and numbers, and the system sans for UI.

Claude's actual typefaces are proprietary, so **Source Serif 4** (SIL OFL, vendored locally) stands in for the serif. The colour values are close approximations, not official tokens. The chart palette leads with clay and was checked with a colour-vision-deficiency validator.

Sources (additional):
- [Swing trading journal: fields that matter](https://traderssecondbrain.com/guides/trading-journal-for-swing-trading)
- [JournalPlus — swing trading journal guide](https://journalplus.co/learn/guides/swing-trading-journal-guide/)
- [Kubera review](https://thecollegeinvestor.com/36895/kubera-review/)
- [FPA Journal — personal financial ratios](https://www.financialplanningassociation.org/sites/default/files/2021-10/JAN06%20JFP%20Farrell%20PDF.pdf)
- [Concentration risk / Herfindahl index](https://en.wikipedia.org/wiki/Concentration_risk)
- [Self-custody vs exchange custody](https://www.cointracker.com/blog/towards-sovereignty-crypto-self-custody)
