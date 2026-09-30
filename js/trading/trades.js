import * as store from '../store.js';
import { html, raw, esc, money, pct, num, rmult, price, pnlClass, fmtDateTime, fmtDate, duration, localDT, formData, toNum, toast, confirmDlg, chipPicker, wireChipAdd, stat } from '../ui.js';
import { computeTrade, ASSET_CLASSES, FUTURES, GRADES, assetLabel } from './calc.js';
import { filterBar, filtered, tradeRow, wireRowLinks, emptyTrades, setupName, accountName, sidePill } from './common.js';
import { loadDemo } from '../demo.js';
import { go, refresh, query } from '../main.js';

// ================= list =================
const COLS = {
  date: t => t.closeDate || t.openDate || '', symbol: t => t.symbol || '', side: t => t.side, setup: t => setupName(t.setupId),
  qty: t => t.maxPos || 0, entry: t => t.avgEntry ?? 0, exit: t => t.avgExit ?? 0, net: t => (t.closed ? t.net : -Infinity), r: t => t.r ?? -Infinity, grade: t => t.grade || 'Z',
};
let sort = { key: 'date', dir: -1 };
const PAGE = 50;

export async function tradeList(el, _p, { mode }) {
  const pro = mode === 'pro';
  let page = 0;
  el.innerHTML = String(html`
    <div class="page-head"><div><h1>Trades</h1><div class="sub">Every trade, filterable and sortable. Click a row for details.</div></div>
      <div class="actions"><a class="btn primary" href="#/trading/new">+ New trade</a></div></div>
    <div id="fb"></div><div id="body"></div>`);
  const body = el.querySelector('#body');
  const th = (k, l, num) => html`<th class="sortable ${num ? 'num' : ''}" data-sort="${k}">${l}${sort.key === k ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`;

  const draw = () => {
    const { trades } = filtered();
    if (!store.all('trades').length) { body.innerHTML = String(emptyTrades()); body.querySelector('[data-demo]').onclick = async () => { await loadDemo(); refresh(); }; return; }
    const f = COLS[sort.key];
    const rows = [...trades].sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    page = Math.min(page, pages - 1);
    const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
    const closed = trades.filter(t => t.closed);
    const net = closed.reduce((a, t) => a + t.net, 0);
    body.innerHTML = String(html`
      <div class="table-wrap"><table class="data">
        <thead><tr>${th('date', 'Date')}${th('symbol', 'Symbol')}${th('side', 'Side')}${pro ? th('setup', 'Setup') : ''}${th('qty', 'Qty', 1)}${th('entry', 'Entry', 1)}${th('exit', 'Exit', 1)}${th('net', 'Net P&L', 1)}${th('r', 'R', 1)}${pro ? html`${th('grade', 'Grade')}<th>Mistakes</th>` : ''}</tr></thead>
        <tbody>${shown.map(t => tradeRow(t, { pro }))}</tbody>
        <tfoot><tr><td colspan="${pro ? 7 : 6}">${rows.length} trades · ${closed.length} closed · win rate ${pct(closed.length ? closed.filter(t => t.outcome === 'win').length / closed.length : null, 0)}</td><td class="num ${pnlClass(net)}">${money(net, { sign: true })}</td><td colspan="${pro ? 3 : 1}"></td></tr></tfoot>
      </table></div>
      ${pages > 1 ? html`<div class="row mt"><span class="spacer"></span><button class="btn sm" data-pg="-1" ${page === 0 ? raw('disabled') : ''}>← Prev</button><span class="muted small">Page ${page + 1} of ${pages}</span><button class="btn sm" data-pg="1" ${page >= pages - 1 ? raw('disabled') : ''}>Next →</button></div>` : ''}`);
    body.querySelectorAll('[data-sort]').forEach(h => h.onclick = () => { const k = h.dataset.sort; sort = { key: k, dir: sort.key === k ? -sort.dir : k === 'symbol' || k === 'setup' ? 1 : -1 }; draw(); });
    body.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { page += +b.dataset.pg; draw(); el.closest('#main').scrollTop = 0; });
  };
  wireRowLinks(body);
  filterBar(el.querySelector('#fb'), () => { page = 0; draw(); }, { pro });
  draw();
}

// ================= detail =================
export async function tradeDetail(el, [id], { mode }) {
  const raw0 = store.get('trades', id);
  if (!raw0) { el.innerHTML = '<h1>Trade not found</h1><p><a href="#/trading/trades">Back to trades</a></p>'; return; }
  const t = computeTrade(raw0);
  const setup = t.setupId ? store.get('setups', t.setupId) : null;
  const ex = [...(t.executions || [])].sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
  const dl = (k, v) => html`<dt>${k}</dt><dd>${v}</dd>`;
  const planYes = t.followedPlan === true ? 'Yes' : t.followedPlan === false ? 'No' : '—';

  el.innerHTML = String(html`
    <div class="page-head"><div>
        <div class="row"><h1>${t.symbol}</h1>${sidePill(t.side)}${t.closed ? '' : html`<span class="pill open">OPEN</span>`}${t.grade ? html`<span class="grade" title="Grade">${t.grade}</span>` : ''}</div>
        <div class="sub">${fmtDateTime(t.openDate)}${t.closeDate ? ` → ${fmtDateTime(t.closeDate)}` : ''} · ${accountName(t.accountId)} · ${assetLabel(t.assetClass)}${setup ? ` · ${setup.name}` : ''}</div>
      </div>
      <div class="actions"><a class="btn" href="#/trading/trades">← Trades</a><button class="btn danger" data-del>Delete</button><button class="btn" data-dup>Duplicate</button><a class="btn primary" href="#/trading/trade/${t.id}/edit">Edit</a></div></div>

    <div class="stats big">
      ${stat('Net P&L', t.closed ? money(t.net, { sign: true }) : 'Open', { cls: pnlClass(t.net), sub: `gross ${money(t.gross, { sign: true })} · fees ${money(t.fees)}` })}
      ${stat('R-multiple', rmult(t.r), { cls: pnlClass(t.r), sub: t.risk ? `risked ${money(t.risk)}` : 'set a stop to get R' })}
      ${stat('Return', pct(t.retPct, 2), { cls: pnlClass(t.retPct), sub: `on ${money(t.notional)} notional` })}
      ${stat('Hold time', duration(t.holdMs), { sub: `${t.maxPos} × ${price(t.avgEntry)} → ${price(t.avgExit)}` })}
    </div>

    <div class="grid g2 mt">
      <div class="card"><div class="card-head"><h2>Trade</h2></div>
        <dl class="kv cols2">
          ${dl('Avg entry', price(t.avgEntry))}${dl('Avg exit', price(t.avgExit))}
          ${dl('Size (max)', num(t.maxPos, t.maxPos % 1 ? 4 : 0))}${dl('Multiplier', t.mult)}
          ${dl('Stop', price(t.stop))}${dl('Target', price(t.target))}
          ${dl('Planned R:R', t.plannedR != null ? num(t.plannedR, 2) + 'R' : '—')}${dl('Risk', money(t.risk))}
          ${dl('MAE', t.mae != null ? html`${price(t.mae)} <span class="muted">(${rmult(t.maeR)})</span>` : '—')}${dl('MFE', t.mfe != null ? html`${price(t.mfe)} <span class="muted">(${rmult(t.mfeR)})</span>` : '—')}
          ${dl('Exit efficiency', pct(t.capture, 0))}${dl('Timeframe', t.timeframe || '—')}
          ${dl('Followed plan', planYes)}${dl('Confidence', t.confidence ? '★'.repeat(t.confidence) + '☆'.repeat(5 - t.confidence) : '—')}
        </dl>
      </div>
      <div class="card"><div class="card-head"><h2>Executions</h2><span class="hint">${ex.length}</span></div>
        <table class="data compact"><thead><tr><th>Time</th><th>Action</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Fee</th></tr></thead>
        <tbody>${ex.map(e => html`<tr><td>${fmtDateTime(e.datetime)}</td><td>${e.action.toUpperCase()}</td><td class="num">${e.qty}</td><td class="num">${price(e.price)}</td><td class="num">${money(+e.fee || 0)}</td></tr>`)}</tbody></table>
      </div>
    </div>
    ${(t.tags || []).length + (t.mistakes || []).length + (t.emotions || []).length ? html`<div class="card mt"><div class="grid g3">
      <div><h3>Tags</h3>${(t.tags || []).map(x => html`<span class="tag accent">${x}</span>`)}${!(t.tags || []).length ? html`<span class="muted small">—</span>` : ''}</div>
      <div><h3>Mistakes</h3>${(t.mistakes || []).map(x => html`<span class="tag bad">${x}</span>`)}${!(t.mistakes || []).length ? html`<span class="muted small">None 👍</span>` : ''}</div>
      <div><h3>Emotions</h3>${(t.emotions || []).map(x => html`<span class="tag">${x}</span>`)}${!(t.emotions || []).length ? html`<span class="muted small">—</span>` : ''}</div>
    </div></div>` : ''}
    ${setup && (setup.rules || []).length ? html`<div class="card mt"><div class="card-head"><h2>${setup.name} checklist</h2><span class="hint">${(setup.rules || []).filter((_, i) => t.checklist?.[i]).length}/${setup.rules.length} met</span></div>
      <div class="checklist">${setup.rules.map((r, i) => html`<div class="check">${t.checklist?.[i] ? raw('<span class="pos">✔</span>') : raw('<span class="neg">✘</span>')} ${r}</div>`)}</div></div>` : ''}
    <div class="grid g2 mt">
      <div class="card"><h3>Notes</h3><div class="md">${t.notes || raw('<span class="muted">—</span>')}</div></div>
      <div class="card"><h3>Lessons</h3><div class="md">${t.lessons || raw('<span class="muted">—</span>')}</div></div>
    </div>
    ${(t.images || []).length ? html`<div class="card mt"><h3>Screenshots</h3><div class="shots" id="shots"></div></div>` : ''}`);

  if ((t.images || []).length) renderShots(el.querySelector('#shots'), t.images, false);
  el.querySelector('[data-del]').onclick = async () => {
    if (!(await confirmDlg('Delete trade?', `Delete ${t.symbol} trade from ${fmtDate(t.openDate)}? This cannot be undone.`))) return;
    for (const im of t.images || []) await store.delImage(im);
    await store.del('trades', t.id); toast('Trade deleted'); go('/trading/trades');
  };
  el.querySelector('[data-dup]').onclick = async () => {
    const copy = structuredClone(raw0);
    delete copy.id; delete copy.createdAt; copy.images = [];
    copy.executions = copy.executions.map(e => ({ ...e, id: store.uid() }));
    const n = await store.put('trades', copy);
    go(`/trading/trade/${n.id}/edit`);
  };
}

// Screenshot thumbnails. editable → shows remove buttons and returns the live id list.
async function renderShots(host, ids, editable, onRemove) {
  host.innerHTML = '';
  for (const id of ids) {
    const blob = await store.getImage(id);
    if (!blob) continue;
    const url = URL.createObjectURL(blob);
    const d = document.createElement('div');
    d.className = 'shot';
    d.innerHTML = `<img src="${url}" alt="Trade screenshot">${editable ? '<button type="button" aria-label="Remove screenshot">✕</button>' : ''}`;
    d.querySelector('img').onclick = () => { const lb = document.createElement('div'); lb.className = 'lightbox'; lb.innerHTML = `<img src="${url}" alt="">`; lb.onclick = () => lb.remove(); document.body.append(lb); };
    if (editable) d.querySelector('button').onclick = () => { d.remove(); onRemove(id); };
    host.append(d);
  }
}

// ================= edit / new =================
function guessMultiplier(asset, symbol) {
  if (asset === 'option') return 100;
  if (asset === 'future') { const root = (symbol || '').toUpperCase().replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '').replace(/[^A-Z0-9]/g, ''); return FUTURES[root] || 1; }
  return 1;
}

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
    executions: [], stop: '', target: '', tags: [], mistakes: [], emotions: [], images: [], setupId: q.get('setup') || '', notes: '', lessons: '',
  };
  const now = new Date();
  const dayQ = q.get('day');
  const baseDT = dayQ ? `${dayQ}T09:30` : localDT(now);
  let execs = t.executions.length ? t.executions.map(e => ({ ...e })) : [];
  const openAct = () => (form.side.value === 'short' ? 'sell' : 'buy');
  // Simple layout only works for one entry + one exit
  let useExecTable = execs.length > 2 || (execs.length === 2 && execs[0].action === execs[1].action);
  let images = [...(t.images || [])];
  const newImages = [];

  const ent = execs.find(e => e.action === (t.side === 'short' ? 'sell' : 'buy')) || {};
  const ext = execs.find(e => e !== ent) || {};

  el.innerHTML = String(html`
    <div class="page-head"><div><h1>${existing ? `Edit ${t.symbol}` : 'New trade'}</h1><div class="sub">${pro ? 'Pro form — all fields. Leave anything blank you don\'t track.' : 'Simple form — switch to Pro for executions, MAE/MFE, psychology & screenshots.'}</div></div></div>
    <form id="tf" class="stack" autocomplete="off">
      <fieldset><legend>Instrument</legend><div class="form-grid">
        <label class="field">Account
          <select name="accountId">${accts.map(a => html`<option value="${a.id}" ${a.id === t.accountId ? raw('selected') : ''}>${a.name}</option>`)}${!accts.length ? html`<option value="">Main account (will be created)</option>` : ''}</select></label>
        <label class="field">Symbol<input name="symbol" required value="${t.symbol}" placeholder="AAPL, ESZ5, EURUSD…" style="text-transform:uppercase"></label>
        <label class="field">Asset class<select name="assetClass">${ASSET_CLASSES.map(a => html`<option value="${a.id}" ${a.id === t.assetClass ? raw('selected') : ''}>${a.label}</option>`)}</select></label>
        <label class="field">Side<div class="seg" role="radiogroup"><button type="button" data-side="long" class="${t.side !== 'short' ? 'on' : ''}">Long</button><button type="button" data-side="short" class="${t.side === 'short' ? 'on' : ''}">Short</button></div><input type="hidden" name="side" value="${t.side || 'long'}"></label>
        <label class="field" id="multf">Multiplier <span class="hint">$ per 1.0 price move per unit</span><input name="multiplier" type="number" step="any" min="0" value="${t.multiplier || 1}"></label>
        ${setups.length || pro ? html`<label class="field">Setup / strategy<select name="setupId"><option value="">—</option>${setups.map(x => html`<option value="${x.id}" ${x.id === t.setupId ? raw('selected') : ''}>${x.name}</option>`)}</select></label>` : ''}
      </div></fieldset>

      <fieldset><legend>Execution</legend>
        <div id="exec-simple" ${useExecTable ? raw('hidden') : ''}><div class="form-grid">
          <label class="field">Entry date & time<input name="entryDT" type="datetime-local" value="${ent.datetime || baseDT}"></label>
          <label class="field">Entry price<input name="entryPrice" type="number" step="any" value="${ent.price ?? ''}"></label>
          <label class="field">Quantity<input name="qty" type="number" step="any" min="0" value="${ent.qty ?? ''}"></label>
          <label class="field">Exit date & time <span class="hint">blank = still open</span><input name="exitDT" type="datetime-local" value="${ext.datetime || ''}"></label>
          <label class="field">Exit price<input name="exitPrice" type="number" step="any" value="${ext.price ?? ''}"></label>
          <label class="field">Total fees & commissions<input name="fees" type="number" step="any" min="0" value="${(+ent.fee || 0) + (+ext.fee || 0) || ''}"></label>
        </div>
        ${pro ? html`<button type="button" class="btn ghost sm mt" data-to-table>Scale in / out — use multiple executions →</button>` : ''}</div>
        <div id="exec-table" ${useExecTable ? '' : raw('hidden')}>
          <div class="table-wrap"><table class="data exec-table"><thead><tr><th>Action</th><th>Date & time</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Fee</th><th></th></tr></thead><tbody></tbody></table></div>
          <div class="row mt"><button type="button" class="btn sm" data-add-exec>+ Add execution</button><span class="muted small">Opening side: <b id="open-side"></b>. Position closes when exits equal entries.</span></div>
        </div>
      </fieldset>

      <fieldset><legend>Risk plan</legend><div class="form-grid">
        <label class="field">Initial stop loss<input name="stop" type="number" step="any" value="${t.stop ?? ''}"></label>
        ${pro ? html`<label class="field">Profit target<input name="target" type="number" step="any" value="${t.target ?? ''}"></label>
        <label class="field">Risk override ($) <span class="hint">if no fixed stop</span><input name="riskOverride" type="number" step="any" min="0" value="${t.riskOverride ?? ''}"></label>
        <label class="field">MAE price <span class="hint">worst price during trade</span><input name="mae" type="number" step="any" value="${t.mae ?? ''}"></label>
        <label class="field">MFE price <span class="hint">best price during trade</span><input name="mfe" type="number" step="any" value="${t.mfe ?? ''}"></label>
        <label class="field">Timeframe<input name="timeframe" value="${t.timeframe || ''}" placeholder="1m, 5m, daily…" list="tfs"></label>` : ''}
      </div>
      <datalist id="tfs"><option>1m</option><option>2m</option><option>5m</option><option>15m</option><option>1h</option><option>4h</option><option>Daily</option><option>Weekly</option></datalist>
      <div class="calc-preview mt" id="preview"></div></fieldset>

      ${pro ? html`<fieldset><legend>Review & psychology</legend><div class="form-grid">
        <label class="field">Grade <span class="hint">process quality, not outcome</span><select name="grade"><option value="">—</option>${GRADES.map(g => html`<option ${t.grade === g ? raw('selected') : ''}>${g}</option>`)}</select></label>
        <label class="field">Confidence (1–5)<select name="confidence"><option value="">—</option>${[1, 2, 3, 4, 5].map(n => html`<option ${+t.confidence === n ? raw('selected') : ''}>${n}</option>`)}</select></label>
        <label class="field">Followed plan?<select name="followedPlan"><option value="">—</option><option value="yes" ${t.followedPlan === true ? raw('selected') : ''}>Yes</option><option value="no" ${t.followedPlan === false ? raw('selected') : ''}>No</option></select></label>
      </div>
      <div id="checklist" class="mt"></div>
      <div class="stack mt">
        <div><h3>Mistakes</h3>${chipPicker('mistakes', s.tagLists.mistakes, t.mistakes || [])}</div>
        <div><h3>Emotions</h3>${chipPicker('emotions', s.tagLists.emotions, t.emotions || [])}</div>
        <div><h3>Tags / conditions</h3>${chipPicker('tags', s.tagLists.tags, t.tags || [])}</div>
      </div></fieldset>` : ''}

      <fieldset><legend>Notes</legend><div class="form-grid">
        <label class="field ${pro ? 'span2' : 'full'}">Notes — thesis, context, what happened<textarea name="notes" rows="5">${t.notes || ''}</textarea></label>
        ${pro ? html`<label class="field span2">Lessons — what to repeat or change<textarea name="lessons" rows="5">${t.lessons || ''}</textarea></label>` : ''}
      </div>
      ${pro ? html`<h3 class="mt">Screenshots</h3><div class="shots" id="shots"></div><div class="dropzone mt" id="drop" tabindex="0">Drop chart screenshots here, click to choose, or paste with <kbd>Ctrl/⌘ V</kbd><input type="file" accept="image/*" multiple hidden></div>` : ''}
      </fieldset>

      <div class="form-actions">${existing ? html`<a class="btn" href="#/trading/trade/${t.id}">Cancel</a>` : html`<a class="btn" href="#/trading/trades">Cancel</a>`}
        ${!existing ? html`<button type="submit" class="btn" data-again>Save & add another</button>` : ''}<button type="submit" class="btn primary">Save trade</button></div>
    </form>`);

  const form = el.querySelector('#tf');
  const tbody = el.querySelector('.exec-table tbody');
  wireChipAdd(form);

  // ---- side toggle ----
  form.querySelectorAll('[data-side]').forEach(b => b.onclick = () => {
    form.side.value = b.dataset.side;
    form.querySelectorAll('[data-side]').forEach(x => x.classList.toggle('on', x === b));
    el.querySelector('#open-side').textContent = openAct().toUpperCase();
    update();
  });
  el.querySelector('#open-side').textContent = openAct().toUpperCase();

  // ---- multiplier visibility ----
  const multVis = () => { const a = form.assetClass.value; el.querySelector('#multf').hidden = !pro && !['option', 'future'].includes(a) && +form.multiplier.value === 1; };
  form.assetClass.onchange = () => { form.multiplier.value = guessMultiplier(form.assetClass.value, form.symbol.value); multVis(); update(); };
  form.symbol.addEventListener('change', () => { if (form.assetClass.value === 'future') { form.multiplier.value = guessMultiplier('future', form.symbol.value); update(); } });
  multVis();

  // ---- executions table ----
  const execRow = e => html`<tr data-id="${e.id}">
    <td><select data-k="action"><option value="buy" ${e.action === 'buy' ? raw('selected') : ''}>BUY</option><option value="sell" ${e.action === 'sell' ? raw('selected') : ''}>SELL</option></select></td>
    <td><input type="datetime-local" data-k="datetime" value="${e.datetime || ''}"></td>
    <td><input type="number" step="any" min="0" data-k="qty" value="${e.qty ?? ''}"></td>
    <td><input type="number" step="any" data-k="price" value="${e.price ?? ''}"></td>
    <td><input type="number" step="any" min="0" data-k="fee" value="${e.fee ?? ''}"></td>
    <td><button type="button" class="icon-btn" data-rm aria-label="Remove execution">✕</button></td></tr>`;
  const drawExecs = () => { tbody.innerHTML = String(html`${execs.map(execRow)}`); };
  tbody.addEventListener('input', e => { const tr = e.target.closest('tr'); const x = execs.find(y => y.id === tr.dataset.id); x[e.target.dataset.k] = e.target.value; update(); });
  tbody.addEventListener('change', e => { const tr = e.target.closest('tr'); const x = execs.find(y => y.id === tr.dataset.id); x[e.target.dataset.k] = e.target.value; update(); });
  tbody.addEventListener('click', e => { if (e.target.closest('[data-rm]')) { const idr = e.target.closest('tr').dataset.id; execs = execs.filter(x => x.id !== idr); drawExecs(); update(); } });
  el.querySelector('[data-add-exec]').onclick = () => {
    const last = execs.at(-1);
    execs.push({ id: store.uid(), action: last ? (last.action === openAct() ? (execs.length === 1 ? (openAct() === 'buy' ? 'sell' : 'buy') : last.action) : last.action) : openAct(), datetime: last?.datetime || baseDT, qty: '', price: '', fee: '' });
    drawExecs(); update();
  };
  el.querySelector('[data-to-table]')?.addEventListener('click', () => {
    execs = simpleToExecs();
    if (!execs.length) execs = [{ id: store.uid(), action: openAct(), datetime: form.entryDT.value || baseDT, qty: '', price: '', fee: '' }];
    useExecTable = true;
    el.querySelector('#exec-simple').hidden = true; el.querySelector('#exec-table').hidden = false;
    drawExecs(); update();
  });
  if (useExecTable) drawExecs();

  function simpleToExecs() {
    const f = form, out = [];
    const q = toNum(f.qty.value), fees = toNum(f.fees.value) || 0;
    const hasExit = f.exitPrice.value !== '';
    if (f.entryPrice.value !== '' && q) out.push({ id: ent.id || store.uid(), action: openAct(), datetime: f.entryDT.value, qty: q, price: +f.entryPrice.value, fee: hasExit ? fees / 2 : fees });
    if (hasExit && q) out.push({ id: ext.id || store.uid(), action: openAct() === 'buy' ? 'sell' : 'buy', datetime: f.exitDT.value || f.entryDT.value, qty: q, price: +f.exitPrice.value, fee: fees / 2 });
    return out;
  }
  const currentExecs = () => (useExecTable ? execs.map(e => ({ ...e, qty: toNum(e.qty), price: toNum(e.price), fee: toNum(e.fee) || 0 })).filter(e => e.qty && e.price != null) : simpleToExecs());

  // ---- setup checklist ----
  const drawChecklist = () => {
    const host = el.querySelector('#checklist');
    if (!host) return;
    const st = store.get('setups', form.setupId?.value);
    host.innerHTML = st && (st.rules || []).length ? String(html`<h3>${st.name} checklist</h3><div class="checklist">${st.rules.map((r, i) => html`<label class="check"><input type="checkbox" name="chk${i}" ${t.checklist?.[i] ? raw('checked') : ''}> ${r}</label>`)}</div>`) : '';
  };
  form.setupId?.addEventListener('change', drawChecklist);
  drawChecklist();

  // ---- live preview ----
  function draft() {
    const f = formData(form);
    return {
      ...t, accountId: f.accountId, symbol: (f.symbol || '').trim().toUpperCase(), assetClass: f.assetClass, side: f.side, multiplier: toNum(f.multiplier) || 1,
      setupId: f.setupId || '', executions: currentExecs(), stop: toNum(f.stop), target: pro ? toNum(f.target) : t.target ?? null,
      riskOverride: pro ? toNum(f.riskOverride) : t.riskOverride ?? null, mae: pro ? toNum(f.mae) : t.mae ?? null, mfe: pro ? toNum(f.mfe) : t.mfe ?? null,
      timeframe: pro ? f.timeframe : t.timeframe || '', notes: f.notes, lessons: pro ? f.lessons : t.lessons || '',
      ...(pro ? {
        grade: f.grade, confidence: toNum(f.confidence), followedPlan: f.followedPlan === 'yes' ? true : f.followedPlan === 'no' ? false : null,
        mistakes: f.mistakes || [], emotions: f.emotions || [], tags: f.tags || [],
        checklist: Object.fromEntries(Object.keys(f).filter(k => /^chk\d+$/.test(k)).map(k => [k.slice(3), f[k]])),
      } : {}),
      images,
    };
  }
  function update() {
    const c = computeTrade(draft());
    const p = el.querySelector('#preview');
    p.innerHTML = String(html`
      <span>Net P&L <b class="${pnlClass(c.net)}">${c.closed ? money(c.net, { sign: true }) : c.entryQty ? 'open' : '—'}</b></span>
      <span>Risk <b>${money(c.risk)}</b></span>
      <span>R <b class="${pnlClass(c.r)}">${rmult(c.r)}</b></span>
      ${c.plannedR != null ? html`<span>Planned R:R <b>${num(c.plannedR, 2)}</b></span>` : ''}
      <span>Avg entry <b>${price(c.avgEntry)}</b></span>
      ${c.avgExit != null ? html`<span>Avg exit <b>${price(c.avgExit)}</b></span>` : ''}
      ${c.openQty > 0 && c.exitQty > 0 ? html`<span>Open qty <b>${c.openQty}</b></span>` : ''}
      ${c.holdMs != null ? html`<span>Hold <b>${duration(c.holdMs)}</b></span>` : ''}`);
  }
  form.addEventListener('input', e => { if (!e.target.closest('.exec-table')) update(); });
  update();

  // ---- screenshots ----
  if (pro) {
    const shots = el.querySelector('#shots');
    const redraw = () => renderShots(shots, images, true, rid => { images = images.filter(x => x !== rid); });
    redraw();
    const drop = el.querySelector('#drop'), fin = drop.querySelector('input');
    const add = async files => {
      for (const f of files) if (f.type.startsWith('image/')) { const nid = await store.putImage(f); images.push(nid); newImages.push(nid); }
      redraw();
    };
    drop.onclick = () => fin.click();
    drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fin.click(); } };
    fin.onchange = () => add([...fin.files]);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); add([...e.dataTransfer.files]); };
    const onPaste = e => { const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/')); if (files.length) { e.preventDefault(); add(files); } };
    document.addEventListener('paste', onPaste);
    var cleanupPaste = () => document.removeEventListener('paste', onPaste);
  }

  // ---- save ----
  let again = false;
  form.querySelector('[data-again]')?.addEventListener('click', () => { again = true; });
  form.onsubmit = async e => {
    e.preventDefault();
    const d = draft();
    if (!d.symbol) { toast('Symbol is required', 'error'); again = false; return; }
    if (!d.executions.length) { toast('Enter at least an entry price and quantity', 'error'); again = false; return; }
    const c = computeTrade(d);
    if (c.exitQty > c.entryQty + 1e-9) { toast('Exits exceed entries — check buy/sell actions', 'error'); again = false; return; }
    if (!d.accountId) {
      const a = await store.put('tAccounts', { name: 'Main account', broker: '', type: 'margin', startingBalance: 0 });
      d.accountId = a.id;
    }
    try { localStorage.setItem('tj.lastAccount', d.accountId); } catch {}
    // drop images removed during this edit
    for (const old of existing?.images || []) if (!images.includes(old)) await store.delImage(old);
    newImages.length = 0;
    const saved = await store.put('trades', d);
    toast(existing ? 'Trade updated' : 'Trade saved');
    if (again) { again = false; go('/trading/new?r=' + Date.now()); }
    else go(`/trading/trade/${saved.id}`);
  };

  return () => {
    cleanupPaste?.();
    // discard screenshots uploaded to an unsaved form
    for (const nid of newImages) store.delImage(nid);
  };
}
