import * as store from './store.js';
import { html, raw, $, $$, esc, toast, download, today } from './ui.js';
import { destroyAll } from './charts.js';
import { checkForUpdate, applyUpdate } from './version.js';

import homeView from './home.js';
import settingsView from './settings.js';
import * as T from './trading/views.js';
import * as N from './networth/views.js';
import * as J from './journal/views.js';
import { openHelp, maybeStartTour } from './help.js';
import { migrateCurrencies, refreshRates, ensureRates, currenciesInUse, usingFallback } from './fx.js';

// Grouped navigation. `pro: true` items only appear in Pro mode.
const I = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  grid: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z',
  wallet: 'M3 7h18v12H3zM3 11h18M16 15h2',
  refresh: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4',
  flow: 'M4 17l6-6 4 4 6-8M14 7h6v6',
  pie: 'M12 3v9h9A9 9 0 1 1 12 3zM15 3.5A9 9 0 0 1 20.5 9H15z',
  star: 'M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z',
  pen: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  cal: 'M5 4h14v16H5zM5 9h14M9 2v4M15 2v4',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  list: 'M4 6h16M4 12h16M4 18h10',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  book: 'M4 4h7v16H4zM13 4h7v16h-7z',
  bank: 'M3 10h18L12 4zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
};
const NAV = [
  { group: null, items: [{ path: '/', label: 'Overview', icon: I.home }] },
  { group: 'Net worth', items: [
    { path: '/networth', label: 'Net worth', icon: I.grid },
    { path: '/networth/accounts', label: 'Accounts & holdings', icon: I.wallet },
    { path: '/networth/update', label: 'Update balances', icon: I.refresh },
    { path: '/networth/analytics', label: 'Analytics', icon: I.pie, pro: true },
    { path: '/networth/cashflow', label: 'Cash flow', icon: I.flow, pro: true },
    { path: '/networth/plan', label: 'FI planning', icon: I.star, pro: true },
  ] },
  { group: 'Journal', items: [
    { path: '/journal', label: 'Today', icon: I.pen },
    { path: '/journal/history', label: 'History', icon: I.cal },
    { path: '/journal/insights', label: 'Insights', icon: I.bulb },
  ] },
  { group: 'Trading', items: [
    { path: '/trading/positions', label: 'Open positions', icon: I.target },
    { path: '/trading/trades', label: 'Trade log', icon: I.list },
    { path: '/trading', label: 'Performance', icon: I.chart },
    { path: '/trading/reports', label: 'Reports', icon: I.chart, pro: true },
    { path: '/trading/playbook', label: 'Playbook', icon: I.book, pro: true },
    { path: '/trading/accounts', label: 'Trading accounts', icon: I.bank },
  ] },
];
const ALL_ITEMS = NAV.flatMap(g => g.items);

const ROUTES = [
  [/^\/$/, homeView],
  [/^\/settings$/, settingsView],
  [/^\/trading$/, T.dashboard],
  [/^\/trading\/positions$/, T.positions],
  [/^\/trading\/trades$/, T.tradeList],
  [/^\/trading\/new$/, T.tradeEdit],
  [/^\/trading\/trade\/([\w-]+)$/, T.tradeDetail],
  [/^\/trading\/trade\/([\w-]+)\/edit$/, T.tradeEdit],
  [/^\/trading\/reports$/, T.reports],
  [/^\/trading\/playbook$/, T.playbook],
  [/^\/trading\/accounts$/, T.accounts],
  [/^\/journal$/, J.today],
  [/^\/journal\/history$/, J.history],
  [/^\/journal\/insights$/, J.insights],
  [/^\/networth$/, N.overview],
  [/^\/networth\/update$/, N.update],
  [/^\/networth\/accounts$/, N.accounts],
  [/^\/networth\/analytics$/, N.analytics],
  [/^\/networth\/cashflow$/, N.cashflow],
  [/^\/networth\/plan$/, N.plan],
];
// old links keep working
const REDIRECTS = { '/trading/journal': '/journal', '/trading/calendar': '/journal/history' };

const icon = d => raw(`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`);

export const currentPath = () => (location.hash.replace(/^#/, '').split('?')[0] || '/');
export const query = () => new URLSearchParams(location.hash.split('?')[1] || '');
export const go = path => { location.hash = '#' + path; };

function sectionOf(path) { return path.startsWith('/networth') ? 'networth' : path.startsWith('/trading') ? 'trading' : null; }

const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
const resolvedTheme = () => { const t = store.getSettings().theme; return t === 'auto' || !t ? (darkMQ.matches ? 'dark' : 'light') : t; };
function applyTheme() {
  const s = store.getSettings();
  const t = resolvedTheme();
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('tj.theme', s.theme || 'auto'); } catch {}
  document.documentElement.dataset.pnl = s.pnlColors;
}

const THEME_LABEL = { auto: 'Auto', light: 'Light', dark: 'Dark' };

function renderShell(path) {
  const s = store.getSettings();
  const mode = s.mode;
  // most specific nav item that matches the current path
  const match = ALL_ITEMS.filter(i => i.path === path || (i.path !== '/' && path.startsWith(i.path + '/')) || (i.path === '/trading/trades' && path.startsWith('/trading/trade'))).sort((a, b) => b.path.length - a.path.length)[0];
  $('#sidebar').innerHTML = String(html`
    <a class="brand" href="#/"><span class="brand-mark" aria-hidden="true"></span><span>Journal</span><span class="beta">beta</span></a>
    <div class="mode-switch" role="radiogroup" aria-label="Detail level" data-tour="mode" title="Simple shows the essentials. Pro unlocks every field, report and chart — everywhere.">
      <button role="radio" data-mode="simple" class="${mode !== 'pro' ? 'on' : ''}" aria-checked="${mode !== 'pro'}">Simple</button>
      <button role="radio" data-mode="pro" class="${mode === 'pro' ? 'on' : ''}" aria-checked="${mode === 'pro'}">Pro</button>
    </div>
    <nav class="nav" data-tour="nav">${NAV.map(g => html`${g.group ? html`<div class="nav-group">${g.group}</div>` : ''}${g.items.filter(i => !i.pro || mode === 'pro').map(i => html`<a href="#${i.path}" class="${match === i ? 'active' : ''}">${icon(i.icon)}<span>${i.label}</span></a>`)}`)}</nav>
    <div class="sidebar-foot">
      <a href="#/settings" data-tour="settings" class="${path === '/settings' ? 'active' : ''}">${icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z')}<span>Settings & data</span></a>
      <div class="theme-switch" role="radiogroup" aria-label="Theme">${['light', 'dark', 'auto'].map(t => html`<button role="radio" data-theme-set="${t}" aria-checked="${(s.theme || 'auto') === t}">${THEME_LABEL[t]}</button>`)}</div>
      <div class="local-badge" title="All data is stored in this browser only (IndexedDB). Nothing is uploaded.">● Stored locally in this browser</div>
    </div>`);
  $$('[data-mode]').forEach(b => b.onclick = async () => {
    await store.saveSettings({ mode: b.dataset.mode });
    // If a Pro-only page is open and we switch to Simple, go to the closest non-Pro page
    if (match?.pro && b.dataset.mode === 'simple') go(match.path.startsWith('/trading') ? '/trading' : '/networth'); else route();
  });
  $$('[data-theme-set]').forEach(b => b.onclick = async () => { await store.saveSettings({ theme: b.dataset.themeSet }); applyTheme(); route(); });
}

let cleanup = null;
let routing = false, again = false, dirty = false;
export async function route() {
  if (routing) { again = true; return; }
  routing = true; again = false; dirty = false;
  try {
    const path = currentPath();
    if (REDIRECTS[path]) { routing = false; location.replace('#' + REDIRECTS[path] + (location.hash.includes('?') ? '?' + location.hash.split('?')[1] : '')); return; }
    applyTheme();
    renderShell(path);
    destroyAll();
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    const main = $('#main');
    let view = null, params = [];
    for (const [re, v] of ROUTES) { const m = path.match(re); if (m) { view = v; params = m.slice(1); break; } }
    document.body.classList.toggle('home', path === '/');
    if (!view) { main.innerHTML = `<div class="page"><h1>Not found</h1><p><a href="#/">Go home</a></p></div>`; return; }
    main.innerHTML = '';
    const page = document.createElement('div');
    page.className = 'page';
    main.append(page);
    cleanup = await view(page, params, { mode: store.getSettings().mode });
    if (store.getSettings().mode !== 'pro' && ALL_ITEMS.find(i => i.path === path)?.pro) page.insertAdjacentHTML('afterbegin', '<div class="notice"><span>This is a Pro page — switch to <b>Pro</b> at the top of the sidebar to see it in the menu.</span></div>');
    notices(page);
    main.scrollTop = 0;
    window.scrollTo(0, 0);
    const h = page.querySelector('h1');
    document.title = (h ? h.textContent + ' · ' : '') + 'Journal';
    // a newly used currency gets real exchange rates without needing a reload
    ensureRates().then(r => { if (r && !r.skipped && r.ok) softRoute(); }).catch(() => {});
  } catch (e) {
    console.error(e);
    $('#main').innerHTML = `<div class="page"><h1>Something went wrong</h1><pre class="err">${esc(e.stack || e.message)}</pre></div>`;
  } finally { routing = false; if (again) route(); }
}
// Background re-render (rates loaded, update found): never wipe a half-filled form or an open dialog
function softRoute() {
  if (dirty || document.querySelector('.modal-wrap')) return false;
  route(); return true;
}

// ---------- beta notices: backup reminder + new-version banner ----------
let updateInfo = null;
const dismissed = new Set();
function notices(page, only) {
  const s = store.getSettings();
  const own = c => store.all(c).some(x => !x.demo);
  const hasData = own('trades') || own('nwAccounts') || own('days');
  const stale = !s.lastBackupAt || Date.now() - new Date(s.lastBackupAt) > 7 * 864e5;
  const items = [];
  if (currenciesInUse().length && usingFallback() && !dismissed.has('fx')) items.push(['fx', 'Exchange rates haven\'t loaded yet — other currencies are converted with approximate rates.', 'Retry']);
  if (updateInfo?.available && !dismissed.has('update')) items.push(['update', `Version ${updateInfo.latest} is available.`, 'Load it now']);
  if (hasData && stale && !dismissed.has('backup')) items.push(['backup', s.lastBackupAt ? `Last backup was ${Math.floor((Date.now() - new Date(s.lastBackupAt)) / 864e5)} days ago. Your data only lives in this browser.` : 'You haven\'t backed up yet. Your data only lives in this browser.', 'Back up now']);
  for (const [k, text, label] of items) {
    if (only && k !== only) continue;
    const d = document.createElement('div');
    d.className = 'notice';
    d.innerHTML = `<span>${text}</span><span class="spacer"></span><button class="btn sm primary" data-n="${k}">${label}</button><button class="btn sm ghost" data-x="${k}">Later</button>`;
    d.querySelector('[data-n]').onclick = async () => {
      if (k === 'update') return applyUpdate(updateInfo.files);
      if (k === 'fx') { const r = await refreshRates({ force: true }); toast(r.ok ? 'Exchange rates loaded' : 'Still offline: ' + (r.errors || []).join(' '), r.ok ? 'info' : 'error'); return route(); }
      const b = await store.exportBackup();
      download(`journal-backup-${today()}.json`, JSON.stringify(b));
      await store.saveSettings({ lastBackupAt: new Date().toISOString() });
      toast('Backup downloaded'); d.remove();
    };
    d.querySelector('[data-x]').onclick = () => { dismissed.add(k); d.remove(); };
    page.prepend(d);
  }
}

// Re-render the current view (used after data changes that the view doesn't handle itself)
export const refresh = () => route();

async function boot() {
  try { await store.init(); }
  catch (e) {
    $('#main').innerHTML = `<div class="page"><h1>Storage unavailable</h1><p>This browser blocked local storage (IndexedDB). Private/incognito windows in some browsers do this. Your data can only be saved when local storage is allowed.</p><pre class="err">${esc(e.message)}</pre></div>`;
    return;
  }
  applyTheme();
  // In Auto mode, follow OS light/dark changes live (charts re-render with new colours)
  darkMQ.addEventListener('change', () => { if ((store.getSettings().theme || 'auto') === 'auto') softRoute(); });
  window.addEventListener('hashchange', route);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (window.innerWidth < 900) document.body.classList.remove('nav-open'); }, 150); });
  $('#menu-btn').onclick = () => document.body.classList.toggle('nav-open');
  $$('[data-help]').forEach(b => b.onclick = () => openHelp(currentPath()));
  document.addEventListener('keydown', e => { if (e.key === '?' && !e.target.closest('input,textarea,select')) openHelp(currentPath()); });
  $('#sidebar').addEventListener('click', e => { if (e.target.closest('a')) document.body.classList.remove('nav-open'); });
  route();
  maybeStartTour();
  // exchange rates for multi-currency data (cached; refreshed at most twice a day)
  $('#main').addEventListener('input', () => { dirty = true; });
  // Surface unexpected errors instead of failing silently (beta). Benign browser noise is ignored.
  window.addEventListener('error', e => { const m = e.message || ''; if (/ResizeObserver|^Script error/.test(m)) return; toast('Something went wrong: ' + (m || 'unknown error'), 'error'); });
  window.addEventListener('unhandledrejection', e => toast('Something went wrong: ' + (e.reason?.message || e.reason || 'unknown error'), 'error'));
  // Quietly check for a newer deployed version
  setTimeout(async () => { try { updateInfo = await checkForUpdate(); if (updateInfo.available && !softRoute()) { const pg = $('#main .page'); if (pg) notices(pg, 'update'); } } catch {} }, 4000);
}
boot();
