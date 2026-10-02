import { all, get, getSettings } from '../store.js';
import { html, raw, money, pnlClass, rmult, fmtDateTime, fmtDate, price, esc } from '../ui.js';
import { DEFAULT_FILTER, ASSET_CLASSES, computedTrades, filterTrades, startingCapital } from './calc.js';

// Filter state survives navigation within the session.
let filter = (() => { try { return { ...DEFAULT_FILTER, ...JSON.parse(sessionStorage.getItem('tj.filter') || '{}') }; } catch { return { ...DEFAULT_FILTER }; } })();
export const getFilter = () => filter;
export function setFilter(f) { filter = { ...filter, ...f }; try { sessionStorage.setItem('tj.filter', JSON.stringify(filter)); } catch {} }

export const setupName = id => (id ? get('setups', id)?.name || '—' : '—');
export const accountName = id => (id ? get('tAccounts', id)?.name || '—' : '—');

export function allTags() {
  const s = getSettings().tagLists;
  const used = new Set();
  for (const t of all('trades')) for (const x of [...(t.tags || []), ...(t.mistakes || []), ...(t.emotions || [])]) used.add(x);
  return [...new Set([...s.tags, ...s.mistakes, ...s.emotions, ...used])].sort((a, b) => a.localeCompare(b));
}

// Returns {trades, capital} for the current filter
export function filtered() {
  const trades = filterTrades(computedTrades(), filter);
  return { trades, capital: startingCapital(filter.account || null) };
}

const RANGES = [['all', 'All time'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['90d', 'Last 90 days'], ['mtd', 'Month to date'], ['ytd', 'Year to date'], ['1y', 'Last 12 months'], ['custom', 'Custom…']];

// Filter bar. `onChange` is called after the filter updates.
export function filterBar(host, onChange, { count, pro = true } = {}) {
  const f = filter;
  const accts = all('tAccounts'), setups = all('setups');
  host.innerHTML = String(html`<div class="filters" role="search">
    <select data-f="range" aria-label="Date range">${RANGES.map(([v, l]) => html`<option value="${v}" ${f.range === v ? raw('selected') : ''}>${l}</option>`)}</select>
    ${f.range === 'custom' ? html`<input type="date" data-f="from" value="${f.from}" aria-label="From"><input type="date" data-f="to" value="${f.to}" aria-label="To">` : ''}
    ${accts.length > 1 ? html`<select data-f="account" aria-label="Account"><option value="">All accounts</option>${accts.map(a => html`<option value="${a.id}" ${f.account === a.id ? raw('selected') : ''}>${a.name}</option>`)}</select>` : ''}
    ${setups.length ? html`<select data-f="setup" aria-label="Setup"><option value="">All setups</option><option value="_none" ${f.setup === '_none' ? raw('selected') : ''}>No setup</option>${setups.map(s => html`<option value="${s.id}" ${f.setup === s.id ? raw('selected') : ''}>${s.name}</option>`)}</select>` : ''}
    <select data-f="side" aria-label="Side"><option value="">Long & short</option><option value="long" ${f.side === 'long' ? raw('selected') : ''}>Long</option><option value="short" ${f.side === 'short' ? raw('selected') : ''}>Short</option></select>
    ${pro ? html`<select data-f="asset" aria-label="Asset class"><option value="">All assets</option>${ASSET_CLASSES.map(a => html`<option value="${a.id}" ${f.asset === a.id ? raw('selected') : ''}>${a.label}</option>`)}</select>
    <select data-f="tag" aria-label="Tag"><option value="">Any tag</option>${allTags().map(t => html`<option ${f.tag === t ? raw('selected') : ''}>${t}</option>`)}</select>` : ''}
    <input type="search" data-f="symbol" placeholder="Symbol" value="${f.symbol}" size="8" aria-label="Symbol">
    ${Object.entries(f).some(([k, v]) => v && DEFAULT_FILTER[k] !== v) ? html`<button class="btn ghost sm" data-reset>Reset</button>` : ''}
    ${count != null ? html`<span class="count">${count}</span>` : ''}
  </div>`);
  host.querySelectorAll('[data-f]').forEach(inp => {
    const ev = inp.type === 'search' ? 'input' : 'change';
    let t;
    inp.addEventListener(ev, () => {
      clearTimeout(t);
      t = setTimeout(() => {
        setFilter({ [inp.dataset.f]: inp.value });
        if (inp.dataset.f === 'range') filterBar(host, onChange, { count, pro });
        onChange();
      }, inp.type === 'search' ? 250 : 0);
    });
  });
  host.querySelector('[data-reset]')?.addEventListener('click', () => { setFilter({ ...DEFAULT_FILTER }); filterBar(host, onChange, { count, pro }); onChange(); });
}

export const sidePill = s => html`<span class="pill ${s}">${s === 'short' ? 'SHORT' : 'LONG'}</span>`;

export const tradeHead = pro => raw(`<tr><th>Date</th><th>Symbol</th><th>Side</th>${pro ? '<th>Setup</th>' : ''}<th class="num">Days</th><th class="num">Entry</th><th class="num">Exit</th><th class="num">Net P&L</th><th class="num">R</th>${pro ? '<th>Exit reason</th><th>Grade</th>' : ''}</tr>`);
export const fmtDays = d => (d == null ? '—' : d < 1 ? '<1' : String(Math.round(d)));

export function tradeRow(t, { pro }) {
  return html`<tr class="click" data-href="#/trading/trade/${t.id}">
    <td style="white-space:nowrap">${fmtDate(t.closeDate || t.openDate, { month: 'short', day: 'numeric', year: '2-digit' })}</td>
    <td><span class="sym">${t.symbol}</span></td>
    <td>${sidePill(t.side)}${t.closed ? '' : html` <span class="pill open">OPEN</span>`}</td>
    ${pro ? html`<td>${setupName(t.setupId)}</td>` : ''}
    <td class="num">${fmtDays(t.daysHeld)}</td>
    <td class="num">${price(t.avgEntry)}</td>
    <td class="num">${price(t.avgExit)}</td>
    <td class="num ${pnlClass(t.closed ? t.net : t.unreal)}">${t.closed ? money(t.net, { sign: true }) : t.unreal != null ? html`<span title="Unrealised">${money(t.unreal, { sign: true })}*</span>` : '—'}</td>
    <td class="num ${pnlClass(t.r ?? t.unrealR)}">${t.closed ? rmult(t.r) : t.unrealR != null ? rmult(t.unrealR) + '*' : '—'}</td>
    ${pro ? html`<td class="small">${t.exitReason || ''}</td><td>${t.grade ? html`<span class="grade">${t.grade}</span>` : ''}</td>` : ''}
  </tr>`;
}

export function wireRowLinks(root) {
  root.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-href]');
    if (tr && !e.target.closest('a,button,input')) location.hash = tr.dataset.href;
  });
}

export const needsAccount = () => !all('tAccounts').length;

export function emptyTrades() {
  return html`<div class="empty"><div class="empty-title">No trades yet</div><p>Log your first trade, import a CSV from your broker, or load demo data to explore.</p>
    <a class="btn primary" href="#/trading/new">+ New trade</a><a class="btn" href="#/settings">Import CSV</a><button class="btn" data-demo>Load demo data</button></div>`;
}
export { esc };
