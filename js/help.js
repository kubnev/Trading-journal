// Help drawer (page-specific help + full guide) and a short guided tour of the app.
import * as store from './store.js';
import { html, raw, esc } from './ui.js';

const GUIDE = [
  { id: 'overview', title: 'Overview', match: p => p === '/', body: `
    <p>Your daily home page. It shows net worth, open positions, this month's trading result and whether today's journal is written.</p>
    <ul><li><b>Today</b> checklist: journal check-in, review open positions, update balances this month, weekly backup.</li>
    <li><b>Earned today from yields</b> ticks up live if you have accounts with a fixed yield (APY).</li></ul>` },
  { id: 'nw', title: 'Net worth', match: p => p === '/networth', body: `
    <p>Net worth = everything you own − everything you owe. It's built from <b>snapshots</b>: the value of each account on a date. Update monthly (or whenever you like); accounts you don't touch carry their last value forward.</p>
    <ul><li><b>Change per period</b> (Pro) splits each change into money you saved (from Cash flow) and market moves.</li>
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
  { id: 'cashflow', title: 'Cash flow', match: p => p === '/networth/cashflow', body: `<p>Log monthly income and expenses. This drives savings rate, emergency-fund months, the FI number and the savings-vs-market split. Money moved into investments is savings, not an expense.</p>` },
  { id: 'plan', title: 'FI planning', match: p => p === '/networth/plan', body: `<p><b>FI number</b> = annual expenses ÷ withdrawal rate (4% → 25×). <b>Coast FI</b> = what you need invested today to reach the FI number by your target age without adding more. Projections use real (after-inflation) returns. Target allocation shows drift and how much to move to rebalance.</p>` },
  { id: 'journal', title: 'Daily journal', match: p => p === '/journal', body: `
    <p>A two-minute daily check-in: mood, energy, sleep, intention and habits in the morning; a short reflection and lesson in the evening. Pro adds focus, discipline, a markets section, gratitude and tags.</p>
    <ul><li><b>Open positions check-in</b> — appears when you hold swing positions. Notes, new stops and prices go straight into each trade's timeline.</li>
    <li>Use ← → or the date picker to write about other days.</li></ul>` },
  { id: 'history', title: 'Journal history', match: p => p === '/journal/history', body: `<p>Month calendar of your entries (mood emoji) and closed-trade results. Click any day to open it. Pro shows a 12-month consistency map.</p>` },
  { id: 'insights', title: 'Journal insights', match: p => p === '/journal/insights', body: `<p>Streaks, mood/energy trends, sleep, habit completion and how your state lines up with trading results. Small samples are noisy — use it as a prompt for reflection.</p>` },
  { id: 'positions', title: 'Open positions', match: p => p === '/trading/positions', body: `
    <ul><li><b>↻ Refresh prices</b> marks crypto and US stocks to market; other assets via <b>Update</b>.</li>
    <li><b>R now</b> = unrealised P&L ÷ initial risk. <b>Portfolio heat</b> = what you'd lose if every current stop is hit — many swing traders keep it under ~6% of capital.</li>
    <li><b>Update</b> moves your stop / adds a note. <b>Partial</b> takes profit on part of the position (25/33/50/75% presets, optional stop to breakeven); <b>Close</b> exits the rest. Each exit keeps its own P&L and R.</li></ul>` },
  { id: 'trade', title: 'Logging a swing trade', match: p => p.startsWith('/trading/new') || p.includes('/edit'), body: `
    <ul><li>Write the <b>thesis</b> before you enter: setup, catalyst, and what would prove you wrong.</li>
    <li>Leave the exit empty while the trade is open. For partial take-profits use <b>Take partial profit</b> on the trade page, or "separate entries & exits" in the form — editing the size never wipes out an earlier partial.</li>
    <li><b>Initial stop</b> defines 1R; <b>current stop</b> is where it is now (trailed). Risk is shown as % of your trading capital.</li>
    <li>After the exit, pick an <b>exit reason</b> and grade the <i>process</i>, not the outcome.</li></ul>` },
  { id: 'log', title: 'Trade log & trade page', match: p => p.startsWith('/trading/trade'), body: `<p>Every trade with filters and sorting. The trade page tells the whole story: thesis, plan, executions, a timeline of your updates, and the review.</p>` },
  { id: 'perf', title: 'Performance', match: p => p === '/trading', body: `
    <ul><li><b>Avg R</b> and <b>profit factor</b> tell you if there's an edge; win rate alone doesn't.</li>
    <li><b>R vs days held</b> (Pro) shows which holding periods work for you.</li>
    <li>Filters at the top apply to everything on the page.</li></ul>` },
  { id: 'reports', title: 'Reports', match: p => p === '/trading/reports', body: `<p>Slices of your results: timing (holding period, month), setups/catalysts/sectors/regime/conviction, risk (R distribution, MAE/MFE, exit reasons, planned vs realised R) and psychology (mistakes, emotions, grades, plan adherence).</p>` },
  { id: 'playbook', title: 'Playbook', match: p => p === '/trading/playbook', body: `<p>Define each setup with a thesis, entry trigger, stop and exit rules, plus a checklist you tick on every trade. Stats per setup show which ones deserve more size.</p>` },
  { id: 'taccounts', title: 'Trading accounts', match: p => p === '/trading/accounts', body: `<p>Starting balance plus deposits/withdrawals gives trading capital, which is used for risk %, heat and drawdown %. A net-worth account can optionally be linked to a trading account so its balance follows the journal.</p>` },
  { id: 'settings', title: 'Settings & data', match: p => p === '/settings', body: `<ul><li><b>Backups</b> — your data lives only in this browser. Export a backup regularly (you'll be reminded weekly). Backups are encrypted with a password you choose — keep it somewhere safe, a lost password can't be recovered.</li><li><b>Delete all data</b> — the Danger zone wipes everything this app stored in this browser.</li><li><b>Price data</b> — optional Finnhub key for stock prices.</li><li><b>Lists</b> — your mistakes, emotions, tags, habits and journal tags.</li><li><b>Check for app update</b> — load the newest version.</li></ul>` },
  { id: 'general', title: 'Simple / Pro, themes & shortcuts', match: () => false, body: `<ul><li><b>Simple / Pro input</b> (Settings → Input mode) decides how much you fill in when adding accounts, trades and journal entries. Every page and chart is the same in both, and switching never deletes anything.</li><li><b>Theme</b> — Light, Dark or Auto (follows your device).</li><li>Press <kbd>?</kbd> anywhere to open this help.</li><li>Everything is stored in this browser (IndexedDB). Nothing is uploaded.</li></ul>` },
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
  { title: 'Welcome', text: 'This app combines three things: your <b>net worth</b>, a <b>daily journal</b>, and a <b>swing-trading</b> log. Here is where everything lives.' },
  { sel: '[data-tour=mode]', title: 'Simple or Pro input', text: 'Shows which input mode you chose. Simple = fewer, plain-language fields; Pro = detailed categories and fields. Every chart and report is available in both — change it in Settings.' },
  { sel: '.nav a[href="#/"]', title: 'Overview', text: 'Your daily home: net worth, open positions, today\'s journal, and a short to-do list.' },
  { sel: '.nav a[href="#/networth/accounts"]', title: 'Accounts & holdings', text: 'Add everything you own and owe. Set where it\'s held (bank, CEX, DeFi, wallet…), its purpose, a fixed yield that grows daily, or individual coins/stocks with live prices.' },
  { sel: '.nav a[href="#/networth/update"]', title: 'Update balances', text: 'Once a month (or whenever), record balances. Each update becomes a point on your net-worth history.' },
  { sel: '.nav a[href="#/journal"]', title: 'Daily journal', text: 'A two-minute check-in: mood, energy, sleep, intention, habits — and a quick check on each open position.' },
  { sel: '.nav a[href="#/trading/positions"]', title: 'Open positions', text: 'Your live swing book: unrealised P&L, R now, distance to stop and target, and total portfolio heat.' },
  { sel: '.nav a[href="#/trading/trades"]', title: 'Trade log', text: 'Log a trade with its thesis before you enter, update it while it runs, and review it when it closes.' },
  { sel: '[data-tour=settings]', title: 'Back up your data', text: 'Everything lives only in this browser. Export a backup from Settings — you\'ll get a weekly reminder.' },
  { sel: '[data-tour=help]', title: 'Help any time', text: 'Click <b>?</b> (or press the ? key) for help about the page you\'re on. That\'s it — enjoy!' },
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
  const empty = !store.all('trades').length && !store.all('nwAccounts').length && !store.all('days').length;
  if (!s.tour?.done && empty) setTimeout(startTour, 600);
}
