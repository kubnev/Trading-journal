// Help drawer (page-specific help + full guide) and a short guided tour of the app.
import * as store from './store.js';
import { html, raw, esc } from './ui.js';
import { startTour } from './tour.js';

const GUIDE = [
  { id: 'overview', title: 'Overview', match: p => p === '/', body: `
    <p>Your daily home page, net worth first: net worth and its 12-month change, liquid net worth, savings rate, the net-worth trend, where your money sits, financial-independence progress and your safety net — then a short look at this month's spending.</p>
    <ul><li>Numbers marked <span class="tag est">estimate</span> use your <a href="#/setup">starting estimates</a>. Once you've logged a full calendar month of transactions, your real averages replace them automatically.</li>
    <li><b>Update balances</b> once a month — each update is a point on your net-worth history.</li>
    <li><b>+ Expense</b> (or the <kbd>N</kbd> key) logs spending from any page.</li></ul>` },
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
  { id: 'recurring', title: 'Subscriptions & bills', match: p => p === '/spending/recurring', body: `
    <p>Everything that repeats: subscriptions (Netflix, Spotify, gym, cloud storage…), bills (rent, utilities, phone, insurance) and income like your salary. For each one set the <b>next charge date</b> — it then repeats on that day — and the <b>account it's charged to</b>.</p>
    <ul><li><b>Active subscriptions</b> tab lists what you're currently paying for; the Spending page shows them too, sorted by charge day.</li><li><b>By account</b> shows how much leaves each account every month.</li><li><b>Pause</b> a subscription you cancelled — no more charges are added and it moves to the Paused tab.</li></ul>
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

