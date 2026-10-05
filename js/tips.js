// "?" help next to form fields and table headers. One dictionary, applied automatically to
// everything rendered (pages, dialogs, re-drawn sections) — hover, focus or tap to read.
//   fields  : looked up by "<form id>:<name>" first, then by input name
//   headers : looked up by the header's text

const F = {
  // ---------- net-worth account ----------
  kind: 'Asset = something you own (cash, investments, a home). Liability = something you owe (loan, card balance). Liabilities are subtracted from net worth.',
  category: 'Groups the account in charts and decides the defaults for “Liquid?” and “Counts toward financial independence?”.',
  'nf:name': 'Any name you’ll recognise, e.g. “Revolut EUR” or “Vanguard ISA”.',
  institution: 'Bank, broker or app where it’s held. Just a label.',
  currency: 'The currency this account is kept in. Enter balances in this currency — totals and charts convert it to your display currency automatically.',
  balance: 'What it’s worth today, in the account’s currency. For debts, the amount you still owe. Saved as today’s snapshot.',
  rate: 'Yearly interest rate on the debt. Used for the weighted average rate and to prioritise payoff.',
  payment: 'Your regular monthly payment on this debt, in the account’s currency.',
  custody: 'Who actually holds the money — bank, broker, crypto exchange, your own wallet… Used to show counterparty risk in Analytics.',
  purpose: 'What this money is for (emergency fund, retirement, house deposit…). Pick one or type your own. Shown as buckets in Analytics.',
  apy: 'Fixed yearly yield (APY). The balance grows a little every day from your last update, and the earnings ticker counts it live. Leave blank if it doesn’t earn a fixed rate.',
  liquid: 'Could you turn it into cash within a few days without a big loss? Yes for cash, savings, stocks, crypto; no for a house, car or locked pension. Auto decides by category.',
  investable: 'Does it count toward financial independence (FI)? Yes for invested money that grows and could fund retirement; no for spending cash, your home or a car. Drives FI progress and projections.',
  tracksHoldings: 'Instead of typing a balance, list what you hold (e.g. 0.5 BTC, 10 AAPL). Value = quantity × price, and prices can update with one click.',
  linkedTradingAccountId: 'Mirror a trading account from the Trading section: this balance then follows its starting balance, deposits and closed trades automatically.',
  'nf:notes': 'Anything you want to remember about this account.',
  d: 'The date you closed it. From this date the account counts as zero; history before it is kept.',

  // ---------- cash flow ----------
  'cf:id': 'Which month this income and spending belongs to.',
  income: 'Money that actually reached you this month after tax (take-home pay, side income).',
  expenses: 'Everything you spent this month, including rent, bills and fun. Used for savings rate, emergency-fund months and the FI number.',
  'cf:notes': 'Anything unusual about the month — a bonus, a big purchase…',

  // ---------- FI plan ----------
  currentAge: 'Your age today. The projection starts here.',
  retirementAge: 'When you’d like work to become optional. Used for the Coast FI figure.',
  annualExpenses: 'What you expect to spend per year once financially independent, in today’s money. Blank = taken from your cash-flow history.',
  withdrawalRate: 'How much of your portfolio you’d take out per year. 4% is the classic rule of thumb; lower is safer. FI number = annual expenses ÷ this rate.',
  expectedReturn: 'Average yearly growth you expect from your investments before inflation. 5–7% is a common long-run assumption for stocks.',
  inflation: 'Expected yearly price increases. Projections are shown in today’s money, so this is subtracted from the return.',
  monthlyContribution: 'How much you add to investments each month. Blank = your average monthly savings from Cash flow.',
  emergencyMonths: 'How many months of expenses you want to keep in cash and savings. 3–6 is the usual target.',

  // ---------- trading account / transfers ----------
  'af:name': 'Any name, e.g. “IBKR swing” or “Bybit”.',
  broker: 'The broker or exchange. Just a label.',
  'af:type': 'Kind of account. Just a label for your reports.',
  startingBalance: 'Cash in the account when you started journaling it, in the account’s currency. Starting balance + deposits + closed P&L = trading capital.',
  startDate: 'The day you started tracking this account. Before this date its value counts as zero.',
  'xf:type': 'Deposit = money moved in. Withdrawal = money taken out. Neither counts as profit or loss.',
  amount: 'How much moved, in the trading account’s currency.',
  'xf:date': 'When the money moved.',
  'xf:note': 'Optional, e.g. “monthly top-up”.',

  // ---------- playbook setup ----------
  'sf:name': 'A short name for the setup, e.g. “Pullback to 21 EMA”.',
  description: 'Why this pattern should make money — the edge in one or two sentences.',
  timeframe: 'The chart timeframe you trade it on.',
  conditions: 'The market environment where it works best (trend, volatility, sector strength…).',
  entry: 'The exact event that gets you in, e.g. “close above the 3-week high on 1.5× volume”.',
  stopRule: 'Where the stop goes and why — the price that proves the idea wrong.',
  exit: 'How you take profits: targets, partials, trailing stop rules.',
  rules: 'One rule per line. Each becomes a checkbox you tick when logging a trade, so you can see whether following the rules pays.',
  active: 'Retired setups are hidden from the trade form but keep their stats.',

  // ---------- trade form ----------
  accountId: 'Which trading account this trade is in. Prices and P&L are in that account’s currency.',
  symbol: 'Ticker or pair, e.g. AAPL, BTC, ETHUSDT. Crypto and US stock prices can be fetched automatically.',
  assetClass: 'Stock, crypto, futures, options, forex… Used for reports, live prices and the default multiplier.',
  side: 'Long = you profit if the price goes up. Short = you profit if it goes down.',
  multiplier: 'How much 1.0 of price movement is worth per unit. 1 for stocks and crypto, 100 for US options, the point value for futures.',
  setupId: 'Which playbook setup this trade follows. Reports then show which setups actually make money.',
  thesis: 'Why you’re taking it: the setup, the catalyst and what would prove you wrong. Written before entry, it’s the most useful thing to review later.',
  catalyst: 'What should move the price: earnings, news, a breakout, a sector rotation…',
  'tf:timeframe': 'The chart timeframe your idea is based on.',
  regime: 'The overall market at entry (uptrend, choppy, risk-off…). Shows whether you trade better in some conditions.',
  sector: 'Industry or theme, e.g. Semis, L1s, Energy. Lets you spot concentration and your best sectors.',
  conviction: 'How confident you were, 1–5. Reports show whether high-conviction trades actually do better.',
  plannedDays: 'How long you expect to hold. Compared with the actual hold to catch overstaying.',
  entryDate: 'The day you entered.',
  entryPrice: 'Average price you paid (or sold at, for a short).',
  qty: 'Number of shares, coins or contracts.',
  exitDate: 'The day you exited. Leave blank while the trade is still open.',
  exitPrice: 'Average price you exited at. Leave blank while still open.',
  fees: 'All commissions and fees for the trade combined. Subtracted from P&L.',
  exitReason: 'Why the trade ended (stop hit, target hit, time stop, thesis broken…). Reports show which exits cost you.',
  funding: 'Overnight financing, borrow fees or perpetual funding. Positive = you paid, negative = you received.',
  'tf:stop': 'Where you planned to get out if wrong, set at entry. Defines your risk: 1R = distance from entry to this stop × size.',
  target: 'Where you planned to take profit. With the stop it gives the planned reward-to-risk.',
  currentStop: 'Where the stop is now if you’ve moved it (e.g. to breakeven). Used for open risk and portfolio heat.',
  riskOverride: 'If you didn’t use a fixed stop, the amount you were prepared to lose. Used instead of the stop to calculate R.',
  mae: 'Maximum adverse excursion: the worst price reached while you held. Shows how much heat your trades take.',
  mfe: 'Maximum favourable excursion: the best price reached while you held. Shows how much of the move you captured.',
  'tf:grade': 'Grade how well you followed your process (A = perfect execution), not whether it made money.',
  followedPlan: 'Did you stick to the entry, stop and exit you planned? Plan adherence is one of the strongest predictors of results.',
  review: 'What happened compared with the plan — what you did well and what you’d change.',
  lessons: 'One takeaway to carry into future trades.',

  // ---------- position dialogs ----------
  mark: 'The latest price. Used for unrealised P&L and “R now”. Crypto and US stocks can be fetched automatically on Open positions.',
  stop: 'Where your stop is now. Used for open risk and portfolio heat.',
  note: 'A short note for the trade timeline — is the thesis still intact? anything changed?',
  'cf:date': 'The day of this exit.',
  'cf:price': 'Price you exited at.',
  'cf:qty': 'How much of the position to close. Use the % buttons for quick partial take-profits.',
  fee: 'Commission for this exit only.',
  reason: 'Why you exited here. Reports group results by exit reason.',
  be: 'Moves the stop on the remaining position to your entry price, so the rest of the trade can’t turn into a loss.',

  // ---------- journal ----------
  mood: 'How you feel today, from 😣 to 😄. Insights compare mood with your trading results.',
  energy: 'Physical and mental energy, 1 (drained) to 5 (sharp).',
  focus: 'How well you can concentrate today, 1–5.',
  sleep: 'Hours slept last night. Insights show whether poor sleep costs you money.',
  intention: 'The one thing that would make today a good day.',
  bias: 'Your read on the market today. Lets you check later whether your bias was right.',
  plan: 'Setups you’re watching and what you’ll avoid today.',
  watchlist: 'Symbols and the price levels you care about.',
  news: 'Earnings, macro data or headlines that could move your positions.',
  dayRating: 'Overall, how was the day? 1–5.',
  discipline: 'How well you stuck to your rules today, 1–5.',
  'jf:grade': 'A letter grade for how you handled the day — process, not P&L.',
  recap: 'A few lines on what happened today.',
  good: 'What went well — worth repeating.',
  improve: 'What you’d do differently.',
  gratitude: 'Something you’re grateful for. Small habit, real effect on mood over time.',
  lesson: 'One rule or lesson for tomorrow. The latest ones show on the Overview.',

  // ---------- settings ----------
  'prefs:currency': 'Totals, charts and dashboards are shown in this currency. Accounts keep their own currency and are converted using ECB rates.',
  locale: 'How numbers and dates are written (1,234.56 vs 1.234,56; month/day order).',
  pnlColors: 'Colours for profit and loss. Blue/orange is easier to tell apart with colour-vision deficiency.',
  theme: 'Light, dark, or follow your device setting.',
  'lists:mistakes': 'Mistake tags offered on the trade form, one per line. Reports total up what each mistake cost.',
  'lists:emotions': 'Emotion tags offered on the trade form, one per line.',
  'lists:tags': 'Free tags for trade conditions (e.g. “Earnings”, “Gap”), one per line.',
  habits: 'Daily habits to tick off in the journal, one per line. Insights show completion rates.',
  dayTags: 'Tags for journal days (e.g. “Travel”, “Sick”), one per line.',
  finnhubKey: 'Free key from finnhub.io for US stock prices. Stored only in this browser and sent only to Finnhub. Crypto prices don’t need a key.',

  // ---------- backup password ----------
  pw: 'Encrypts the backup file. You’ll need the exact same password to restore it — a lost password can’t be recovered.',
  pw2: 'Type the password again to make sure there’s no typo.',
  show: 'Shows the password as you type, so you can check it.',
  plain: 'Saves a normal, readable file with no password. Only for when you really need that — anyone who gets the file can read all your data.',

  // ---------- CSV import ----------
  _datefmt: 'How dates are written in your file. Auto works unless days and months are ambiguous (e.g. 03/04).',
  _account: 'Trading account for rows that don’t name one.',
  _asset: 'Asset class for rows that don’t specify one.',
};

const H = {
  'R': 'R-multiple: profit or loss divided by the amount you risked (entry to stop). +2R = made twice your risk; −1R = lost exactly what you planned.',
  'R now': 'Unrealised P&L divided by your initial risk, at the latest price.',
  'Avg R': 'Average R-multiple per trade — the cleanest measure of edge, independent of position size.',
  'Days': 'How long the trade was (or has been) held.',
  'Net P&L': 'Profit or loss after fees, in your display currency.',
  'P&L': 'Profit or loss after fees.',
  'Unrealised': 'Profit or loss on the open part of the position at the latest price — not locked in yet.',
  'Unrealised P&L': 'Current value minus what you paid (cost basis), not locked in yet.',
  'Stop': 'Current stop price, and how far it is from the latest price.',
  'Target': 'Planned profit target, and how far it is from the latest price.',
  'At risk': 'What you’d give back from the latest price if the current stop is hit.',
  'Size': 'Quantity still open.',
  'Last': 'Latest price and where it came from.',
  'Entry': 'Average entry price.',
  'Exit': 'Average exit price.',
  '% of pos.': 'Share of the full position this entry or exit was.',
  'Exit reason': 'Why the trade ended.',
  'Grade': 'Process grade you gave the trade (A = followed the plan perfectly).',
  'Setup': 'Playbook setup the trade followed.',
  'Win %': 'Share of closed trades that made money.',
  'Expectancy': 'Average profit per trade: what one more trade is worth on average.',
  'PF': 'Profit factor: gross profit ÷ gross loss. Above 1 is profitable; above 1.5 is solid.',
  'Trades': 'Number of closed trades in the group.',
  'Liquid': 'Can it become cash within days without a big loss?',
  'Change': 'Change since the previous balance update.',
  'Trend': 'Balance history of the account.',
  'Weight': 'Share of this account’s holdings.',
  'Cost basis': 'What you paid in total for the holding.',
  'Total cost basis': 'What you paid in total for this holding (optional — enables unrealised P&L).',
  'Source': 'Where the price came from and how fresh it is.',
  'Drift': 'Current share minus target share. Beyond ±5 points is usually worth rebalancing.',
  'To rebalance': 'Roughly how much to add (+) or remove (−) to hit the target allocation.',
  'Target %': 'The share of assets you want in this category. Should add up to 100%.',
  'Current': 'The share of your assets in this category today.',
  'Saved': 'Income minus expenses for the month.',
  'Rate': 'Savings rate: share of income you kept.',
  'Latest balance': 'Most recent recorded value, in the account’s own currency.',
  'Details': 'Custody, purpose, yield and liquidity — or rate and payment for debts.',
  'Guideline': 'A common rule of thumb. Context matters — treat it as a prompt, not a rule.',
  '% of assets': 'This account’s share of everything you own (debts not subtracted).',
  'Balance': 'Latest value, converted to your display currency.',
  'Held': 'How long trades in this group were held.',
  'Discipline': 'Whether you marked the trade as following your plan.',
  'Mistake': 'Mistake tag from the trade form. A trade with two mistakes counts in both rows.',
  'Avg day P&L': 'Average closed-trade P&L on days that match the condition.',
};

const tipFor = el => {
  const name = el.getAttribute('name');
  if (!name) return null;
  const form = el.closest('form')?.getAttribute('id');   // not .id — an input named "id" would shadow it
  const t = (form && F[`${form}:${name}`]) || F[name];
  if (t) return t;
  if (/^chk\d+$/.test(name)) return 'Tick each rule from this setup’s checklist that the trade actually met. Reports compare trades that met all rules with those that didn’t.';
  if (form === 'uf' && el.type === 'number') return 'What this account is worth on the snapshot date, in its own currency (for debts: the amount still owed). Pre-filled with the last known value — change only what moved.';
  return null;
};
const icon = text => { const s = document.createElement('span'); s.className = 'tip'; s.tabIndex = 0; s.setAttribute('role', 'button'); s.setAttribute('aria-label', 'Help: ' + text); s.dataset.tip = text; s.textContent = '?'; return s; };

function decorate(root) {
  // form fields: label.field / label.check holding a named input
  for (const lab of root.querySelectorAll('label.field:not([data-tipped]), label.check:not([data-tipped])')) {
    lab.dataset.tipped = '1';
    if (lab.closest('#mf, [data-notips]')) continue;   // CSV column mapper: the label already says it all
    const input = lab.querySelector('input[name], select[name], textarea[name]');
    const text = input && tipFor(input);
    if (!text) continue;
    if (lab.classList.contains('check')) { lab.append(' ', icon(text)); continue; }
    // after the label's own words, before the hint / control
    const before = [...lab.childNodes].find(n => n.nodeType === 1 && (n.matches('.hint, input, select, textarea, div, datalist') || n.querySelector?.('input,select,textarea')));
    // wrap the label's own words + "?" in one inline line (labels stack their children vertically)
    const line = document.createElement('span'); line.className = 'field-label';
    for (const n of [...lab.childNodes]) { if (n === before) break; line.append(n); }
    line.append(icon(text));
    lab.insertBefore(line, before || null);
  }
  // table headers
  for (const th of root.querySelectorAll('th:not([data-tipped])')) {
    th.dataset.tipped = '1';
    const key = th.textContent.replace(/[↑↓]/g, '').trim();
    if (H[key]) th.append(icon(H[key]));
  }
}

// one floating bubble, positioned inside the viewport
let bubble = null, owner = null;
function show(el) {
  if (!bubble) { bubble = document.createElement('div'); bubble.className = 'tip-bubble'; bubble.setAttribute('role', 'tooltip'); document.body.append(bubble); }
  owner = el; bubble.textContent = el.dataset.tip; bubble.hidden = false;
  const r = el.getBoundingClientRect(), b = bubble.getBoundingClientRect(), W = document.documentElement.clientWidth;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - b.width / 2), W - b.width - 8);
  let top = r.bottom + 8;
  if (top + b.height > window.innerHeight - 8) top = r.top - b.height - 8;
  bubble.style.left = left + 'px'; bubble.style.top = Math.max(8, top) + 'px';
}
function hide() { if (bubble) bubble.hidden = true; owner = null; }

export function initTips() {
  decorate(document.body);
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; decorate(document.body); }); })
    .observe(document.body, { childList: true, subtree: true });
  document.addEventListener('mouseover', e => { const t = e.target.closest?.('.tip[data-tip]'); if (t && t !== owner) show(t); else if (!t && owner && !owner.matches(':focus')) hide(); });
  document.addEventListener('focusin', e => { const t = e.target.closest?.('.tip[data-tip]'); if (t) show(t); });
  document.addEventListener('focusout', e => { if (e.target.closest?.('.tip[data-tip]')) hide(); });
  // a tap/click on "?" shows the help — and must not tick a checkbox, focus the input or sort a column
  document.addEventListener('click', e => {
    const t = e.target.closest?.('.tip[data-tip]');
    if (!t) { if (owner) hide(); return; }
    e.preventDefault(); e.stopPropagation();
    t.focus({ preventScroll: true }); show(t);
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && owner) hide(); });
  window.addEventListener('scroll', () => owner && hide(), true);
}
