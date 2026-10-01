import * as store from './store.js';
import { html, raw, $, $$, esc } from './ui.js';
import { destroyAll } from './charts.js';
import { isAlex, navLabel, decoratePage, PORTAL_SVG } from './alex.js';

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
const resolvedTheme = () => { if (isAlex()) return 'dark'; const t = store.getSettings().theme; return t === 'auto' || !t ? (darkMQ.matches ? 'dark' : 'light') : t; };
function applyTheme() {
  const s = store.getSettings();
  const t = resolvedTheme();
  document.documentElement.dataset.theme = t;
  if (isAlex()) document.documentElement.dataset.alex = 'on'; else delete document.documentElement.dataset.alex;
  try { localStorage.setItem('tj.theme', isAlex() ? 'alex' : s.theme || 'auto'); } catch {}
  document.documentElement.dataset.pnl = s.pnlColors;
}

const THEME_LABEL = { auto: 'Auto', light: 'Light', dark: 'Dark' };
const THEME_ICON = {
  auto: 'M12 3a9 9 0 1 0 0 18V3zM12 3a9 9 0 0 1 0 18',
  light: 'M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5L19 5M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  dark: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
};

function renderShell(path) {
  const s = store.getSettings();
  const section = sectionOf(path);
  const modeKey = section === 'networth' ? 'networthMode' : 'tradingMode';
  const mode = section ? s[modeKey] : null;
  const items = section ? NAV[section].filter(i => !i.pro || mode === 'pro') : [];
  const active = i => (i.path === path || (i.path !== '/trading' && i.path !== '/networth' && path.startsWith(i.path)) || (i.path === '/trading/trades' && path.startsWith('/trading/trade'))) ? 'active' : '';
  $('#sidebar').innerHTML = String(html`
    <a class="brand" href="#/">${isAlex() ? raw(`<span class="portal-mark">${PORTAL_SVG}</span>`) : raw('<span class="brand-mark" aria-hidden="true"></span>')}<span>${isAlex() ? 'Portal Journal' : 'Journal'}</span></a>
    <div class="section-switch" role="tablist" aria-label="Section">
      <a role="tab" href="#/trading" class="${section === 'trading' ? 'on' : ''}" aria-selected="${section === 'trading'}">Trading</a>
      <a role="tab" href="#/networth" class="${section === 'networth' ? 'on' : ''}" aria-selected="${section === 'networth'}">Net worth</a>
    </div>
    ${section ? html`
      <div class="mode-switch" title="Simple shows the essentials. Pro unlocks every field, report and chart.">
        <button data-mode="simple" class="${mode === 'simple' ? 'on' : ''}">Simple</button>
        <button data-mode="pro" class="${mode === 'pro' ? 'on' : ''}">Pro</button>
      </div>
      <nav class="nav">${items.map(i => html`<a href="#${i.path}" class="${active(i)}">${icon(i.icon)}<span>${navLabel(i.path, i.label)}</span></a>`)}</nav>` : html`<nav class="nav"></nav>`}
    <div class="sidebar-foot">
      <a href="#/settings" class="${path === '/settings' ? 'active' : ''}">${icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z')}<span>${navLabel('/settings', 'Settings & data')}</span></a>
      <button class="theme-btn" data-theme-toggle aria-label="Theme: ${THEME_LABEL[s.theme] || 'Auto'}. Click to change." title="Cycles Auto → Light → Dark">${icon(THEME_ICON[s.theme] || THEME_ICON.auto)}<span>Theme: ${THEME_LABEL[s.theme] || 'Auto'}</span></button>
      ${isAlex() ? html`<div class="alex-badge">🧪 Alex mode</div>` : ''}<div class="local-badge" title="All data is stored in this browser only (IndexedDB). Nothing is uploaded.">● Stored locally in this browser</div>
    </div>`);
  $$('[data-mode]').forEach(b => b.onclick = async () => {
    await store.saveSettings({ [modeKey]: b.dataset.mode });
    // If a Pro-only page is open and we switch to Simple, fall back to the section home
    const item = NAV[section].find(i => i.path === currentPath());
    if (item?.pro && b.dataset.mode === 'simple') go(section === 'trading' ? '/trading' : '/networth'); else route();
  });
  $('[data-theme-toggle]').onclick = async () => { const order = ['auto', 'light', 'dark']; await store.saveSettings({ theme: order[(order.indexOf(s.theme) + 1) % 3] }); applyTheme(); route(); };
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
    cleanup = await view(page, params, { mode: sectionOf(path) === 'networth' ? store.getSettings().networthMode : store.getSettings().tradingMode });
    decoratePage(page);
    $('.topbar .brand').innerHTML = isAlex() ? `<span class="portal-mark">${PORTAL_SVG}</span><span>Portal Journal</span>` : '<span class="brand-mark" aria-hidden="true"></span><span>Journal</span>';
    main.scrollTop = 0;
    window.scrollTo(0, 0);
    const h = page.querySelector('h1');
    document.title = (h ? h.textContent + ' · ' : '') + (isAlex() ? 'Portal Journal' : 'Journal');
  } catch (e) {
    console.error(e);
    $('#main').innerHTML = `<div class="page"><h1>Something went wrong</h1><pre class="err">${esc(e.stack || e.message)}</pre></div>`;
  } finally { routing = false; }
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
}
boot();
