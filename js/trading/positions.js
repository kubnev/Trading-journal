// Open swing positions: mark-to-market, distance to stop/target, portfolio heat.
import * as store from '../store.js';
import { html, raw, money, pct, num, rmult, price, pnlClass, fmtDate, modal, toast, toNum, stat, today } from '../ui.js';
import * as C from '../charts.js';
import { computedTrades, openBook, startingCapital, EXIT_REASONS, assetLabel } from './calc.js';
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

export async function closePositionModal(t) {
  const res = await modal({
    title: `Close ${t.symbol}`,
    body: String(html`<form class="form-grid" id="cf" style="grid-template-columns:1fr 1fr">
      <label class="field">Exit date<input name="date" type="date" value="${today()}" required></label>
      <label class="field">Exit price<input name="price" type="number" step="any" value="${t.mark ?? ''}" required></label>
      <label class="field">Quantity <span class="hint">open: ${t.openQty}</span><input name="qty" type="number" step="any" min="0" max="${t.openQty}" value="${t.openQty}"></label>
      <label class="field">Fees<input name="fee" type="number" step="any" min="0" value=""></label>
      <label class="field full">Exit reason<select name="reason"><option value="">—</option>${EXIT_REASONS.map(r => html`<option>${r}</option>`)}</select></label>
      <label class="field full">Exit note<textarea name="note" rows="2" placeholder="Why now? Did it play out as planned?"></textarea></label></form>`),
    actions: [{ label: 'Cancel' }, { label: 'Close position', kind: 'primary', value: w => {
      const f = w.querySelector('#cf');
      if (!f.date.value || f.price.value === '' || !(+f.qty.value > 0)) { toast('Date, price and quantity are required', 'error'); return false; }
      if (+f.qty.value > t.openQty + 1e-9) { toast(`You only hold ${t.openQty}`, 'error'); return false; }
      return { date: f.date.value, price: +f.price.value, qty: +f.qty.value, fee: toNum(f.fee.value) || 0, reason: f.reason.value, note: f.note.value.trim() };
    } }],
  });
  if (!res || typeof res !== 'object') return false;
  const raw0 = store.get('trades', t.id);
  const action = t.side === 'short' ? 'buy' : 'sell';
  const executions = [...(raw0.executions || []), { id: store.uid(), action, datetime: `${res.date}T16:00`, qty: res.qty, price: res.price, fee: res.fee }];
  const updates = res.note ? [...(raw0.updates || []), { date: res.date, note: (res.qty < t.openQty ? 'Partial exit: ' : 'Exit: ') + res.note }] : raw0.updates;
  await store.put('trades', { ...raw0, executions, updates, exitReason: res.reason || raw0.exitReason || '' });
  toast(res.qty < t.openQty ? 'Partial exit saved' : 'Position closed');
  return true;
}

// Fetch live marks for open positions (crypto via Binance/Coinbase, stocks via Finnhub)
export async function refreshMarks() {
  const open = computedTrades().filter(t => !t.closed && t.openQty > 0);
  const crypto = open.filter(t => t.assetClass === 'crypto'), stocks = open.filter(t => t.assetClass === 'stock');
  const base = s => normSymbol(s).replace(/[-/]?(USDT|USDC|USD|PERP)$/, '');
  const [c, k] = await Promise.all([cryptoPricesUSD(crypto.map(t => base(t.symbol))), stockPricesUSD(stocks.map(t => t.symbol), store.getSettings().priceApi?.finnhubKey)]);
  // Trade prices are in the instrument's own (USD) terms, so no FX conversion here
  let n = 0;
  const now = new Date().toISOString();
  for (const t of open) {
    const p = t.assetClass === 'crypto' ? c.prices[base(t.symbol)] : t.assetClass === 'stock' ? k.prices[normSymbol(t.symbol)] : null;
    if (!p) continue;
    await store.put('trades', { ...store.get('trades', t.id), mark: p.usd, markAt: now, markSource: p.source });
    n++;
  }
  const skipped = open.filter(t => !['crypto', 'stock'].includes(t.assetClass)).length;
  const failed = [...c.failed, ...k.failed];
  return { n, failed, errors: [...c.errors, ...k.errors], skipped };
}

// ---------- page ----------
export async function positions(el, _p, { mode }) {
  const pro = mode === 'pro';
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
      ${stat('Unrealised P&L', book.priced ? money(book.unreal, { sign: true }) : '—', { cls: pnlClass(book.unreal), sub: `${book.priced}/${open.length} positions priced` })}
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
        <td class="num">${num(t.openQty, t.openQty % 1 ? 4 : 0)}</td>
        <td class="num">${price(t.avgEntry)}</td>
        <td class="num">${price(t.mark)}${t.markAt ? html`<div class="dist">${t.markSource || ''}</div>` : ''}</td>
        <td class="num ${pnlClass(t.unreal)}">${t.unreal != null ? money(t.unreal, { sign: true }) : '—'}${t.unreal != null && t.notional ? html`<div class="dist">${pct(t.unreal / t.notional, 1, { sign: true })}</div>` : ''}</td>
        <td class="num ${pnlClass(t.unrealR)}">${rmult(t.unrealR)}</td>
        <td class="num">${price(t.curStop)}${t.curStop != null ? html`<div class="dist">${pct(distPct(t.mark ?? t.avgEntry, t.curStop), 1, { sign: true })}${t.lockedIn > 0 ? ' · locked' : ''}</div>` : ''}</td>
        <td class="num">${price(t.target)}${t.target != null ? html`<div class="dist">${pct(distPct(t.mark ?? t.avgEntry, t.target), 1, { sign: true })}</div>` : ''}</td>
        ${pro ? html`<td class="num">${money(t.openRisk)}</td>` : ''}
        <td style="white-space:nowrap;text-align:right"><button class="btn sm" data-upd="${t.id}">Update</button> <button class="btn sm" data-close="${t.id}">Close</button></td>
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
  });
  if (pro && open.length) {
    const by = new Map();
    for (const t of open) by.set(assetLabel(t.assetClass), (by.get(assetLabel(t.assetClass)) || 0) + (t.exposure || 0));
    C.doughnut(el.querySelector('#p-exp'), { labels: [...by.keys()], values: [...by.values()], center: { value: money(book.exposure, { compact: true }), label: 'exposure' } });
    const rk = open.filter(t => t.openRisk != null).sort((a, b) => b.openRisk - a.openRisk);
    C.plainBars(el.querySelector('#p-risk'), { labels: rk.map(t => t.symbol), values: rk.map(t => t.openRisk), horizontal: true, fmt: v => money(v, { compact: true }), label: 'At risk' });
  }
}
