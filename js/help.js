// Help drawer (page-specific help + full guide) and a short guided tour of the app.
import * as store from './store.js';
import { html, raw, esc } from './ui.js';

const GUIDE = [
  { id: 'overview', title: 'Overview', match: p => p === '/', body: `
    <p>Your daily home page: what you've spent this month, budget left and a safe amount per day, savings, net worth and the bills coming up.</p>
    <ul><li><b>+ Add expense</b> (or press <kbd>N</kbd> anywhere) logs a transaction in a few seconds.</li>
    <li>The <b>Today</b> list nudges the habits that keep the numbers accurate: log spending, update balances monthly, back up weekly.</li>
    <li><b>Earned today from yields</b> ticks up live if you have accounts with a fixed yield (APY).</li></ul>` },
  { id: 'spending', title: 'Spending', match: p => p === '/spending', body: `
    <p>Month-by-month view of where your money goes. Use ← → to move between months.</p>
    <ul><li><b>Spending through the month</b> — cumulative spending vs last month and your budget pace. Above the budget line = spending too fast.</li>
    <li><b>Projected month-end</b> = spent so far + your average daily spend for the remaining days + bills still due.</li>
    <li><b>Safe to spend per day</b> = budget left, minus bills still due this month, divided by the days left.</li>
    <li><b>Needs · wants · saved</b> compares you with the 50/30/20 guideline (50% needs, 30% wants, 20% saved). Each category is a need or a want — change it on Categories.</li>
    <li><b>Categories</b> table compares this month with your 3-month average; click a row to see its transactions.</li></ul>` },
  { id: 'transactions', title: 'Transactions', match: p => p === '/spending/transactions', body: `
    <p>Every expense and income, grouped by day. Filter by type, category or text; switch to <b>All time</b> to search everything.</p>
    <ul><li>Click a transaction to edit or delete it.</li>
    <li><b>Import CSV</b> takes your bank's statement export: map the columns once, duplicates are skipped and merchants you've categorised before are recognised.</li>
    <li>Only log <i>spending</i> and <i>income</i>. Moving money between your own accounts (e.g. into savings) isn't spending — update it on Net worth instead.</li>
    <li>Pro input adds subcategory, merchant, payment method, account, tags, need/want and "repeats".</li></ul>` },
  { id: 'calendar', title: 'Calendar', match: p => p === '/spending/calendar', body: `<p>Each day shows what you spent (darker = more), income in green and 🔁 bills that are coming up. Click a day to see its transactions or add one on that date. "—" marks a no-spend day.</p>` },
  { id: 'budgets', title: 'Budgets', match: p => p === '/spending/budgets', body: `
    <p>Set a total monthly budget and, optionally, limits for the categories you want to watch (eating out, shopping…).</p>
    <ul><li>The marker on each bar is where you'd be if you spent evenly through the month — ahead of it means slow down.</li>
    <li><b>Fill from my averages</b> pre-fills each limit with your recent average, so you start from reality.</li>
    <li>Leave the total blank to use the sum of the category limits.</li></ul>` },
  { id: 'recurring', title: 'Bills & subscriptions', match: p => p === '/spending/recurring', body: `
    <p>Everything that repeats: rent, utilities, phone, gym, streaming, insurance — and income like your salary.</p>
    <ul><li>With <b>add automatically</b> on, each payment is logged on its due date when you open the app. Off = a reminder you confirm with <b>Mark paid</b>.</li>
    <li><b>Fixed costs / month</b> and <b>Subscriptions / year</b> make forgotten subscriptions visible — review them once a year.</li>
    <li>Upcoming bills also show on the Overview, the Calendar and in the month-end projection.</li></ul>` },
  { id: 'categories', title: 'Categories', match: p => p === '/spending/categories', body: `<p>Rename, add or remove spending categories and choose whether each is a <b>need</b> or a <b>want</b> (drives the 50/30/20 view). Pro input adds subcategories. 10–20 categories is the sweet spot — enough detail to act on, few enough to log quickly.</p>` },
  { id: 'nw', title: 'Net worth', match: p => p === '/networth', body: `
    <p>Net worth = everything you own − everything you owe. It's built from <b>snapshots</b>: the value of each account on a date. Update monthly (or whenever you like); accounts you don't touch carry their last value forward.</p>
    <ul><li><b>Change per period</b> splits each change into money you saved (income − spending from the Spending section) and market moves.</li>
    <li><b>Liquid net worth</b> counts only what you could reach in days, minus all debts.</li>
    <li>The range buttons (1Y/3Y/5Y) zoom the charts.</li></ul>` },
  { id: 'accounts', title: 'Accounts & holdings', match: p => p === '/networth/accounts', body: `
    <p>Add every asset and debt. For each asset you can set:</p>
    <ul><li><b>Held at</b> — bank, broker, crypto exchange (CEX), DeFi/DEX, self-custody wallet… Used for counterparty-risk analytics.</li>
    <li><b>Purpose</b> — e.g. Emergency fund, Trading capital, Long-term. Shows as buckets in Analytics.</li>
    <li><b>Fixed yield (APY)</b> — savings accounts, money-market funds, staking. The balance then grows every day automatically; you only re-enter it when it really changes.</li>
    <li><b>Track individual holdings</b> — enter coins/stocks and quantities; <b>↻ Update prices</b> fetches live prices (crypto: Binance → Coinbase; stocks: Finnhub with a free key in Settings).</li>
    <li><b>Currency</b> — each account keeps its own currency (EUR, USD, GBP…). Totals and charts are converted into the display currency from Settings using ECB rates; past snapshots use the rate of that date.</li>
    <li><b>Close</b> an account when sold or paid off — its history stays.</li></ul>` },
  { id: 'update', title: 'Update balances', match: p => p === '/networth/update', body: `
    <p>Record what each account is worth on a date. Fields are pre-filled with the latest values (including yield growth), so you only change what moved. Holdings and linked trading accounts fill themselves.</p>` },
  { id: 'analytics', title: 'Net worth analytics', match: p => p === '/networth/analytics', body: `
    <ul><li><b>Where it's held</b> — exposure to each type of custodian. Large balances on exchanges are a counterparty risk.</li>
    <li><b>Liquidity ladder</b> — cash → liquid investments → locked/retirement → illiquid.</li>
    <li><b>Effective positions</b> — 1 ÷ Herfindahl index: how diversified your assets really are.</li>
    <li><b>Balance-sheet health</b> — planner rules of thumb (emergency fund, savings rate, debt-to-asset, concentration…). Guidelines, not laws.</li></ul>` },
  { id: 'plan', title: 'FI planning', match: p => p === '/networth/plan', body: `<p><b>FI number</b> = annual expenses ÷ withdrawal rate (4% → 25×). <b>Coast FI</b> = what you need invested today to reach the FI number by your target age without adding more. Projections use real (after-inflation) returns. Target allocation shows drift and how much to move to rebalance.</p>` },
  { id: 'settings', title: 'Settings & data', match: p => p === '/settings', body: `<ul><li><b>Backups</b> — your data lives only in this browser. Export a backup regularly (you'll be reminded weekly). Backups are encrypted with a password you choose — keep it somewhere safe, a lost password can't be recovered.</li><li><b>Delete all data</b> — the Danger zone wipes everything this app stored in this browser.</li><li><b>Price data</b> — optional Finnhub key for stock prices.</li><li><b>Payment methods</b> — the list offered on the Pro expense form. <b>Transactions CSV</b> — import your bank statement or export everything.</li><li><b>Check for app update</b> — load the newest version.</li></ul>` },
  { id: 'general', title: 'Simple / Pro, themes & shortcuts', match: () => false, body: `<ul><li><b>Simple / Pro input</b> (Settings → Input mode) decides how much you fill in when adding accounts and expenses. Every page and chart is the same in both, and switching never deletes anything.</li><li><b>Theme</b> — Light, Dark or Auto (follows your device).</li><li>Press <kbd>?</kbd> anywhere to open this help.</li><li>Everything is stored in this browser (IndexedDB). Nothing is uploaded.</li><li><b>N</b> — add an expense from any page.</li></ul>` },
];

let drawer = null;
export function openHelp(path) {
  closeHelp();
  const here = GUIDE.find(g => g.match(path));
  drawer = document.createElement('div');
  drawer.className = 'drawer-wrap';
  drawer.innerHTML = String(html`<aside class="drawer" role="dialog" aria-modal="true" aria-label="Help">
    <header><h2>Help</h2><button class="icon-btn" data-x aria-label="Close help">✕</button></header>
    <div class="drawer-body">
      <button class="btn primary" data-tour-start>Take the 1-minute tour</button>
      ${here ? html`<section class="help-here"><h3>On this page</h3><h2>${here.title}</h2><div class="help-text">${raw(here.body)}</div></section>` : ''}
      <h3 class="mt">All features</h3>
      ${GUIDE.filter(g => g !== here).map(g => html`<details class="help-item"><summary>${g.title}</summary><div class="help-text">${raw(g.body)}</div></details>`)}
    </div></aside>`);
  document.body.append(drawer);
  drawer.addEventListener('mousedown', e => { if (e.target === drawer) closeHelp(); });
  drawer.querySelector('[data-x]').onclick = closeHelp;
  drawer.querySelector('[data-tour-start]').onclick = () => { closeHelp(); startTour(); };
  document.addEventListener('keydown', escClose);
  drawer.querySelector('[data-x]').focus();
}
function escClose(e) { if (e.key === 'Escape') closeHelp(); }
export function closeHelp() { drawer?.remove(); drawer = null; document.removeEventListener('keydown', escClose); }

// ---------- tour ----------
const STEPS = [
  { title: 'Welcome', text: 'Ledgerline tracks two things: <b>what you spend</b> and <b>what you\'re worth</b>. Here is where everything lives.' },
  { sel: '[data-tour=add]', title: 'Add an expense', text: 'The fastest way in: amount, category, done. Works from every page — or just press <b>N</b>.' },
  { sel: '.nav a[href="#/spending"]', title: 'Spending', text: 'Your month at a glance: spending vs last month and budget, categories, needs vs wants, income vs spending.' },
  { sel: '.nav a[href="#/spending/calendar"]', title: 'Calendar', text: 'What you spent each day and which bills are coming up.' },
  { sel: '.nav a[href="#/spending/budgets"]', title: 'Budgets', text: 'Set a monthly limit and get a safe amount to spend per day.' },
  { sel: '.nav a[href="#/spending/recurring"]', title: 'Bills & subscriptions', text: 'Rent, bills, subscriptions and salary — added automatically on their due dates, with the yearly cost of every subscription.' },
  { sel: '.nav a[href="#/networth/accounts"]', title: 'Accounts', text: 'Add your cash, savings, trading capital, investments, the things you own and any debts.' },
  { sel: '.nav a[href="#/networth/update"]', title: 'Update balances', text: 'Once a month, record what each account is worth. Each update becomes a point on your net-worth history.' },
  { sel: '[data-tour=settings]', title: 'Back up your data', text: 'Everything lives only in this browser. Export a password-protected backup from Settings — you\'ll get a weekly reminder.' },
  { sel: '[data-tour=help]', title: 'Help any time', text: 'Click <b>?</b> (or press the ? key) for help about the page you\'re on. Every field also has a <b>?</b> you can hover or tap.' },
];

let tourEl = null, step = 0;
export function startTour() {
  endTour();
  step = 0;
  tourEl = document.createElement('div');
  tourEl.className = 'tour';
  tourEl.innerHTML = '<div class="tour-spot"></div><div class="tour-card" role="dialog" aria-live="polite"></div>';
  document.body.append(tourEl);
  window.addEventListener('resize', place);
  document.addEventListener('keydown', tourKeys);
  show();
}
function tourKeys(e) { if (e.key === 'Escape') endTour(); if (e.key === 'ArrowRight') next(1); if (e.key === 'ArrowLeft') next(-1); }
function next(d) { step += d; if (step < 0) step = 0; if (step >= STEPS.length) { endTour(); return; } show(); }
function show() {
  const s = STEPS[step];
  const mobile = window.innerWidth <= 900;
  if (s.sel && mobile && !s.sel.includes('help')) document.body.classList.add('nav-open'); else document.body.classList.remove('nav-open');
  const card = tourEl.querySelector('.tour-card');
  card.innerHTML = `<div class="small muted">${step + 1} / ${STEPS.length}</div><h2>${esc(s.title)}</h2><p>${s.text}</p>
    <div class="row"><button class="btn ghost sm" data-skip>${step === STEPS.length - 1 ? 'Close' : 'Skip tour'}</button><span class="spacer"></span>
    ${step ? '<button class="btn sm" data-back>Back</button>' : ''}<button class="btn primary sm" data-next>${step === STEPS.length - 1 ? 'Done' : 'Next'}</button></div>`;
  card.querySelector('[data-next]').onclick = () => next(1);
  card.querySelector('[data-back]')?.addEventListener('click', () => next(-1));
  card.querySelector('[data-skip]').onclick = endTour;
  setTimeout(place, mobile ? 220 : 0);
  card.querySelector('[data-next]').focus();
}
function place() {
  if (!tourEl) return;
  const s = STEPS[step];
  const spot = tourEl.querySelector('.tour-spot'), card = tourEl.querySelector('.tour-card');
  let target = s.sel ? [...document.querySelectorAll(s.sel)].find(e => e.offsetParent !== null) : null;
  if (!target) { spot.style.cssText = 'left:50%;top:40%;width:0;height:0'; card.style.cssText = 'left:50%;top:40%;transform:translate(-50%,-50%)'; return; }
  const r = target.getBoundingClientRect(), pad = 6;
  spot.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
  const cw = Math.min(340, window.innerWidth - 24);
  let left = r.right + 16, top = r.top;
  if (left + cw > window.innerWidth - 12) { left = Math.max(12, r.left - cw - 16); }
  if (left < 12 || window.innerWidth <= 900) { left = Math.max(12, Math.min(window.innerWidth - cw - 12, r.left)); top = r.bottom + 14; }
  top = Math.max(12, Math.min(top, window.innerHeight - 220));
  card.style.cssText = `left:${left}px;top:${top}px;width:${cw}px`;
}
export async function endTour() {
  if (!tourEl) return;
  tourEl.remove(); tourEl = null;
  document.body.classList.remove('nav-open');
  window.removeEventListener('resize', place);
  document.removeEventListener('keydown', tourKeys);
  await store.saveSettings({ tour: { done: true } });
}

// First visit ever: offer the tour once
export function maybeStartTour() {
  const s = store.getSettings();
  const empty = !store.all('txns').length && !store.all('nwAccounts').length;
  if (!s.tour?.done && empty) setTimeout(startTour, 600);
}
