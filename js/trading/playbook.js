import * as store from '../store.js';
import { html, raw, money, pct, rmult, pnlClass, modal, toast, confirmDlg, formData, toNum, fmtDate, stat } from '../ui.js';
import { computedTrades, stats, startingCapital } from './calc.js';
import { setFilter } from './common.js';
import { ccySelect, displayCcy, moneyIn } from '../fx.js';
import { DEFAULT_FILTER } from './calc.js';
import { go, refresh } from '../main.js';

// ================= playbook =================
async function editSetup(s = {}) {
  const res = await modal({
    title: s.id ? `Edit ${s.name}` : 'New setup', wide: true,
    body: String(html`<form class="form-grid" id="sf">
      <label class="field span2">Name<input name="name" required value="${s.name || ''}" placeholder="e.g. Opening range breakout"></label>
      <label class="field">Timeframe<input name="timeframe" value="${s.timeframe || ''}" placeholder="5m"></label>
      <label class="field">Status<select name="active"><option value="1">Active</option><option value="0" ${s.active === false ? raw('selected') : ''}>Retired</option></select></label>
      <label class="field full">Description / thesis — why does this work?<textarea name="description" rows="3">${s.description || ''}</textarea></label>
      <label class="field span2">Ideal market conditions<textarea name="conditions" rows="3">${s.conditions || ''}</textarea></label>
      <label class="field span2">Entry trigger<textarea name="entry" rows="3">${s.entry || ''}</textarea></label>
      <label class="field span2">Stop placement<textarea name="stopRule" rows="2">${s.stopRule || ''}</textarea></label>
      <label class="field span2">Targets / exit management<textarea name="exit" rows="2">${s.exit || ''}</textarea></label>
      <label class="field full">Checklist rules <span class="hint">one per line — you tick them off on every trade</span><textarea name="rules" rows="5">${(s.rules || []).join('\n')}</textarea></label>
    </form>`),
    actions: [{ label: 'Cancel' }, { label: 'Save setup', kind: 'primary', value: w => { const f = w.querySelector('#sf'); if (!f.name.value.trim()) { toast('Name is required', 'error'); return false; } return formData(f); } }],
  });
  if (!res || typeof res !== 'object') return;
  await store.put('setups', { ...s, ...res, name: res.name.trim(), active: res.active === '1', rules: res.rules.split('\n').map(x => x.trim()).filter(Boolean) });
  toast('Setup saved');
}

export async function playbook(el) {
  const setups = [...store.all('setups')].sort((a, b) => (b.active !== false) - (a.active !== false) || a.name.localeCompare(b.name));
  const trades = computedTrades();
  el.innerHTML = String(html`
    <div class="page-head"><div><h1>Playbook</h1><div class="sub">Define each setup you trade, with rules you check on every trade. Then let the numbers tell you which ones deserve size.</div></div>
      <div class="actions"><button class="btn primary" data-new>+ New setup</button></div></div>
    ${!setups.length ? html`<div class="empty"><div class="empty-title">No setups yet</div><p>A playbook turns "I trade breakouts" into specific, measurable setups with a checklist.</p><button class="btn primary" data-new>+ Create your first setup</button></div>` : ''}
    <div class="grid g2">${setups.map(s => {
      const st = stats(trades.filter(t => t.setupId === s.id));
      return html`<div class="card" ${s.active === false ? raw('style="opacity:.6"') : ''}>
        <div class="card-head"><div><h2>${s.name}</h2><div class="muted small">${s.timeframe || ''}${s.active === false ? ' · retired' : ''}</div></div>
          <div class="row"><button class="btn sm" data-trades="${s.id}">Trades</button><button class="btn sm" data-edit="${s.id}">Edit</button><button class="icon-btn" data-del="${s.id}" aria-label="Delete setup">✕</button></div></div>
        <div class="stats" style="grid-template-columns:repeat(4,1fr)">
          ${stat('Net', money(st.net, { sign: true, compact: Math.abs(st.net) > 99999 }), { cls: pnlClass(st.net) })}${stat('Trades', st.n)}${stat('Win %', pct(st.winRate, 0))}${stat('Avg R', rmult(st.avgR), { cls: pnlClass(st.avgR) })}
        </div>
        ${s.description ? html`<p class="md small mt">${s.description}</p>` : ''}
        ${s.entry || s.stopRule || s.exit ? html`<dl class="kv small mt" style="grid-template-columns:auto 1fr">${s.conditions ? html`<dt>Conditions</dt><dd style="text-align:left" class="md">${s.conditions}</dd>` : ''}${s.entry ? html`<dt>Entry</dt><dd style="text-align:left" class="md">${s.entry}</dd>` : ''}${s.stopRule ? html`<dt>Stop</dt><dd style="text-align:left" class="md">${s.stopRule}</dd>` : ''}${s.exit ? html`<dt>Exit</dt><dd style="text-align:left" class="md">${s.exit}</dd>` : ''}</dl>` : ''}
        ${(s.rules || []).length ? html`<h3 class="mt">Checklist</h3><div class="checklist small">${s.rules.map(r => html`<div>☐ ${r}</div>`)}</div>` : ''}
        <div class="mt"><a class="btn sm" href="#/trading/new?setup=${s.id}">+ Log trade with this setup</a></div>
      </div>`;
    })}</div>`);
  el.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.new !== undefined) { await editSetup(); refresh(); }
    else if (b.dataset.edit) { await editSetup(store.get('setups', b.dataset.edit)); refresh(); }
    else if (b.dataset.trades) { setFilter({ ...DEFAULT_FILTER, setup: b.dataset.trades }); go('/trading/trades'); }
    else if (b.dataset.del) {
      const s = store.get('setups', b.dataset.del);
      const n = store.all('trades').filter(t => t.setupId === s.id).length;
      if (!(await confirmDlg('Delete setup?', `Delete "${s.name}"? ${n} trade(s) will keep their data but lose the setup link. Consider marking it retired instead.`))) return;
      for (const t of store.all('trades').filter(t => t.setupId === s.id)) await store.put('trades', { ...t, setupId: '' });
      await store.del('setups', s.id); refresh();
    }
  });
}

// ================= trading accounts =================
const ACCOUNT_TYPES = [['cash', 'Cash'], ['margin', 'Margin'], ['prop', 'Prop firm / funded'], ['futures', 'Futures'], ['crypto', 'Crypto exchange'], ['retirement', 'Retirement (IRA etc.)'], ['paper', 'Paper / sim']];

async function editAccount(a = {}) {
  const res = await modal({
    title: a.id ? `Edit ${a.name}` : 'New trading account',
    body: String(html`<form class="form-grid" id="af">
      <label class="field span2">Name<input name="name" required value="${a.name || ''}" placeholder="e.g. IBKR main"></label>
      <label class="field">Broker<input name="broker" value="${a.broker || ''}"></label>
      <label class="field">Type<select name="type">${ACCOUNT_TYPES.map(([v, l]) => html`<option value="${v}" ${a.type === v ? raw('selected') : ''}>${l}</option>`)}</select></label>
      <label class="field">Currency${raw(ccySelect('currency', a.currency || displayCcy()))}</label>
      <label class="field">Starting balance<input name="startingBalance" type="number" step="any" value="${a.startingBalance ?? ''}"></label>
      <label class="field">Start date<input name="startDate" type="date" value="${a.startDate || ''}"></label>
    </form>`),
    actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', value: w => { const f = w.querySelector('#af'); if (!f.name.value.trim()) { toast('Name is required', 'error'); return false; } return formData(f); } }],
  });
  if (!res || typeof res !== 'object') return null;
  const saved = await store.put('tAccounts', { ...a, ...res, name: res.name.trim(), startingBalance: toNum(res.startingBalance) || 0, currency: res.currency || displayCcy() });
  // keep linked net-worth accounts in the same currency
  for (const n of store.all('nwAccounts').filter(n => n.linkedTradingAccountId === saved.id && n.currency !== saved.currency)) await store.put('nwAccounts', { ...n, currency: saved.currency });
  return saved;
}

async function addTransfer(accountId) {
  const res = await modal({
    title: 'Deposit / withdrawal',
    body: String(html`<form class="form-grid" id="xf">
      <label class="field">Type<select name="type"><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal / payout</option></select></label>
      <label class="field">Date<input name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}"></label>
      <label class="field">Amount <span class="hint">${store.get('tAccounts', accountId)?.currency || displayCcy()}</span><input name="amount" type="number" step="any" min="0" required></label>
      <label class="field">Note<input name="note"></label></form>`),
    actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', value: w => { const f = w.querySelector('#xf'); if (!(+f.amount.value > 0) || !f.date.value) { toast('Date and amount are required', 'error'); return false; } return formData(f); } }],
  });
  if (!res || typeof res !== 'object') return;
  await store.put('tTransfers', { ...res, accountId, amount: +res.amount });
}

export async function accounts(el) {
  const accts = store.all('tAccounts');
  const trades = computedTrades();
  el.innerHTML = String(html`
    <div class="page-head"><div><h1>Trading accounts</h1><div class="sub">Starting balance plus deposits/withdrawals lets the journal compute equity, % drawdown and link balances into your net worth.</div></div>
      <div class="actions"><button class="btn primary" data-new>+ New account</button></div></div>
    ${!accts.length ? html`<div class="empty"><div class="empty-title">No accounts yet</div><p>One is created automatically with your first trade, or add yours now.</p><button class="btn primary" data-new>+ New account</button></div>` : ''}
    <div class="stack">${accts.map(a => {
      const ts = trades.filter(t => t.accountId === a.id);
      const st = stats(ts);
      const xfers = store.all('tTransfers').filter(x => x.accountId === a.id).sort((x, y) => y.date.localeCompare(x.date));
      const cap = startingCapital(a.id);
      const equity = cap + st.net;
      return html`<div class="card"><div class="card-head"><div><h2>${a.name}</h2><div class="muted small">${[a.broker, ACCOUNT_TYPES.find(t => t[0] === a.type)?.[1]].filter(Boolean).join(' · ')}</div></div>
          <div class="row"><button class="btn sm" data-xfer="${a.id}">+ Deposit / withdrawal</button><button class="btn sm" data-edit="${a.id}">Edit</button><button class="icon-btn" data-del="${a.id}" aria-label="Delete account">✕</button></div></div>
        <div class="stats">
          ${stat('Equity', money(equity), { sub: 'start + net deposits + closed P&L' })}
          ${stat('Starting balance', moneyIn(+a.startingBalance || 0, a.currency), { sub: a.currency !== displayCcy() ? `account in ${a.currency}` : '' })}
          ${stat('Net deposits', money(cap - (+a.startingBalance || 0), { sign: true }))}
          ${stat('Closed P&L', money(st.net, { sign: true }), { cls: pnlClass(st.net), sub: `${st.n} trades` })}
          ${stat('Return on capital', cap > 0 ? pct(st.net / cap, 1) : '—', { cls: pnlClass(st.net) })}
          ${stat('Max drawdown', money(st.maxDD), { cls: st.maxDD < 0 ? 'neg' : '' })}
        </div>
        ${xfers.length ? html`<details class="mt"><summary class="small muted" style="cursor:pointer">${xfers.length} deposits / withdrawals</summary><table class="data compact mt"><tbody>${xfers.map(x => html`<tr><td>${fmtDate(x.date)}</td><td>${x.type === 'withdrawal' ? 'Withdrawal' : 'Deposit'}</td><td class="num ${x.type === 'withdrawal' ? 'neg' : 'pos'}">${moneyIn((x.type === 'withdrawal' ? -1 : 1) * x.amount, a.currency, { sign: true })}</td><td class="muted">${x.note || ''}</td><td><button class="icon-btn" data-delx="${x.id}" aria-label="Delete">✕</button></td></tr>`)}</tbody></table></details>` : ''}
      </div>`;
    })}</div>`);
  el.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.new !== undefined) { if (await editAccount()) refresh(); }
    else if (b.dataset.edit) { if (await editAccount(store.get('tAccounts', b.dataset.edit))) refresh(); }
    else if (b.dataset.xfer) { await addTransfer(b.dataset.xfer); refresh(); }
    else if (b.dataset.delx) { await store.del('tTransfers', b.dataset.delx); refresh(); }
    else if (b.dataset.del) {
      const a = store.get('tAccounts', b.dataset.del);
      const n = store.all('trades').filter(t => t.accountId === a.id).length;
      if (n) { toast(`${a.name} has ${n} trades — move or delete them first`, 'error'); return; }
      if (!(await confirmDlg('Delete account?', `Delete ${a.name}?`))) return;
      await store.delWhere('tTransfers', x => x.accountId === a.id);
      await store.del('tAccounts', a.id); refresh();
    }
  });
}
