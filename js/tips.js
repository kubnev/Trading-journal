// "?" help next to form fields and table headers. One dictionary, applied automatically to
// everything rendered (pages, dialogs, re-drawn sections) — hover, focus or tap to read.
//   fields  : looked up by "<form id>:<name>" first, then by input name
//   headers : looked up by the header's text

const F = {
  // ---------- net-worth account ----------
  group: 'Pick the closest fit. Cash = spending money; Savings = money put aside; Trading capital = money in your trading accounts; Investments = long-term holdings; Assets = things you own; Debt = what you owe.',
  kind: 'Asset = something you own (cash, investments, a home). Liability = something you owe (loan, card balance). Liabilities are subtracted from net worth.',
  category: 'Groups the account in charts and decides the defaults for “Liquid?” and “Counts toward financial independence?”.',
  'nf:name': 'Any name you’ll recognise, e.g. “Revolut EUR” or “Vanguard ISA”.',
  institution: 'Bank, broker or app where it’s held. Just a label.',
  currency: 'The currency this account is kept in. Enter balances in this currency — totals and charts convert it to your display currency automatically.',
  balance: 'What it’s worth today, in the account’s currency. For debts, the amount you still owe. Saved as today’s snapshot.',
  rate: 'Yearly interest rate on the debt. Used for the weighted average rate and to prioritise payoff.',
  payment: 'Your regular monthly payment on this debt, in the account’s currency.',
  custody: 'Who actually holds the money — bank, broker, crypto exchange, your own wallet… Used to show counterparty risk in Analytics.',
  purpose: 'What this money is for (emergency fund, retirement, house deposit…). Auto picks one from the category; choose “Other” to name your own. Shown as buckets in Analytics.',
  apy: 'Fixed yearly yield (APY). The balance grows a little every day from your last update, and the earnings ticker counts it live. Leave blank if it doesn’t earn a fixed rate.',
  liquid: 'Could you turn it into cash within a few days without a big loss? Yes for cash, savings, stocks, crypto; no for a house, car or locked pension. Auto decides by category.',
  investable: 'Does it count toward financial independence (FI)? Yes for invested money that grows and could fund retirement; no for spending cash, your home or a car. Drives FI progress and projections.',
  tracksHoldings: 'Instead of typing a balance, list what you hold (e.g. 0.5 BTC, 10 AAPL). Value = quantity × price, and prices can update with one click.',
  'nf:notes': 'Anything you want to remember about this account.',
  d: 'The date you closed it. From this date the account counts as zero; history before it is kept.',

    // ---------- FI plan ----------
  currentAge: 'Your age today. The projection starts here.',
  retirementAge: 'When you’d like work to become optional. Used for the Coast FI figure.',
  annualExpenses: 'What you expect to spend per year once financially independent, in today’s money. Blank = taken from your cash-flow history.',
  withdrawalRate: 'How much of your portfolio you’d take out per year. 4% is the classic rule of thumb; lower is safer. FI number = annual expenses ÷ this rate.',
  expectedReturn: 'Average yearly growth you expect from your investments before inflation. 5–7% is a common long-run assumption for stocks.',
  inflation: 'Expected yearly price increases. Projections are shown in today’s money, so this is subtracted from the return.',
  monthlyContribution: 'How much you add to investments each month. Blank = your average monthly savings from Cash flow.',
  emergencyMonths: 'How many months of expenses you want to keep in cash and savings. 3–6 is the usual target.',

            // ---------- transactions ----------
  'txf:amount': 'How much it cost (or how much came in), always as a positive number. Pick Expense or Income above.',
  'txf:currency': 'The currency you paid in. Totals are converted to your display currency at that day’s exchange rate.',
  'txf:date': 'The day it happened. Defaults to today.',
  'txf:sub': 'A finer split inside the category, e.g. Eating out → Cafés & coffee. Optional.',
  'txf:note': 'A few words so you recognise it later, e.g. “Lunch with Alex”. Searchable.',
  merchant: 'Who you paid (or who paid you). Reports total your spending per merchant, and bank imports use it to auto-categorise.',
  method: 'How you paid — card, cash, transfer… Edit the list in Settings.',
  'txf:accountId': 'Which of your accounts the money came from or went to. A label only — balances are still updated on Net worth.',
  'txf:kind': 'Need = essential (rent, groceries, bills); want = optional (eating out, shopping). Auto uses the category’s setting. Drives the 50/30/20 view.',
  'txf:tags': 'Free labels across categories, e.g. “holiday” or “wedding”, to total a trip or project. Comma separated.',
  repeat: 'Creates a bill/subscription from this transaction, so the next ones are added automatically.',
  exclude: 'Kept in the list but left out of totals, budgets and charts — e.g. something your employer will reimburse.',

  // ---------- starting estimates ----------
  'estf:currency': 'The currency you think in. Totals and charts are shown in it, and your estimates are read in it.',
  'estf:income': 'What reaches your account in a normal month after tax. Used for your savings rate and FI planning until you’ve logged a full month of income.',
  'estf:spending': 'Everything you spend in a normal month — rent, bills, food, fun. Used for emergency-fund months, the FI number and the early-month projection until you have a full month of transactions.',
  'estf:saving': 'What you put aside or invest each month. Blank = income − spending. Used for the FI projection.',
  'estf:budget': 'Optional monthly spending limit. Gives you “left in budget” and a safe amount to spend per day. Per-category limits are on Spending → Budgets.',
  'estf:nwYearAgo': 'Optional rough net worth 12 months ago, so year-on-year growth shows something before you have a year of history.',
  'estf:currentAge': 'Your age — the FI projection starts here.',
  'estf:retirementAge': 'When you’d like work to become optional. Used for the Coast-FI figure.',
  'estf:emergencyMonths': 'How many months of spending you want in cash and savings. 3–6 is the usual target.',

  // ---------- bills & subscriptions ----------
  'rf:name': 'What it is, e.g. Rent, Netflix, Salary.',
  'rf:kind': 'Subscription = something you signed up for (Netflix, Spotify, gym, cloud storage). Bill = rent, utilities, phone, insurance. Income = salary or other regular money in.',
  'rf:accountId': 'The account it’s charged to (or paid into). Shown on the Spending page and in “By account”. A label only — update the balance on Net worth as usual.',
  'rf:amount': 'The amount of each payment, in its currency.',
  'rf:currency': 'The currency it’s charged in.',
  'rf:category': 'Where each payment is counted. Subscriptions are totalled per year on this page.',
  freq: 'How often it repeats. Monthly and yearly payments keep the same day of the month.',
  next: 'The next day it’s charged. It then repeats on that day — e.g. 9 October monthly = every month on the 9th. If the date is in the past and “add automatically” is on, the missed charges are added when you save.',
  auto: 'On: each payment is added to your transactions on its due date. Off: it’s only a reminder — you confirm it with “Mark paid”.',
  until: 'Optional last date, e.g. when a contract ends. Nothing is added after it.',
  'rf:merchant': 'Who you pay. Copied onto each transaction.',
  'rf:method': 'How it’s paid. Copied onto each transaction.',

  // ---------- budgets ----------
  'bf:total': 'Your spending limit for a whole month, in the display currency. Leave blank to use the sum of the category limits.',

  // ---------- payment methods ----------
  payMethods: 'The ways you pay, one per line. Shown as choices on the Pro transaction form.',

  // ---------- settings ----------
  'prefs:currency': 'Totals, charts and dashboards are shown in this currency. Accounts keep their own currency and are converted using ECB rates.',
  locale: 'How numbers and dates are written (1,234.56 vs 1.234,56; month/day order).',
  pnlColors: 'Colours for profit and loss. Blue/orange is easier to tell apart with colour-vision deficiency.',
  theme: 'Light, dark, or follow your device setting.',
  finnhubKey: 'Free key from finnhub.io for US stock prices. Stored only in this browser and sent only to Finnhub. Crypto prices don’t need a key.',

  // ---------- backup password ----------
  pw: 'Encrypts the backup file. You’ll need the exact same password to restore it — a lost password can’t be recovered.',
  pw2: 'Type the password again to make sure there’s no typo.',
  show: 'Shows the password as you type, so you can check it.',
  plain: 'Saves a normal, readable file with no password. Only for when you really need that — anyone who gets the file can read all your data.',

  // ---------- CSV import ----------
  _datefmt: 'How dates are written in your file. Auto works unless days and months are ambiguous (e.g. 03/04).',
};

const H = {
  'Liquid': 'Can it become cash within days without a big loss?',
  'Change': 'Difference vs the previous period — the last balance update on Net worth, your recent average on Spending.',
  'Trend': 'Balance history of the account.',
  'Weight': 'Share of this account’s holdings.',
  'Cost basis': 'What you paid in total for the holding.',
  'Total cost basis': 'What you paid in total for this holding (optional — enables unrealised P&L).',
  'Unrealised P&L': 'Current value minus what you paid (cost basis), not locked in yet.',
  'Source': 'Where the price came from and how fresh it is.',
  'Drift': 'Current share minus target share. Beyond ±5 points is usually worth rebalancing.',
  'To rebalance': 'Roughly how much to add (+) or remove (−) to hit the target allocation.',
  'Target %': 'The share of assets you want in this category. Should add up to 100%.',
  'Current': 'The share of your assets in this category today.',
  'Latest balance': 'Most recent recorded value, in the account’s own currency.',
  'Details': 'Custody, purpose, yield and liquidity — or rate and payment for debts.',
  'Guideline': 'A common rule of thumb. Context matters — treat it as a prompt, not a rule.',
  '% of assets': 'This account’s share of everything you own (debts not subtracted).',
  'Balance': 'Latest value, converted to your display currency.',
  'Avg': 'Your average monthly spending in this category over the last few complete months.',
  'Budget': 'Spending so far against the category’s monthly limit.',
  'Limit': 'Monthly limit for the category. Blank = no limit.',
  'This month': 'Spending so far against the limit. The marker shows where an even pace would be today.',
  'Per month': 'The cost converted to a monthly amount (weekly × 52 ÷ 12, yearly ÷ 12…), in your display currency.',
  'How often': 'Weekly, monthly, every 3 months or yearly.',
  'Next': 'Next payment date. Red = past due and not added yet.',
  'Used': 'How many transactions use this category.',
  'Need / want': 'Need = essential, want = optional. Drives the 50/30/20 view.',
};

const tipFor = el => {
  const name = el.getAttribute('name');
  if (!name) return null;
  const form = el.closest('form')?.getAttribute('id');   // not .id — an input named "id" would shadow it
  const t = (form && F[`${form}:${name}`]) || F[name];
  if (t) return t;
  if (/^c:/.test(name)) return 'Monthly limit for this category. The bar shows spending so far; the marker is where an even pace would be today. Blank = no limit.';
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
