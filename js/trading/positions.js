// Open swing positions: mark-to-market, distance to stop/target, portfolio heat.
import * as store from '../store.js';
import { html, raw, money, pct, num, rmult, price, pnlClass, fmtDate, modal, toast, toNum, stat, today } from '../ui.js';
import * as C from '../charts.js';
import { computedTrades, openBook, startingCapital, EXIT_REASONS, assetLabel, tradeCcy } from './calc.js';
import { rate as fxRate } from '../fx.js';
import { sidePill, setupName, fmtDays } from './common.js';
import { cryptoPricesUSD, stockPricesUSD, normSymbol } from '../networth/prices.js';
import { refresh } from '../main.js';

// ---------- shared modals (also used from the trade page) ----------
export async function updatePositionModal(t) {
  const res = await modal({
    title: `Update ${t.symbol}`,
    body: String(html`<form class="form-grid" id="uf" style="grid-template-columns:1fr 1fr">
      <label class="field">Current price<input name="mark" type="number" step="any" value="${t.mark ?? ''}" placeholder="last price"></label>
      <label class="field">Current stop<input name="stop" type="number" step="any" value="${t.curStop ?? ''}"></label>
      <label class="field full">Note <span class="hint">added to the trade timeline</span><textarea name="note" rows="3" placeholder="Thesis intact? Anything changed?"></textarea></label></form>`),
    actions: [{ label: 'Cancel' }, { label: 'Save update', kind: 'primary', value: w => { const f = w.querySelector('#uf'); return { mark: toNum(f.mark.value), stop: toNum(f.stop.value), note: f.note.value.trim() }; } }],
  });
  if (!res || typeof res !== 'object') return false;
  const raw0 = store.get('trades', t.id);
  const patch = {};
  if (res.mark != null && res.mark !== t.mark) Object.assign(patch, { mark: res.mark, markAt: new Date().toISOString(), markSource: 'manual' });
  if (res.stop != null && res.stop !== t.curStop) patch.currentStop = res.stop;
  const updates = [...(raw0.updates || [])];
  if (res.note || patch.currentStop != null) updates.push({ date: today(), note: res.note, stop: patch.currentStop ?? null, mark: patch.mark ?? null });
  await store.put('trades', { ...raw0, ...patch, updates });
  toast('Position updated');
  return true;
}

// Exit dialog: partial take-profit, full close, or editing an existing exit leg.
// mode: 'partial' | 'close' | 'edit' (edit needs `leg` from computeTrade().legs)
export async function closePositionModal(t, { mode = 'close', leg = null } = {}) {
  const editing = mode === 'edit' && leg;
  const raw0 = store.get('trades', t.id);
  const exec = editing ? raw0.executions.find(e => e.id === leg.id) : null;
  // quantity available to this exit: what's open now (+ this leg's own qty when editing)
  const avail = +(t.openQty + (editing ? leg.qty : 0)).toFixed(8);
  const defQty = editing ? exec.qty : mode === 'partial' ? +(avail / 2).toFixed(avail % 2 && avail < 10 ? 4 : 0) || avail / 2 : avail;
  const unit = (t.mult || 1) * t.dir * (t.fxFactor || 1); // P&L shown in the display currency
  const title = editing ? `Edit exit — ${t.symbol}` : mode === 'partial' ? `Take partial profit — ${t.symbol}` : `Close ${t.symbol}`;
  const res = await modal({
    title,
    body: String(html`<form class="form-grid" id="cf" style="grid-template-columns:1fr 1fr">
      <label class="field">Exit date<input name="date" type="date" value="${editing ? (exec.datetime || '').slice(0, 10) : today()}" required></label>
      <label class="field">Exit price<input name="price" type="number" step="any" value="${editing ? exec.price : t.mark ?? ''}" required></label>
      <div class="field full">Size to exit <span class="hint">open: ${num(avail, avail % 1 ? 4 : 0)} of ${num(t.maxPos, t.maxPos % 1 ? 4 : 0)}</span>
        <div class="row" style="gap:6px">${[25, 33, 50, 75, 100].map(pc => html`<button type="button" class="btn sm" data-pc="${pc}">${pc === 100 ? 'All' : pc + '%'}</button>`)}
        <input name="qty" type="number" step="any" min="0" max="${avail}" value="${defQty}" style="flex:1;min-width:90px"></div></div>
      <label class="field">Fees<input name="fee" type="number" step="any" min="0" value="${editing ? exec.fee || '' : ''}"></label>
      <label class="field">Reason<select name="reason"><option value="">—</option>${['Partial take-profit', ...EXIT_REASONS].map(r => html`<option ${(editing ? exec.reason || '' : mode === 'partial' ? 'Partial take-profit' : '') === r ? raw('selected') : ''}>${r}</option>`)}</select></label>
      ${!editing && t.avgEntry != null ? html`<label class="check full"><input type="checkbox" name="be" ${mode === 'partial' ? raw('checked') : ''}> Move the stop on the rest to breakeven (${price(t.avgEntry)})</label>` : ''}
      <label class="field full">Note<textarea name="note" rows="2" placeholder="Why here? Did it play out as planned?"></textarea></label>
      <div class="calc-preview full" id="cfp"></div></form>`),
    onMount: w => {
      const f = w.querySelector('#cf');
      const pv = () => {
        const q = +f.qty.value || 0, px = +f.price.value;
        const pnl = f.price.value !== '' ? (px - (editing ? leg.costBasis : t.avgEntry)) * q * unit - (+f.fee.value || 0) : null;
        const left = Math.max(0, avail - q);
        w.querySelector('#cfp').innerHTML = String(html`<span>This exit <b class="${pnlClass(pnl)}">${pnl == null ? '—' : money(pnl, { sign: true })}</b></span>${t.risk && pnl != null ? html`<span>R <b class="${pnlClass(pnl)}">${rmult(pnl / t.risk)}</b></span>` : ''}<span>${q >= avail - 1e-9 ? html`<b>Position fully closed</b>` : html`Left open <b>${num(left, left % 1 ? 4 : 0)}</b> (${pct(t.maxPos ? left / t.maxPos : null, 0)})`}</span>`);
        const be = f.be; if (be && q >= avail - 1e-9) be.checked = false;
      };
      w.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => { const v = (avail * +b.dataset.pc) / 100; f.qty.value = +v.toFixed(avail % 1 || v % 1 ? 4 : 0); pv(); });
      f.addEventListener('input', pv); pv();
    },
    actions: [
      ...(editing ? [{ label: 'Delete exit', kind: 'danger', value: () => 'delete' }] : []),
      { label: 'Cancel' },
      { label: editing ? 'Save exit' : mode === 'partial' ? 'Save partial exit' : 'Close position', kind: 'primary', value: w => {
        const f = w.querySelector('#cf');
        if (!f.date.value || f.price.value === '' || !(+f.qty.value > 0)) { toast('Date, price and size are required', 'error'); return false; }
        if (+f.qty.value > avail + 1e-9) { toast(`Only ${avail} is open`, 'error'); return false; }
        if (f.date.value < (t.openDate || '').slice(0, 10)) { toast('The exit can\'t be before the entry', 'error'); return false; }
        return { date: f.date.value, price: +f.price.value, qty: +f.qty.value, fee: toNum(f.fee.value) || 0, reason: f.reason.value, note: f.note.value.trim(), be: !!f.be?.checked };
      } },
    ],
  });
  if (res === 'delete') {
    await store.put('trades', { ...raw0, executions: raw0.executions.filter(e => e.id !== leg.id), exitReason: '' });
    toast('Exit removed — that size is open again');
    return true;
  }
  if (!res || typeof res !== 'object') return false;
  const action = t.side === 'short' ? 'buy' : 'sell';
  const time = editing ? (exec.datetime || '').slice(10) || 'T16:00' : 'T16:00';
  const newExec = { id: editing ? leg.id : store.uid(), action, datetime: `${res.date}${time}`, qty: res.qty, price: res.price, fee: res.fee, reason: res.reason };
  const executions = editing ? raw0.executions.map(e => (e.id === leg.id ? { ...e, ...newExec } : e)) : [...(raw0.executions || []), newExec];
  const full = res.qty >= avail - 1e-9;
  const updates = [...(raw0.updates || [])];
  // the exit itself is already on the timeline (from the execution); only add the note / stop move
  if (res.note || res.be) updates.push({ date: res.date, note: res.note || 'Stop moved to breakeven', stop: res.be ? +t.avgEntry.toFixed(8) : null });
  const patch = { executions, updates };
  if (res.be) patch.currentStop = +t.avgEntry.toFixed(8);
  if (full && res.reason && res.reason !== 'Partial take-profit') patch.exitReason = res.reason;
  else if (full && !raw0.exitReason) patch.exitReason = res.reason === 'Partial take-profit' ? 'Target hit' : '';
  await store.put('trades', { ...raw0, ...patch });
  toast(editing ? 'Exit updated' : full ? 'Position closed' : 'Partial exit saved');
  return true;
}

// Fetch live marks for open positions (crypto via Binance/Coinbase, stocks via Finnhub)
export async function refreshMarks() {
  const open = computedTrades().filter(t => !t.closed && t.openQty > 0);
  const crypto = open.filter(t => t.assetClass === 'crypto'), stocks = open.filter(t => t.assetClass === 'stock');
  const base = s => normSymbol(s).replace(/[-/]?(USDT|USDC|USD|PERP)$/, '');
  const [c, k] = await Promise.all([cryptoPricesUSD(crypto.map(t => base(t.symbol))), stockPricesUSD(stocks.map(t => t.symbol), store.getSettings().priceApi?.finnhubKey)]);
  let n = 0;
  const now = new Date().toISOString();
  for (const t of open) {
    const p = t.assetClass === 'crypto' ? c.prices[base(t.symbol)] : t.assetClass === 'stock' ? k.prices[normSymbol(t.symbol)] : null;
    if (!p) continue;
    // quotes are in USD; the trade is recorded in its account's currency
    await store.put('trades', { ...store.get('trades', t.id), mark: +(p.usd * fxRate(tradeCcy(t))).toPrecision(10), markAt: now, markSource: p.source });
    n++;
  }
  const skipped = open.filter(t => !['crypto', 'stock'].includes(t.assetClass)).length;
  const failed = [...c.failed, ...k.failed];
  return { n, failed, errors: [...c.errors, ...k.errors], skipped };
}

// ---------- page ----------
export async function positions(el, _p, { mode }) {
  const pro = true;   // every view shows everything; Simple/Pro only changes what you fill in
  const trades = computedTrades();
  const capital = startingCapital(null) + trades.filter(t => t.closed).reduce((s, t) => s + t.net, 0);
  const book = openBook(trades, capital);
  const open = [...book.open].sort((a, b) => (b.exposure || 0) - (a.exposure || 0));
  const lastMark = open.map(t => t.markAt).filter(Boolean).sort().at(-1);
  const distPct = (from, to) => (from && to != null ? (to - from) / from : null);

  el.innerHTML = String(html`
    <div class="page-head"><div><h1>Open positions</h1><div class="sub">${open.length ? `${open.length} open · prices ${lastMark ? 'updated ' + new Date(lastMark).toLocaleString() : 'not fetched yet'}` : 'Your live swing book.'}</div></div>
      <div class="actions">${open.length ? html`<button class="btn" data-marks title="Crypto: Binance/Coinbase · Stocks: Finnhub (key in Settings)">↻ Refresh prices</button>` : ''}<a class="btn primary" href="#/trading/new">+ New trade</a></div></div>
    ${!open.length ? html`<div class="empty"><div class="empty-title">No open positions</div><p>Log a trade without an exit and it shows up here, with live P&L, distance to stop and portfolio heat.</p><a class="btn primary" href="#/trading/new">+ New trade</a></div>` : html`
    <div class="stats big">
      ${stat('Unrealised P&L', book.priced ? money(book.unreal, { sign: true }) : '—', { cls: pnlClass(book.unreal), sub: open.some(t => t.partial) ? html`${book.priced}/${open.length} priced · partials banked <span class="${pnlClass(open.reduce((a, t) => a + (t.partial ? t.realizedNet : 0), 0))}">${money(open.reduce((a, t) => a + (t.partial ? t.realizedNet : 0), 0), { sign: true })}</span>` : `${book.priced}/${open.length} positions priced` })}
      ${stat('Portfolio heat', money(book.heat), { sub: book.heatPct != null ? `${pct(book.heatPct, 1)} of trading capital at risk to stops` : 'loss if every stop is hit', help: 'Sum of what each position would give back if its current stop is hit. Many swing traders cap this at 5–8% of capital.' })}
      ${stat('Exposure', money(book.exposure), { sub: book.exposurePct != null ? `${pct(book.exposurePct, 0)} of trading capital` : '' })}
      ${stat('Trading capital', money(capital), { sub: 'start + deposits + closed P&L', help: 'From your trading accounts: starting balances, deposits/withdrawals and closed P&L.' })}
    </div>
    ${book.heatPct != null ? html`<div class="card mt"><div class="row"><b>Heat</b><span class="small muted">${pct(book.heatPct, 1)} of capital at risk</span><span class="spacer"></span><span class="small muted">guide: under 6%</span></div><div class="heat-bar"><span style="width:${Math.min(100, (book.heatPct / 0.1) * 100)}%;background:${book.heatPct > 0.08 ? 'var(--pnl-neg)' : book.heatPct > 0.06 ? 'var(--warn)' : 'var(--accent)'}"></span></div><div class="row small muted" style="justify-content:space-between"><span>0%</span><span>5%</span><span>10%</span></div></div>` : ''}
    <div class="table-wrap mt"><table class="data">
      <thead><tr><th>Symbol</th><th>Side</th>${pro ? raw('<th>Setup</th>') : ''}<th class="num">Days</th><th class="num">Size</th><th class="num">Entry</th><th class="num">Last</th><th class="num">Unrealised</th><th class="num">R now</th><th class="num">Stop</th><th class="num">Target</th>${pro ? raw('<th class="num">At risk</th>') : ''}<th></th></tr></thead>
      <tbody>${open.map(t => html`<tr>
        <td><a class="sym" href="#/trading/trade/${t.id}">${t.symbol}</a><div class="dist">${assetLabel(t.assetClass)}</div></td>
        <td>${sidePill(t.side)}</td>${pro ? html`<td class="small">${setupName(t.setupId)}</td>` : ''}
        <td class="num">${fmtDays(t.daysHeld)}${t.plannedDays ? html`<div class="dist">plan ${t.plannedDays}</div>` : ''}</td>
        <td class="num">${num(t.openQty, t.openQty % 1 ? 4 : 0)}${t.partial ? html`<div class="dist" title="Already closed ${pct(t.exitPct, 0)} — realised ${money(t.realizedNet, { sign: true })}">${pct(t.exitPct, 0)} taken · <span class="${pnlClass(t.realizedNet)}">${money(t.realizedNet, { sign: true, compact: true })}</span></div>` : ''}</td>
        <td class="num">${price(t.avgEntry)}</td>
        <td class="num">${price(t.mark)}${t.markAt ? html`<div class="dist">${t.markSource || ''}</div>` : ''}</td>
        <td class="num ${pnlClass(t.unreal)}">${t.unreal != null ? money(t.unreal, { sign: true }) : '—'}${t.unreal != null && t.notional ? html`<div class="dist">${pct(t.unreal / t.notional, 1, { sign: true })}</div>` : ''}</td>
        <td class="num ${pnlClass(t.unrealR)}">${rmult(t.unrealR)}</td>
        <td class="num">${price(t.curStop)}${t.curStop != null ? html`<div class="dist">${pct(distPct(t.mark ?? t.avgEntry, t.curStop), 1, { sign: true })}${t.lockedIn > 0 ? ' · locked' : ''}</div>` : ''}</td>
        <td class="num">${price(t.target)}${t.target != null ? html`<div class="dist">${pct(distPct(t.mark ?? t.avgEntry, t.target), 1, { sign: true })}</div>` : ''}</td>
        ${pro ? html`<td class="num">${money(t.openRisk)}</td>` : ''}
        <td><div class="row" style="gap:4px;justify-content:flex-end;flex-wrap:wrap;min-width:130px"><button class="btn sm" data-upd="${t.id}">Update</button><button class="btn sm" data-partial="${t.id}" title="Take partial profit">Partial</button><button class="btn sm" data-close="${t.id}">Close</button></div></td>
      </tr>`)}</tbody></table></div>
    <p class="small muted">* Prices for crypto and US stocks can be fetched automatically; others can be entered with <b>Update</b>. Unrealised P&L uses the last price; "R now" divides it by the initial risk.</p>
    ${pro ? html`<div class="grid g2 mt">
      <div class="card"><div class="card-head"><h2>Exposure by asset class</h2></div><div class="chart"><canvas id="p-exp"></canvas></div></div>
      <div class="card"><div class="card-head"><h2>Risk to stop by position</h2></div><div class="chart"><canvas id="p-risk"></canvas></div></div>
    </div>` : ''}`}`);

  el.querySelector('[data-marks]')?.addEventListener('click', async e => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Fetching…';
    try {
      const r = await refreshMarks();
      toast(`Updated ${r.n} price${r.n === 1 ? '' : 's'}${r.failed.length ? ` · not found: ${r.failed.join(', ')}` : ''}${r.skipped ? ` · ${r.skipped} need a manual price` : ''}${r.errors.length ? ' · ' + r.errors.join(' ') : ''}`, r.n ? 'info' : 'error');
      refresh();
    } catch (err) { toast('Price refresh failed: ' + err.message, 'error'); b.disabled = false; b.textContent = '↻ Refresh prices'; }
  });
  el.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (b?.dataset.upd) { if (await updatePositionModal(open.find(t => t.id === b.dataset.upd))) refresh(); }
    if (b?.dataset.close) { if (await closePositionModal(open.find(t => t.id === b.dataset.close))) refresh(); }
    if (b?.dataset.partial) { if (await closePositionModal(open.find(t => t.id === b.dataset.partial), { mode: 'partial' })) refresh(); }
  });
  if (pro && open.length) {
    const by = new Map();
    for (const t of open) by.set(assetLabel(t.assetClass), (by.get(assetLabel(t.assetClass)) || 0) + (t.exposure || 0));
    C.doughnut(el.querySelector('#p-exp'), { labels: [...by.keys()], values: [...by.values()], center: { value: money(book.exposure, { compact: true }), label: 'exposure' } });
    const rk = open.filter(t => t.openRisk != null).sort((a, b) => b.openRisk - a.openRisk);
    C.plainBars(el.querySelector('#p-risk'), { labels: rk.map(t => t.symbol), values: rk.map(t => t.openRisk), horizontal: true, fmt: v => money(v, { compact: true }), label: 'At risk' });
  }
}
