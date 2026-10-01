import * as store from './store.js';
import { html, raw, $, $$, esc, toast, download, today } from './ui.js';
import { destroyAll } from './charts.js';
import { checkForUpdate, applyUpdate } from './version.js';

import homeView from './home.js';
import settingsView from './settings.js';
import * as T from './trading/views.js';
import * as N from './networth/views.js';

// Navigation per section. `pro: true` items only appear in Pro mode.
const NAV = {
  trading: [
    { path: '/trading', label: 'Dashboard', icon: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z' },
    { path: '/trading/trades', label: 'Trades', icon: 'M4 6h16M4 12h16M4 18h10' },
    { path: '/trading/calendar', label: 'Calendar', icon: 'M5 4h14v16H5zM5 9h14M9 2v4M15 2v4' },
    { path: '/trading/reports', label: 'Reports', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2', pro: true },
    { path: '/trading/journal', label: 'Daily journal', icon: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h3' },
    { path: '/trading/playbook', label: 'Playbook', icon: 'M4 4h7v16H4zM13 4h7v16h-7z', pro: true },
    { path: '/trading/accounts', label: 'Accounts', icon: 'M3 7h18v12H3zM3 11h18M7 15h3' },
  ],
  networth: [
    { path: '/networth', label: 'Overview', icon: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z' },
    { path: '/networth/update', label: 'Update balances', icon: 'M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4' },
    { path: '/networth/accounts', label: 'Assets & debts', icon: 'M3 7h18v12H3zM3 11h18M7 15h3' },
    { path: '/networth/cashflow', label: 'Cash flow', icon: 'M4 17l6-6 4 4 6-8M14 7h6v6', pro: true },
    { path: '/networth/plan', label: 'FI planning', icon: 'M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z', pro: true },
  ],
};

const ROUTES = [
  [/^\/$/, homeView],
  [/^\/settings$/, settingsView],
  [/^\/trading$/, T.dashboard],
  [/^\/trading\/trades$/, T.tradeList],
  [/^\/trading\/new$/, T.tradeEdit],
  [/^\/trading\/trade\/([\w-]+)$/, T.tradeDetail],
  [/^\/trading\/trade\/([\w-]+)\/edit$/, T.tradeEdit],
  [/^\/trading\/calendar$/, T.calendar],
  [/^\/trading\/reports$/, T.reports],
  [/^\/trading\/journal$/, T.journal],
  [/^\/trading\/playbook$/, T.playbook],
  [/^\/trading\/accounts$/, T.accounts],
  [/^\/networth$/, N.overview],
  [/^\/networth\/update$/, N.update],
  [/^\/networth\/accounts$/, N.accounts],
  [/^\/networth\/cashflow$/, N.cashflow],
  [/^\/networth\/plan$/, N.plan],
];

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
  const section = sectionOf(path);
  const mode = s.mode;
  const items = section ? NAV[section].filter(i => !i.pro || mode === 'pro') : [];
  const active = i => (i.path === path || (i.path !== '/trading' && i.path !== '/networth' && path.startsWith(i.path)) || (i.path === '/trading/trades' && path.startsWith('/trading/trade'))) ? 'active' : '';
  $('#sidebar').innerHTML = String(html`
    <a class="brand" href="#/"><span class="brand-mark" aria-hidden="true"></span><span>Journal</span><span class="beta">beta</span></a>
    <div class="mode-switch" role="radiogroup" aria-label="Detail level" title="Simple shows the essentials. Pro unlocks every field, report and chart — everywhere.">
      <button role="radio" data-mode="simple" class="${mode !== 'pro' ? 'on' : ''}" aria-checked="${mode !== 'pro'}">Simple</button>
      <button role="radio" data-mode="pro" class="${mode === 'pro' ? 'on' : ''}" aria-checked="${mode === 'pro'}">Pro</button>
    </div>
    <div class="section-switch" role="tablist" aria-label="Section">
      <a role="tab" href="#/trading" class="${section === 'trading' ? 'on' : ''}" aria-selected="${section === 'trading'}">Trading</a>
      <a role="tab" href="#/networth" class="${section === 'networth' ? 'on' : ''}" aria-selected="${section === 'networth'}">Net worth</a>
    </div>
    <nav class="nav">${items.map(i => html`<a href="#${i.path}" class="${active(i)}">${icon(i.icon)}<span>${i.label}</span></a>`)}</nav>
    <div class="sidebar-foot">
      <a href="#/settings" class="${path === '/settings' ? 'active' : ''}">${icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z')}<span>Settings & data</span></a>
      <div class="theme-switch" role="radiogroup" aria-label="Theme">${['light', 'dark', 'auto'].map(t => html`<button role="radio" data-theme-set="${t}" aria-checked="${(s.theme || 'auto') === t}">${THEME_LABEL[t]}</button>`)}</div>
      <div class="local-badge" title="All data is stored in this browser only (IndexedDB). Nothing is uploaded.">● Stored locally in this browser</div>
    </div>`);
  $$('[data-mode]').forEach(b => b.onclick = async () => {
    await store.saveSettings({ mode: b.dataset.mode });
    // If a Pro-only page is open and we switch to Simple, fall back to the section home
    const item = section && NAV[section].find(i => i.path === currentPath());
    if (item?.pro && b.dataset.mode === 'simple') go(section === 'trading' ? '/trading' : '/networth'); else route();
  });
  $$('[data-theme-set]').forEach(b => b.onclick = async () => { await store.saveSettings({ theme: b.dataset.themeSet }); applyTheme(); route(); });
}

let cleanup = null;
let routing = false;
export async function route() {
  if (routing) return; routing = true;
  try {
    const path = currentPath();
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
    notices(page);
    main.scrollTop = 0;
    window.scrollTo(0, 0);
    const h = page.querySelector('h1');
    document.title = (h ? h.textContent + ' · ' : '') + 'Journal';
  } catch (e) {
    console.error(e);
    $('#main').innerHTML = `<div class="page"><h1>Something went wrong</h1><pre class="err">${esc(e.stack || e.message)}</pre></div>`;
  } finally { routing = false; }
}

// ---------- beta notices: backup reminder + new-version banner ----------
let updateInfo = null;
const dismissed = new Set();
function notices(page) {
  const s = store.getSettings();
  const own = c => store.all(c).some(x => !x.demo);
  const hasData = own('trades') || own('nwAccounts') || own('days');
  const stale = !s.lastBackupAt || Date.now() - new Date(s.lastBackupAt) > 7 * 864e5;
  const items = [];
  if (updateInfo?.available && !dismissed.has('update')) items.push(['update', `Version ${updateInfo.latest} is available.`, 'Load it now']);
  if (hasData && stale && !dismissed.has('backup')) items.push(['backup', s.lastBackupAt ? `Last backup was ${Math.floor((Date.now() - new Date(s.lastBackupAt)) / 864e5)} days ago. Your data only lives in this browser.` : 'You haven\'t backed up yet. Your data only lives in this browser.', 'Back up now']);
  for (const [k, text, label] of items) {
    const d = document.createElement('div');
    d.className = 'notice';
    d.innerHTML = `<span>${text}</span><span class="spacer"></span><button class="btn sm primary" data-n="${k}">${label}</button><button class="btn sm ghost" data-x="${k}">Later</button>`;
    d.querySelector('[data-n]').onclick = async () => {
      if (k === 'update') return applyUpdate(updateInfo.files);
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
  darkMQ.addEventListener('change', () => { if ((store.getSettings().theme || 'auto') === 'auto') route(); });
  window.addEventListener('hashchange', route);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (window.innerWidth < 900) document.body.classList.remove('nav-open'); }, 150); });
  $('#menu-btn').onclick = () => document.body.classList.toggle('nav-open');
  $('#sidebar').addEventListener('click', e => { if (e.target.closest('a')) document.body.classList.remove('nav-open'); });
  route();
  // Surface unexpected errors instead of failing silently (beta)
  window.addEventListener('error', e => toast('Something went wrong: ' + (e.message || 'unknown error'), 'error'));
  window.addEventListener('unhandledrejection', e => toast('Something went wrong: ' + (e.reason?.message || e.reason || 'unknown error'), 'error'));
  // Quietly check for a newer deployed version
  setTimeout(async () => { try { updateInfo = await checkForUpdate(); if (updateInfo.available) route(); } catch {} }, 4000);
}
boot();
