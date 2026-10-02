// Swing-trade log, trade page (thesis, plan, executions, timeline, review) and the trade form.
import * as store from '../store.js';
import { html, raw, money, pct, num, rmult, price, pnlClass, fmtDate, formData, toNum, toast, confirmDlg, chipPicker, wireChipAdd, stat, today } from '../ui.js';
import { computeTrade, computeTradeDisplay, tradeCcy, ASSET_CLASSES, FUTURES, GRADES, assetLabel, TIMEFRAMES, REGIMES, EXIT_REASONS, CATALYSTS, startingCapital, computedTrades } from './calc.js';
import { filterBar, filtered, tradeRow, tradeHead, wireRowLinks, emptyTrades, setupName, accountName, sidePill, fmtDays } from './common.js';
import { updatePositionModal, closePositionModal } from './positions.js';
import { loadDemo } from '../demo.js';
import { go, refresh, query } from '../main.js';

// ================= trade log =================
const COLS = {
  date: t => t.closeDate || t.openDate || '', symbol: t => t.symbol || '', side: t => t.side, setup: t => setupName(t.setupId),
  days: t => t.daysHeld ?? 0, entry: t => t.avgEntry ?? 0, exit: t => t.avgExit ?? 0, net: t => (t.closed ? t.net : t.unreal ?? -Infinity), r: t => t.r ?? t.unrealR ?? -Infinity, reason: t => t.exitReason || '', grade: t => t.grade || 'Z',
};
let sort = { key: 'date', dir: -1 };
const PAGE = 50;

export async function tradeList(el, _p, { mode }) {
  const pro = mode === 'pro';
  let page = 0;
  el.innerHTML = String(html`
    <div class="page-head"><div><h1>Trade log</h1><div class="sub">Every trade, open and closed. Click a row for the full story.</div></div>
      <div class="actions"><a class="btn primary" href="#/trading/new">+ New trade</a></div></div>
    <div id="fb"></div><div id="body"></div>`);
  const body = el.querySelector('#body');
  const th = (k, l, n) => html`<th class="sortable ${n ? 'num' : ''}" data-sort="${k}">${l}${sort.key === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`;
  const draw = () => {
    const { trades } = filtered();
    if (!store.all('trades').length) { body.innerHTML = String(emptyTrades()); body.querySelector('[data-demo]').onclick = async () => { await loadDemo(); refresh(); }; return; }
    const f = COLS[sort.key];
    const rows = [...trades].sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    page = Math.min(page, pages - 1);
    const closed = trades.filter(t => t.closed);
    const net = closed.reduce((a, t) => a + t.net, 0);
    body.innerHTML = String(html`
      <div class="table-wrap"><table class="data">
        <thead><tr>${th('date', 'Date')}${th('symbol', 'Symbol')}${th('side', 'Side')}${pro ? th('setup', 'Setup') : ''}${th('days', 'Days', 1)}${th('entry', 'Entry', 1)}${th('exit', 'Exit', 1)}${th('net', 'Net P&L', 1)}${th('r', 'R', 1)}${pro ? html`${th('reason', 'Exit reason')}${th('grade', 'Grade')}` : ''}</tr></thead>
        <tbody>${rows.slice(page * PAGE, page * PAGE + PAGE).map(t => tradeRow(t, { pro }))}</tbody>
        <tfoot><tr><td colspan="${pro ? 7 : 6}">${rows.length} trades · ${closed.length} closed · win rate ${pct(closed.length ? closed.filter(t => t.outcome === 'win').length / closed.length : null, 0)}</td><td class="num ${pnlClass(net)}">${money(net, { sign: true })}</td><td colspan="${pro ? 3 : 1}"></td></tr></tfoot>
      </table></div>
      <p class="small muted">* open position — unrealised, from the last price.</p>
      ${pages > 1 ? html`<div class="row mt"><span class="spacer"></span><button class="btn sm" data-pg="-1" ${page === 0 ? raw('disabled') : ''}>← Prev</button><span class="muted small">Page ${page + 1} of ${pages}</span><button class="btn sm" data-pg="1" ${page >= pages - 1 ? raw('disabled') : ''}>Next →</button></div>` : ''}`);
    body.querySelectorAll('[data-sort]').forEach(h => h.onclick = () => { const k = h.dataset.sort; sort = { key: k, dir: sort.key === k ? -sort.dir : ['symbol', 'setup', 'reason'].includes(k) ? 1 : -1 }; draw(); });
    body.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { page += +b.dataset.pg; draw(); window.scrollTo(0, 0); });
  };
  wireRowLinks(body);
  filterBar(el.querySelector('#fb'), () => { page = 0; draw(); }, { pro });
  draw();
}

// ================= trade page =================
export async function tradeDetail(el, [id]) {
  const raw0 = store.get('trades', id);
  if (!raw0) { el.innerHTML = '<h1>Trade not found</h1><p><a href="#/trading/trades">Back to the trade log</a></p>'; return; }
  const t = computeTradeDisplay(raw0);
  const setup = t.setupId ? store.get('setups', t.setupId) : null;
  const ex = [...(t.executions || [])].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
  const openAct = t.side === 'short' ? 'sell' : 'buy';
  const dl = (k, v) => html`<dt>${k}</dt><dd>${v}</dd>`;
  const cap = startingCapital(t.accountId) || startingCapital(null);
  const timeline = [
    { date: t.openDate?.slice(0, 10), text: `Opened ${t.side} ${num(t.maxPos, t.maxPos % 1 ? 4 : 0)} @ ${price(t.avgEntry)}`, kind: 'open' },
    ...t.legs.map((l, i) => ({ date: l.datetime?.slice(0, 10), text: `${i === t.legs.length - 1 && t.closed ? 'Closed' : 'Partial exit'} ${num(l.qty, l.qty % 1 ? 4 : 0)} (${pct(l.pctOfPos, 0)}) @ ${price(l.price)} · ${money(l.pnl, { sign: true })}`, kind: 'exit' })),
    ...(t.updates || []).map(u => ({ date: u.date, text: [u.note, u.stop != null ? `stop → ${price(u.stop)}` : '', u.mark != null ? `price ${price(u.mark)}` : ''].filter(Boolean).join(' · '), kind: 'note' })),
  ].filter(x => x.date).sort((a, b) => a.date.localeCompare(b.date));

  el.innerHTML = String(html`
    <div class="page-head"><div>
        <div class="row"><h1>${t.symbol}</h1>${sidePill(t.side)}${t.closed ? '' : html`<span class="pill open">OPEN</span>`}${t.grade ? html`<span class="grade" title="Grade">${t.grade}</span>` : ''}</div>
        <div class="sub">${fmtDate(t.openDate)}${t.closeDate ? ` → ${fmtDate(t.closeDate)}` : ''} · ${fmtDays(t.daysHeld)} days · ${accountName(t.accountId)} · ${assetLabel(t.assetClass)}${setup ? ` · ${setup.name}` : ''}</div>
      </div>
      <div class="actions"><a class="btn" href="#/trading/trades">← Log</a><button class="btn danger" data-del>Delete</button>${!t.closed ? html`<button class="btn" data-upd>Update</button><button class="btn" data-partial>Take partial profit</button><button class="btn" data-close>Close ${t.partial ? 'rest' : 'position'}</button>` : ''}<a class="btn primary" href="#/trading/trade/${t.id}/edit">Edit</a></div></div>

    <div class="stats big">
      ${t.closed ? stat('Net P&L', money(t.net, { sign: true }), { cls: pnlClass(t.net), sub: `gross ${money(t.gross, { sign: true })} · costs ${money(t.fees)}` })
                 : stat('Unrealised P&L', t.unreal != null ? money(t.unreal, { sign: true }) : '—', { cls: pnlClass(t.unreal), sub: t.partial ? html`realised so far <span class="${pnlClass(t.realizedNet)}">${money(t.realizedNet, { sign: true })}</span> (${pct(t.exitPct, 0)} closed)` : t.mark != null ? `last ${price(t.mark)}` : 'add a price with Update' })}
      ${stat(t.closed ? 'R-multiple' : 'R now', rmult(t.closed ? t.r : t.unrealR), { cls: pnlClass(t.closed ? t.r : t.unrealR), sub: t.risk ? `risked ${money(t.risk)}${cap > 0 ? ` (${pct(t.risk / cap, 2)} of capital)` : ''}` : 'set a stop to get R' })}
      ${stat('Return', pct(t.closed ? t.retPct : t.unreal != null && t.notional ? t.unreal / t.notional : null, 2), { cls: pnlClass(t.closed ? t.retPct : t.unreal), sub: `on ${money(t.notional)} position` })}
      ${stat('Held', `${fmtDays(t.daysHeld)} ${t.daysHeld != null && t.daysHeld < 2 ? 'day' : 'days'}`, { sub: t.plannedDays ? `planned ${t.plannedDays}` : '' })}
    </div>

    <div class="grid g2 mt">
      <div class="card"><div class="card-head"><h2>Thesis</h2></div>
        <div class="md">${t.thesis || t.notes || raw('<span class="muted">No thesis written.</span>')}</div>
        <dl class="kv cols2 mt">
          ${dl('Catalyst', t.catalyst || '—')}${dl('Timeframe', t.timeframe || '—')}
          ${dl('Market regime', t.regime || '—')}${dl('Sector / theme', t.sector || '—')}
          ${dl('Conviction', t.conviction ? '●'.repeat(t.conviction) + '○'.repeat(5 - t.conviction) : '—')}${dl('Planned hold', t.plannedDays ? `${t.plannedDays} days` : '—')}
        </dl>
      </div>
      <div class="card"><div class="card-head"><h2>Risk & execution</h2></div>
        <dl class="kv cols2">
          ${dl('Avg entry', price(t.avgEntry))}${dl('Avg exit', price(t.avgExit))}
          ${dl('Size', num(t.maxPos, t.maxPos % 1 ? 4 : 0))}${dl('Multiplier', t.mult)}
          ${dl('Initial stop', price(t.stop))}${dl('Current stop', price(t.curStop))}
          ${dl('Target', price(t.target))}${dl('Planned R:R', t.plannedR != null ? num(t.plannedR, 2) + 'R' : '—')}
          ${dl('Worst price (MAE)', t.mae != null ? html`${price(t.mae)} <span class="muted">${rmult(t.maeR)}</span>` : '—')}${dl('Best price (MFE)', t.mfe != null ? html`${price(t.mfe)} <span class="muted">${rmult(t.mfeR)}</span>` : '—')}
          ${dl('Fees', money(t.fees - (t.funding || 0)))}${dl('Funding / borrow', money(t.funding || 0))}
          ${dl('Exit reason', t.exitReason || '—')}${dl('Followed plan', t.followedPlan === true ? 'Yes' : t.followedPlan === false ? 'No' : '—')}
        </dl>
      </div>
    </div>

    <div class="grid g2 mt">
      <div class="card"><div class="card-head"><h2>Timeline</h2>${!t.closed ? html`<button class="btn sm" data-upd>+ Add update</button>` : ''}</div>
        <div class="timeline">${timeline.map(x => html`<div class="t"><span class="muted small">${fmtDate(x.date, { month: 'short', day: 'numeric' })}</span> — ${x.text}</div>`)}</div></div>
      <div class="card"><div class="card-head"><h2>Entries & exits</h2>${!t.closed ? html`<div class="row"><button class="btn sm" data-partial>Take partial profit</button><button class="btn sm" data-close>Close rest</button></div>` : ''}</div>
        <div class="table-wrap" style="border:0"><table class="data compact"><thead><tr><th>Date</th><th></th><th class="num">Size</th><th class="num">% of pos.</th><th class="num">Price</th><th class="num">P&L</th><th class="num">R</th><th></th></tr></thead>
        <tbody>${ex.filter(e => e.action === openAct).map(e => html`<tr><td style="white-space:nowrap">${fmtDate(e.datetime, { month: 'short', day: 'numeric' })}</td><td><span class="pill long">ENTRY</span></td><td class="num">${num(+e.qty, +e.qty % 1 ? 4 : 0)}</td><td class="num">${pct(t.maxPos ? e.qty / t.maxPos : null, 0)}</td><td class="num">${price(e.price)}</td><td></td><td></td><td></td></tr>`)}
          ${t.legs.map((l, i) => html`<tr><td style="white-space:nowrap">${fmtDate(l.datetime, { month: 'short', day: 'numeric' })}</td><td style="white-space:nowrap" title="${l.reason || ''}"><span class="pill short">${i === t.legs.length - 1 && t.closed ? 'EXIT' : `TP ${i + 1}`}</span></td><td class="num">${num(l.qty, l.qty % 1 ? 4 : 0)}</td><td class="num">${pct(l.pctOfPos, 0)}</td><td class="num">${price(l.price)}</td><td class="num ${pnlClass(l.pnl)}">${money(l.pnl, { sign: true })}</td><td class="num ${pnlClass(l.r)}">${rmult(l.r)}</td><td style="text-align:right"><button class="btn sm ghost" data-leg="${l.id}">Edit</button></td></tr>`)}
          ${!t.closed ? html`<tr><td colspan="2"><span class="pill open">OPEN</span></td><td class="num"><b>${num(t.openQty, t.openQty % 1 ? 4 : 0)}</b></td><td class="num">${pct(t.maxPos ? t.openQty / t.maxPos : null, 0)}</td><td class="num">${price(t.mark)}</td><td class="num ${pnlClass(t.unreal)}">${t.unreal != null ? money(t.unreal, { sign: true }) : '—'}</td><td class="num ${pnlClass(t.unrealR)}">${rmult(t.unrealR)}</td><td></td></tr>` : ''}
        </tbody>
        ${t.legs.length ? html`<tfoot><tr><td colspan="5">Realised${t.closed ? '' : ' so far'}</td><td class="num ${pnlClass(t.realizedNet)}">${money(t.realizedNet, { sign: true })}</td><td class="num">${t.risk ? rmult(t.realizedNet / t.risk) : ''}</td><td></td></tr></tfoot>` : ''}</table></div>
        ${t.legs.some(l => l.ignored > 0) ? html`<p class="small neg mt">An exit is dated before the entry, so part of it is ignored — edit its date.</p>` : ''}
      </div>
    </div>

    ${(t.tags || []).length + (t.mistakes || []).length + (t.emotions || []).length ? html`<div class="card mt"><div class="grid g3">
      <div><h3>Tags</h3>${(t.tags || []).map(x => html`<span class="tag accent">${x}</span>`)}${!(t.tags || []).length ? html`<span class="muted small">—</span>` : ''}</div>
      <div><h3>Mistakes</h3>${(t.mistakes || []).map(x => html`<span class="tag bad">${x}</span>`)}${!(t.mistakes || []).length ? html`<span class="muted small">None</span>` : ''}</div>
      <div><h3>Emotions</h3>${(t.emotions || []).map(x => html`<span class="tag">${x}</span>`)}${!(t.emotions || []).length ? html`<span class="muted small">—</span>` : ''}</div>
    </div></div>` : ''}
    ${setup && (setup.rules || []).length ? html`<div class="card mt"><div class="card-head"><h2>${setup.name} checklist</h2><span class="hint">${setup.rules.filter((_, i) => t.checklist?.[i]).length}/${setup.rules.length} met</span></div>
      <div class="checklist">${setup.rules.map((r, i) => html`<div class="check">${t.checklist?.[i] ? raw('<span class="pos">✔</span>') : raw('<span class="neg">✘</span>')} ${r}</div>`)}</div></div>` : ''}
    <div class="grid g2 mt">
      <div class="card"><h3>Review</h3><div class="md">${t.review || (t.thesis ? t.notes : '') || raw('<span class="muted">—</span>')}</div></div>
      <div class="card"><h3>Lessons</h3><div class="md">${t.lessons || raw('<span class="muted">—</span>')}</div></div>
    </div>
    ${(t.images || []).length ? html`<div class="card mt"><h3>Charts</h3><div class="shots" id="shots"></div></div>` : ''}`);

  if ((t.images || []).length) renderShots(el.querySelector('#shots'), t.images, false);
  el.querySelectorAll('[data-upd]').forEach(b => b.onclick = async () => { if (await updatePositionModal(t)) refresh(); });
  el.querySelectorAll('[data-close]').forEach(b => b.onclick = async () => { if (await closePositionModal(t)) refresh(); });
  el.querySelectorAll('[data-partial]').forEach(b => b.onclick = async () => { if (await closePositionModal(t, { mode: 'partial' })) refresh(); });
  el.querySelectorAll('[data-leg]').forEach(b => b.onclick = async () => { if (await closePositionModal(t, { mode: 'edit', leg: t.legs.find(l => l.id === b.dataset.leg) })) refresh(); });
  el.querySelector('[data-del]').onclick = async () => {
    if (!(await confirmDlg('Delete trade?', `Delete the ${t.symbol} trade from ${fmtDate(t.openDate)}? This cannot be undone.`))) return;
    for (const im of t.images || []) await store.delImage(im);
    await store.del('trades', t.id); toast('Trade deleted'); go('/trading/trades');
  };
}

async function renderShots(host, ids, editable, onRemove) {
  host.innerHTML = '';
  for (const id of ids) {
    const blob = await store.getImage(id);
    if (!blob) continue;
    const url = URL.createObjectURL(blob);
    const d = document.createElement('div');
    d.className = 'shot';
    d.innerHTML = `<img src="${url}" alt="Trade chart">${editable ? '<button type="button" aria-label="Remove screenshot">✕</button>' : ''}`;
    d.querySelector('img').onclick = () => { const lb = document.createElement('div'); lb.className = 'lightbox'; lb.innerHTML = `<img src="${url}" alt="">`; lb.onclick = () => lb.remove(); document.body.append(lb); };
    if (editable) d.querySelector('button').onclick = () => { d.remove(); onRemove(id); };
    host.append(d);
  }
}

// ================= form =================
function guessMultiplier(asset, symbol) {
  if (asset === 'option') return 100;
  if (asset === 'future') { const root = (symbol || '').toUpperCase().replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '').replace(/[^A-Z0-9]/g, ''); return FUTURES[root] || 1; }
  return 1;
}
const d10 = s => (s || '').slice(0, 10);
const asDT = d => (d ? `${d}T${d.length > 10 ? d.slice(11, 16) : '12:00'}`.slice(0, 16) : '');
const opts = (list, cur) => html`<option value="">—</option>${[...new Set([...list, ...(cur && !list.includes(cur) ? [cur] : [])])].map(o => html`<option ${o === cur ? raw('selected') : ''}>${o}</option>`)}`;

export async function tradeEdit(el, [id], { mode }) {
  const pro = mode === 'pro';
  const s = store.getSettings();
  const existing = id ? store.get('trades', id) : null;
  if (id && !existing) { el.innerHTML = '<h1>Trade not found</h1>'; return; }
  const accts = store.all('tAccounts');
  const setups = store.all('setups').filter(x => x.active !== false || x.id === existing?.setupId);
  const q = query();
  const lastAcct = (() => { try { return localStorage.getItem('tj.lastAccount'); } catch { return null; } })();
  const t = existing ? structuredClone(existing) : {
    accountId: accts.find(a => a.id === lastAcct)?.id || accts[0]?.id || '', symbol: '', assetClass: 'stock', side: 'long', multiplier: 1,
    executions: [], stop: '', target: '', tags: [], mistakes: [], emotions: [], images: [], setupId: q.get('setup') || '', thesis: '', notes: '', lessons: '',
  };
  const baseDay = q.get('day') || today();
  const openAct = () => (form.side.value === 'short' ? 'sell' : 'buy');
  let rows = (t.executions || []).map(e => ({ ...e, date: d10(e.datetime) }));
  const entryRows = () => rows.filter(r => r.action === openAct());
  // The one-line form can only represent "one entry, one exit of the same size".
  // Anything else (scale-ins, partial take-profits, an open remainder) uses the rows table — in both modes.
  const oa0 = t.side === 'short' ? 'sell' : 'buy';
  const ins = rows.filter(r => r.action === oa0), outs = rows.filter(r => r.action !== oa0);
  let multi = ins.length > 1 || outs.length > 1 || (outs.length === 1 && Math.abs((+outs[0].qty || 0) - (+ins[0]?.qty || 0)) > 1e-9);
  let images = [...(t.images || [])];
  const newImages = [];
  const ent = rows.find(e => e.action === (t.side === 'short' ? 'sell' : 'buy')) || {};
  const ext = rows.find(e => e !== ent) || {};
  const sectors = [...new Set(store.all('trades').map(x => x.sector).filter(Boolean))];
  const capital = startingCapital(null) + computedTrades().filter(x => x.closed).reduce((a, x) => a + x.net, 0);

  el.innerHTML = String(html`
    <div class="page-head"><div><h1>${existing ? `Edit ${t.symbol}` : 'New swing trade'}</h1><div class="sub">${pro ? 'Pro form — everything you might want to review later. Leave blank what you don\'t track.' : 'Simple form — the essentials. Switch to Pro for catalyst, regime, scale-ins/outs, MAE/MFE and review fields.'}</div></div></div>
    <form id="tf" class="stack" autocomplete="off">
      <fieldset><legend>Instrument</legend><div class="form-grid">
        <label class="field">Account <span class="hint" id="acc-ccy"></span><select name="accountId">${accts.map(a => html`<option value="${a.id}" ${a.id === t.accountId ? raw('selected') : ''}>${a.name}</option>`)}${!accts.length ? html`<option value="">Main account (will be created)</option>` : ''}</select></label>
        <label class="field">Symbol<input name="symbol" required value="${t.symbol}" placeholder="AAPL, BTC, ETHUSDT…" style="text-transform:uppercase"></label>
        <label class="field">Asset class<select name="assetClass">${ASSET_CLASSES.map(a => html`<option value="${a.id}" ${a.id === t.assetClass ? raw('selected') : ''}>${a.label}</option>`)}</select></label>
        <label class="field">Direction<div class="seg" role="radiogroup"><button type="button" data-side="long" class="${t.side !== 'short' ? 'on' : ''}">Long</button><button type="button" data-side="short" class="${t.side === 'short' ? 'on' : ''}">Short</button></div><input type="hidden" name="side" value="${t.side || 'long'}"></label>
        <label class="field" id="multf">Multiplier <span class="hint">per 1.0 price move</span><input name="multiplier" type="number" step="any" min="0" value="${t.multiplier || 1}"></label>
        <label class="field">Setup<select name="setupId"><option value="">—</option>${setups.map(x => html`<option value="${x.id}" ${x.id === t.setupId ? raw('selected') : ''}>${x.name}</option>`)}</select></label>
      </div></fieldset>

      <fieldset><legend>Thesis</legend><div class="form-grid">
        <label class="field full">Why this trade? <span class="hint">setup + catalyst + what would prove you wrong</span><textarea name="thesis" rows="3">${t.thesis || ''}</textarea></label>
        ${pro ? html`<label class="field">Catalyst<select name="catalyst">${opts(CATALYSTS, t.catalyst)}</select></label>
        <label class="field">Timeframe<select name="timeframe">${opts(TIMEFRAMES, t.timeframe)}</select></label>
        <label class="field">Market regime<select name="regime">${opts(REGIMES, t.regime)}</select></label>
        <label class="field">Sector / theme<input name="sector" value="${t.sector || ''}" list="sectors" placeholder="Semis, L1s, Energy…"><datalist id="sectors">${sectors.map(x => html`<option>${x}</option>`)}</datalist></label>
        <label class="field">Conviction (1–5)<select name="conviction"><option value="">—</option>${[1, 2, 3, 4, 5].map(n => html`<option ${+t.conviction === n ? raw('selected') : ''}>${n}</option>`)}</select></label>
        <label class="field">Planned hold (days)<input name="plannedDays" type="number" min="0" step="1" value="${t.plannedDays ?? ''}"></label>` : ''}
      </div></fieldset>

      <fieldset><legend>Entry & exit</legend>
        <div id="ex-simple" ${multi ? raw('hidden') : ''}><div class="form-grid">
          <label class="field">Entry date<input name="entryDate" type="date" value="${ent.date || baseDay}"></label>
          <label class="field">Entry price<input name="entryPrice" type="number" step="any" value="${ent.price ?? ''}"></label>
          <label class="field">Quantity<input name="qty" type="number" step="any" min="0" value="${ent.qty ?? ''}"></label>
          <label class="field">Exit date <span class="hint">blank = still open</span><input name="exitDate" type="date" value="${ext.date || ''}"></label>
          <label class="field">Exit price<input name="exitPrice" type="number" step="any" value="${ext.price ?? ''}"></label>
          <label class="field">Fees (total)<input name="fees" type="number" step="any" min="0" value="${(+ent.fee || 0) + (+ext.fee || 0) || ''}"></label>
        </div><button type="button" class="btn ghost sm mt" data-multi>Partial take-profit or scaled in? Use separate entries & exits →</button></div>
        <div id="ex-multi" ${multi ? '' : raw('hidden')}>
          <div class="table-wrap"><table class="data exec-table"><thead><tr><th>Type</th><th>Date</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Fee</th><th></th></tr></thead><tbody></tbody></table></div>
          <div class="row mt"><button type="button" class="btn sm" data-add="entry">+ Entry (scale in)</button><button type="button" class="btn sm" data-add="exit">+ Exit / partial take-profit</button><span class="small muted" id="rows-sum"></span></div>
        </div>
        <div class="form-grid mt">
          <label class="field">Exit reason<select name="exitReason">${opts(EXIT_REASONS, t.exitReason)}</select></label>
          ${pro ? html`<label class="field">Funding / borrow costs <span class="hint">+ paid, − received</span><input name="funding" type="number" step="any" value="${t.funding ?? ''}"></label>` : ''}
        </div>
      </fieldset>

      <fieldset><legend>Risk plan</legend><div class="form-grid">
        <label class="field">Initial stop<input name="stop" type="number" step="any" value="${t.stop ?? ''}"></label>
        <label class="field">Target<input name="target" type="number" step="any" value="${t.target ?? ''}"></label>
        <label class="field">Current stop <span class="hint">trailed stop, if moved</span><input name="currentStop" type="number" step="any" value="${t.currentStop ?? ''}"></label>
        ${pro ? html`<label class="field">Risk override <span class="hint">if no fixed stop</span><input name="riskOverride" type="number" step="any" min="0" value="${t.riskOverride ?? ''}"></label>
        <label class="field">Worst price while held <span class="hint">MAE</span><input name="mae" type="number" step="any" value="${t.mae ?? ''}"></label>
        <label class="field">Best price while held <span class="hint">MFE</span><input name="mfe" type="number" step="any" value="${t.mfe ?? ''}"></label>` : ''}
      </div><div class="calc-preview mt" id="preview"></div></fieldset>

      ${pro ? html`<fieldset><legend>Review</legend><div class="form-grid">
        <label class="field">Grade <span class="hint">process, not outcome</span><select name="grade">${opts(GRADES, t.grade)}</select></label>
        <label class="field">Followed plan?<select name="followedPlan"><option value="">—</option><option value="yes" ${t.followedPlan === true ? raw('selected') : ''}>Yes</option><option value="no" ${t.followedPlan === false ? raw('selected') : ''}>No</option></select></label>
      </div><div id="checklist" class="mt"></div>
      <div class="stack mt">
        <div><h3>Mistakes</h3>${chipPicker('mistakes', s.tagLists.mistakes, t.mistakes || [])}</div>
        <div><h3>Emotions</h3>${chipPicker('emotions', s.tagLists.emotions, t.emotions || [])}</div>
        <div><h3>Tags</h3>${chipPicker('tags', s.tagLists.tags, t.tags || [])}</div>
      </div>
      <div class="form-grid mt"><label class="field span2">Review — what happened vs the plan?<textarea name="review" rows="4">${t.review || ''}</textarea></label>
        <label class="field span2">Lessons<textarea name="lessons" rows="4">${t.lessons || ''}</textarea></label></div>
      <h3 class="mt">Charts</h3><div class="shots" id="shots"></div><div class="dropzone mt" id="drop" tabindex="0">Drop chart screenshots here, click to choose, or paste with <kbd>Ctrl/⌘ V</kbd><input type="file" accept="image/*" multiple hidden></div>
      </fieldset>` : html`<fieldset><legend>Notes</legend><label class="field">Review / lessons<textarea name="review" rows="3">${t.review || ''}</textarea></label></fieldset>`}

      <div class="form-actions"><a class="btn" href="${existing ? `#/trading/trade/${t.id}` : '#/trading/trades'}">Cancel</a>${!existing ? html`<button type="submit" class="btn" data-again>Save & add another</button>` : ''}<button type="submit" class="btn primary">Save trade</button></div>
    </form>`);

  const form = el.querySelector('#tf');
  const accCcy = () => { const h = el.querySelector('#acc-ccy'); if (h) h.textContent = `prices & P&L in ${tradeCcy({ accountId: form.accountId.value })}`; };
  form.accountId.addEventListener('change', () => { accCcy(); update(); });
  setTimeout(accCcy);
  const tbody = el.querySelector('.exec-table tbody');
  wireChipAdd(form);
  form.querySelectorAll('[data-side]').forEach(b => b.onclick = () => {
    const before = openAct();
    form.side.value = b.dataset.side;
    form.querySelectorAll('[data-side]').forEach(x => x.classList.toggle('on', x === b));
    if (before !== openAct()) rows = rows.map(r => ({ ...r, action: r.action === 'buy' ? 'sell' : 'buy' })); // keep entries as entries
    drawRows(); update();
  });
  const multVis = () => { el.querySelector('#multf').hidden = !pro && !['option', 'future'].includes(form.assetClass.value) && +form.multiplier.value === 1; };
  form.assetClass.onchange = () => { form.multiplier.value = guessMultiplier(form.assetClass.value, form.symbol.value); multVis(); update(); };
  form.symbol.addEventListener('change', () => { if (form.assetClass.value === 'future') { form.multiplier.value = guessMultiplier('future', form.symbol.value); update(); } });
  multVis();

  // multi-row executions
  const rowHtml = r => html`<tr data-id="${r.id}"><td><span class="pill ${r.action === openAct() ? 'long' : 'short'}">${r.action === openAct() ? 'ENTRY' : 'EXIT'}</span></td>
    <td><input type="date" data-k="date" value="${r.date || ''}"></td><td><input type="number" step="any" min="0" data-k="qty" value="${r.qty ?? ''}"></td>
    <td><input type="number" step="any" data-k="price" value="${r.price ?? ''}"></td><td><input type="number" step="any" min="0" data-k="fee" value="${r.fee ?? ''}"></td>
    <td><button type="button" class="icon-btn" data-rm aria-label="Remove">✕</button></td></tr>`;
  const drawRows = () => { if (tbody) tbody.innerHTML = String(html`${[...rows].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(rowHtml)}`); rowsSum(); };
  const rowsSum = () => {
    const el2 = el.querySelector('#rows-sum'); if (!el2) return;
    const i = rows.filter(r => r.action === openAct()).reduce((a, r) => a + (+r.qty || 0), 0), o = rows.filter(r => r.action !== openAct()).reduce((a, r) => a + (+r.qty || 0), 0);
    el2.innerHTML = String(html`Bought/sold <b>${num(i, i % 1 ? 4 : 0)}</b> · exited <b>${num(o, o % 1 ? 4 : 0)}</b> (${pct(i ? o / i : null, 0)}) · ${o >= i - 1e-9 && i ? 'closed' : html`<b>${num(i - o, (i - o) % 1 ? 4 : 0)}</b> still open`}`);
  };
  tbody?.addEventListener('input', e => { const r = rows.find(y => y.id === e.target.closest('tr').dataset.id); r[e.target.dataset.k] = e.target.value; update(); rowsSum(); });
  tbody?.addEventListener('click', e => { if (e.target.closest('[data-rm]')) { rows = rows.filter(x => x.id !== e.target.closest('tr').dataset.id); drawRows(); update(); } });
  el.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
    const isEntry = b.dataset.add === 'entry';
    rows.push({ id: store.uid(), action: isEntry ? openAct() : openAct() === 'buy' ? 'sell' : 'buy', date: rows.at(-1)?.date || baseDay, qty: isEntry ? '' : Math.max(0, entryRows().reduce((s, r) => s + (+r.qty || 0), 0) - rows.filter(r => r.action !== openAct()).reduce((s, r) => s + (+r.qty || 0), 0)) || '', price: '', fee: '' });
    drawRows(); update();
  });
  el.querySelector('[data-multi]')?.addEventListener('click', () => {
    rows = simpleRows().map(r => ({ ...r, date: d10(r.datetime) }));
    if (!rows.length) rows = [{ id: store.uid(), action: openAct(), date: form.entryDate.value || baseDay, qty: '', price: '', fee: '' }];
    multi = true; el.querySelector('#ex-simple').hidden = true; el.querySelector('#ex-multi').hidden = false;
    drawRows(); update();
  });
  if (multi) drawRows();

  function simpleRows() {
    const f = form, out = [];
    const qv = toNum(f.qty.value), fees = toNum(f.fees.value) || 0, hasExit = f.exitPrice.value !== '';
    if (f.entryPrice.value !== '' && qv) out.push({ id: ent.id || store.uid(), action: openAct(), datetime: asDT(f.entryDate.value || baseDay), qty: qv, price: +f.entryPrice.value, fee: hasExit ? fees / 2 : fees });
    if (hasExit && qv) out.push({ id: ext.id || store.uid(), action: openAct() === 'buy' ? 'sell' : 'buy', datetime: asDT(f.exitDate.value || f.entryDate.value || baseDay), qty: qv, price: +f.exitPrice.value, fee: fees / 2 });
    return out;
  }
  const currentExecs = () => (multi ? rows.map(r => ({ id: r.id, action: r.action, datetime: r.datetime && d10(r.datetime) === r.date ? r.datetime : asDT(r.date), qty: toNum(r.qty), price: toNum(r.price), fee: toNum(r.fee) || 0, ...(r.reason ? { reason: r.reason } : {}) })).filter(e => e.qty && e.price != null) : simpleRows());

  const drawChecklist = () => {
    const host = el.querySelector('#checklist');
    if (!host) return;
    const st = store.get('setups', form.setupId?.value);
    host.innerHTML = st && (st.rules || []).length ? String(html`<h3>${st.name} checklist</h3><div class="checklist">${st.rules.map((r, i) => html`<label class="check"><input type="checkbox" name="chk${i}" ${t.checklist?.[i] ? raw('checked') : ''}> ${r}</label>`)}</div>`) : '';
  };
  form.setupId?.addEventListener('change', drawChecklist);
  drawChecklist();

  function draft() {
    const f = formData(form);
    const pick = (k, conv = v => v) => (k in f ? conv(f[k]) : t[k] ?? null);
    return {
      ...t, accountId: f.accountId, symbol: (f.symbol || '').trim().toUpperCase(), assetClass: f.assetClass, side: f.side, multiplier: toNum(f.multiplier) || 1,
      setupId: f.setupId || '', executions: currentExecs(), thesis: f.thesis, exitReason: f.exitReason || '',
      stop: toNum(f.stop), target: toNum(f.target), currentStop: toNum(f.currentStop),
      catalyst: pick('catalyst'), timeframe: pick('timeframe'), regime: pick('regime'), sector: pick('sector'), conviction: pick('conviction', toNum), plannedDays: pick('plannedDays', toNum),
      funding: pick('funding', toNum), riskOverride: pick('riskOverride', toNum), mae: pick('mae', toNum), mfe: pick('mfe', toNum), review: f.review, lessons: pick('lessons'),
      ...(pro ? {
        grade: f.grade, followedPlan: f.followedPlan === 'yes' ? true : f.followedPlan === 'no' ? false : null,
        mistakes: f.mistakes || [], emotions: f.emotions || [], tags: f.tags || [],
        checklist: Object.fromEntries(Object.keys(f).filter(k => /^chk\d+$/.test(k)).map(k => [k.slice(3), f[k]])),
      } : {}),
      images,
    };
  }
  function update() {
    const c = computeTradeDisplay(draft());
    el.querySelector('#preview').innerHTML = String(html`
      <span>${c.closed ? 'Net P&L' : 'Status'} <b class="${pnlClass(c.net)}">${c.closed ? money(c.net, { sign: true }) : c.entryQty ? 'open' : '—'}</b></span>
      <span>Risk <b>${money(c.risk)}</b>${c.risk && capital > 0 ? html` <span class="muted">(${pct(c.risk / capital, 2)} of capital)</span>` : ''}</span>
      <span>R <b class="${pnlClass(c.r)}">${rmult(c.r)}</b></span>
      ${c.plannedR != null ? html`<span>Planned R:R <b>${num(c.plannedR, 2)}</b></span>` : ''}
      <span>Avg entry <b>${price(c.avgEntry)}</b></span>
      ${c.avgExit != null ? html`<span>Avg exit <b>${price(c.avgExit)}</b></span>` : ''}
      ${c.openQty > 0 && c.exitQty > 0 ? html`<span>Still open <b>${c.openQty}</b></span>` : ''}
      ${c.notional ? html`<span>Position <b>${money(c.notional)}</b>${capital > 0 ? html` <span class="muted">(${pct(c.notional / capital, 0)})</span>` : ''}</span>` : ''}
      ${c.daysHeld != null && c.entryQty ? html`<span>${c.closed ? 'Held' : 'Open for'} <b>${fmtDays(c.daysHeld)} days</b></span>` : ''}`);
  }
  form.addEventListener('input', e => { if (!e.target.closest('.exec-table')) update(); });
  update();

  let cleanupPaste = null;
  if (pro) {
    const shots = el.querySelector('#shots');
    const redraw = () => renderShots(shots, images, true, rid => { images = images.filter(x => x !== rid); });
    redraw();
    const drop = el.querySelector('#drop'), fin = drop.querySelector('input');
    const add = async files => { for (const f of files) if (f.type.startsWith('image/')) { const nid = await store.putImage(f); images.push(nid); newImages.push(nid); } redraw(); };
    drop.onclick = () => fin.click();
    drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fin.click(); } };
    fin.onchange = () => add([...fin.files]);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); add([...e.dataTransfer.files]); };
    const onPaste = e => { const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/')); if (files.length) { e.preventDefault(); add(files); } };
    document.addEventListener('paste', onPaste);
    cleanupPaste = () => document.removeEventListener('paste', onPaste);
  }

  let again = false;
  form.querySelector('[data-again]')?.addEventListener('click', () => { again = true; });
  form.onsubmit = async e => {
    e.preventDefault();
    const d = draft();
    if (!d.symbol) { toast('Symbol is required', 'error'); again = false; return; }
    if (!d.executions.length) { toast('Enter at least an entry price and quantity', 'error'); again = false; return; }
    const c = computeTrade(d);
    const exitsGiven = d.executions.filter(x => x.action !== (d.side === 'short' ? 'sell' : 'buy')).reduce((a, x) => a + (+x.qty || 0), 0);
    if (exitsGiven > c.entryQty + 1e-9) { toast('Exits are larger than entries', 'error'); again = false; return; }
    if (exitsGiven > c.exitQty + 1e-9) { toast('An exit is dated before the entry — check the dates', 'error'); again = false; return; }
    if (!d.accountId) d.accountId = (await store.put('tAccounts', { name: 'Main account', broker: '', type: 'margin', startingBalance: 0 })).id;
    try { localStorage.setItem('tj.lastAccount', d.accountId); } catch {}
    for (const old of existing?.images || []) if (!images.includes(old)) await store.delImage(old);
    newImages.length = 0;
    const saved = await store.put('trades', d);
    toast(existing ? 'Trade updated' : 'Trade saved');
    if (again) { again = false; go('/trading/new?r=' + Date.now()); }
    else go(`/trading/trade/${saved.id}`);
  };

  return () => { cleanupPaste?.(); for (const nid of newImages) store.delImage(nid); };
}
