// Moves: plan transfers between your own accounts (cash out trading profits, top up savings,
// rebalance) and mark them done, which updates both balances.
// Interest: what each yield account earns, what your debts cost, and money sitting idle.
import * as store from '../store.js';
import { html, raw, money, pct, num, stat, fmtDate, today, modal, toast, confirmDlg, toNum, dayKey } from '../ui.js';
import * as C from '../charts.js';
import { assetCats, catKey, interestOverview, pointAt, typeLabel } from './calc.js';
import { flow, undoFlow, adjustable } from './ledger.js';
import { conv, ccyOf, moneyIn, toDisplay, sameMoney, displayCcy } from '../fx.js';
import { refresh } from '../main.js';

const acct = id => store.get('nwAccounts', id);
const name = id => acct(id)?.name || html`<span class="muted">deleted account</span>`;
const apyOf = id => { const a = acct(id); return a && a.kind !== 'liability' ? +a.apy || 0 : 0; };
// yearly interest gained (or lost) by moving `v` (display currency) from one account to another
const interestDelta = m => { const v = toDisplay(+m.amount || 0, m.currency); const toA = acct(m.toId); const cost = toA?.kind === 'liability' ? +toA.rate || 0 : 0; return v * (apyOf(m.toId) - apyOf(m.fromId) + cost) / 100; };

async function editMove(m = {}) {
  const accts = store.all('nwAccounts').filter(a => !a.archivedAt).sort((a, b) => (a.kind === 'liability') - (b.kind === 'liability') || a.name.localeCompare(b.name));
  if (accts.length < 2) { toast('Add at least two accounts first', 'error'); return false; }
  const opts = sel => html`${accts.map(a => html`<option value="${a.id}" ${a.id === sel ? raw('selected') : ''}>${a.name} · ${typeLabel(a)} (${ccyOf(a)})</option>`)}`;
  const res = await modal({
    title: m.id ? 'Edit move' : 'Plan a move', wide: true,
    body: String(html`<form id="mvf" class="form-grid">
      <label class="field span2">From<select name="fromId">${opts(m.fromId || accts[0].id)}</select></label>
      <label class="field span2">To<select name="toId">${opts(m.toId || accts[1].id)}</select></label>
      <label class="field">Amount <span class="hint" id="mv-ccy"></span><input name="amount" type="number" step="any" min="0" required value="${m.amount ?? ''}" inputmode="decimal"></label>
      <label class="field">Arrives as <span class="hint" id="mv-ccy2"></span><input name="toAmount" type="number" step="any" min="0" value="${m.toAmount ?? ''}" placeholder="same"></label>
      <label class="field">Planned for<input name="date" type="date" value="${m.date || today()}"></label>
      <label class="field">Note <span class="hint">why?</span><input name="note" maxlength="80" value="${m.note || ''}" placeholder="e.g. take profits, top up savings"></label>
      <div class="full small muted" id="mv-info"></div>
    </form>`),
    onMount: w => {
      const f = w.querySelector('#mvf');
      const sync = () => {
        const fa = acct(f.fromId.value), ta = acct(f.toId.value);
        w.querySelector('#mv-ccy').textContent = fa ? `in ${ccyOf(fa)}` : '';
        w.querySelector('#mv-ccy2').textContent = ta ? `in ${ccyOf(ta)}` : '';
        const diff = fa && ta && !sameMoney(ccyOf(fa), ccyOf(ta));
        f.toAmount.closest('.field').hidden = !diff;
        f.toAmount.placeholder = diff && +f.amount.value ? String(Math.round(conv(+f.amount.value, ccyOf(fa), ccyOf(ta)) * 100) / 100) : 'same';
        const d = +f.amount.value ? interestDelta({ amount: +f.amount.value, currency: ccyOf(fa), fromId: fa?.id, toId: ta?.id }) : 0;
        const warn = [fa, ta].filter(a => a && !adjustable(a)).map(a => a.name);
        w.querySelector('#mv-info').innerHTML = String(html`${Math.abs(d) >= 0.01 ? html`Interest effect: <b class="${d > 0 ? 'pos' : 'neg'}">${money(d, { sign: true })} / year</b>${ta?.kind === 'liability' ? ' (debt interest you stop paying)' : ''}. ` : ''}${warn.length ? html`${warn.join(', ')} ${warn.length > 1 ? 'are' : 'is'} valued from holdings — update the holdings yourself when the move is done.` : ''}`);
      };
      f.addEventListener('input', sync); f.addEventListener('change', sync); sync();
    },
    actions: [...(m.id ? [{ label: 'Delete', kind: 'danger ghost', value: () => 'delete' }] : []), { label: 'Cancel' }, { label: 'Save', kind: 'primary', value: w => {
      const f = w.querySelector('#mvf');
      if (f.fromId.value === f.toId.value) { toast('From and To must be different accounts', 'error'); return false; }
      if (!(+f.amount.value > 0)) { toast('Enter an amount above zero', 'error'); return false; }
      return { fromId: f.fromId.value, toId: f.toId.value, amount: +f.amount.value, toAmount: f.toAmount.closest('.field').hidden ? null : toNum(f.toAmount.value), date: f.date.value || today(), note: f.note.value.trim() };
    } }],
  });
  if (res === 'delete') { if (await confirmDlg('Delete this move?', m.status === 'done' ? 'Balances already changed by it are not changed back — use Undo for that.' : 'It is only a plan, so no balances change.')) { await store.del('nwMoves', m.id); toast('Move deleted'); return true; } return false; }
  if (!res || typeof res !== 'object') return false;
  await store.put('nwMoves', { status: 'planned', ...m, ...res, currency: ccyOf(acct(res.fromId)) });
  toast(m.id ? 'Move updated' : 'Move planned');
  return true;
}

async function markDone(m) {
  const fa = acct(m.fromId), ta = acct(m.toId);
  if (!fa || !ta) { toast('One of the accounts no longer exists', 'error'); return false; }
  const toAmt = m.toAmount ?? Math.round(conv(+m.amount, m.currency, ccyOf(ta)) * 100) / 100;
  const from = await flow(fa.id, +m.amount, m.currency, 'out');
  const to = await flow(ta.id, toAmt, ccyOf(ta), 'in');
  await store.put('nwMoves', { ...m, status: 'done', doneAt: today(), applied: { from, to } });
  const skipped = [fa, ta].filter(a => !adjustable(a)).map(a => a.name);
  toast(skipped.length ? `Done — update the holdings of ${skipped.join(' and ')} yourself` : 'Done — both balances updated');
  return true;
}
async function undoDone(m) {
  if (!(await confirmDlg('Undo this move?', 'Both balances are changed back and the move returns to your plan.', 'Undo'))) return false;
  await undoFlow(m.applied?.from); await undoFlow(m.applied?.to);
  await store.put('nwMoves', { ...m, status: 'planned', doneAt: null, applied: null });
  toast('Move undone'); return true;
}

// what the target allocation (Analytics) says to move, by type
function rebalanceHints() {
  const ta = store.getSettings().plan?.targetAllocation || {};
  if (!Object.keys(ta).length) return [];
  const cur = pointAt(today());
  if (!cur.assets) return [];
  return assetCats().map(c => { const tg = +ta[c.id] || 0; const v = cur.byCat[c.id] || 0; const drift = v / cur.assets - tg / 100; return { c, tg, v, drift, move: (tg / 100) * cur.assets - v, out: tg > 0 && Math.abs(drift) > Math.min(0.05, (tg / 100) * 0.25) }; }).filter(x => x.out);
}

export async function moves(el) {
  const all = [...store.all('nwMoves')];
  const planned = all.filter(m => m.status !== 'done').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const done = all.filter(m => m.status === 'done').sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
  const plannedTotal = planned.reduce((s, m) => s + toDisplay(+m.amount || 0, m.currency), 0);
  const month = today().slice(0, 7), doneMonth = done.filter(m => (m.doneAt || '').startsWith(month));
  const gain = planned.reduce((s, m) => s + interestDelta(m), 0);
  const hints = rebalanceHints();
  const row = m => html`<tr>
    <td style="white-space:nowrap" class="${m.status !== 'done' && m.date < today() ? 'neg' : ''}">${fmtDate(m.status === 'done' ? m.doneAt : m.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
    <td><b>${name(m.fromId)}</b> → <b>${name(m.toId)}</b>${m.note ? html`<div class="small muted">${m.note}</div>` : ''}</td>
    <td class="num">${moneyIn(+m.amount, m.currency)}${m.toAmount != null && acct(m.toId) && !sameMoney(m.currency, ccyOf(acct(m.toId))) ? html`<div class="dist">→ ${moneyIn(+m.toAmount, ccyOf(acct(m.toId)))}</div>` : ''}</td>
    <td class="num ${interestDelta(m) > 0 ? 'pos' : interestDelta(m) < 0 ? 'neg' : 'muted'}">${Math.abs(interestDelta(m)) >= 0.01 ? money(interestDelta(m), { sign: true }) : '—'}</td>
    <td style="text-align:right;white-space:nowrap">${m.status === 'done' ? html`<button class="btn sm" data-undo="${m.id}">Undo</button>` : html`<button class="btn sm primary" data-done="${m.id}">Mark done</button> <button class="btn sm" data-edit="${m.id}">Edit</button>`}</td></tr>`;
  el.innerHTML = String(html`<div class="page-head"><div><h1>Moves</h1><div class="sub">Plan money moves between your own accounts — take profits off an exchange, top up savings, pay down a card, rebalance. Mark one done and both balances update.</div></div>
    <div class="actions"><button class="btn primary" data-new>+ Plan a move</button></div></div>
    <div class="stats">
      ${stat('Planned', String(planned.length), { sub: planned.length ? `${money(plannedTotal)} to move` : 'nothing planned' })}
      ${stat('Overdue', String(planned.filter(m => m.date < today()).length), { cls: planned.some(m => m.date < today()) ? 'neg' : '', sub: 'planned date has passed' })}
      ${stat('Done this month', String(doneMonth.length), { sub: money(doneMonth.reduce((s, m) => s + toDisplay(+m.amount || 0, m.currency), 0)) })}
      ${stat('Interest effect of plan', Math.abs(gain) >= 0.01 ? money(gain, { sign: true }) : '—', { cls: gain > 0 ? 'pos' : gain < 0 ? 'neg' : '', sub: 'per year, from APY / APR differences', help: 'Amount × (APY of the destination − APY of the source). Moving money onto a debt counts that debt\'s APR as interest saved.' })}
    </div>
    ${hints.length ? html`<div class="card mt"><div class="card-head"><h2>Your target allocation says</h2><a class="hint" href="#/networth/analytics">Targets →</a></div>
      <div class="stack" style="gap:6px">${hints.map(h => html`<div class="row small"><b>${h.c.label}</b><span class="muted">${pct(h.v / pointAt(today()).assets, 1)} now, target ${h.tg}%</span><span class="spacer"></span><b class="${h.move > 0 ? 'pos' : 'neg'}">${h.move > 0 ? 'add' : 'take out'} ${money(Math.abs(h.move))}</b></div>`)}</div></div>` : ''}
    <div class="card mt" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><h2>Planned</h2><span class="hint">${planned.length}</span></div>
      ${planned.length ? html`<div class="table-wrap" style="border:0"><table class="data"><thead><tr><th>Date</th><th>Move</th><th class="num">Amount</th><th class="num">Interest / yr</th><th></th></tr></thead><tbody>${planned.map(row)}</tbody></table></div>`
        : html`<p class="muted small" style="padding:0 16px 16px">Nothing planned. Add the next transfer you intend to make — e.g. “€2,000 from Binance to Savings on the 1st”.</p>`}</div>
    ${done.length ? html`<div class="card mt" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><h2>Done</h2><span class="hint">${done.length}</span></div>
      <div class="table-wrap" style="border:0;max-height:420px"><table class="data"><thead><tr><th>Done</th><th>Move</th><th class="num">Amount</th><th class="num">Interest / yr</th><th></th></tr></thead><tbody>${done.slice(0, 100).map(row)}</tbody></table></div></div>` : ''}`);
  el.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    let ch = false;
    if (b.dataset.new !== undefined) ch = await editMove();
    else if (b.dataset.edit) ch = await editMove(store.get('nwMoves', b.dataset.edit));
    else if (b.dataset.done) ch = await markDone(store.get('nwMoves', b.dataset.done));
    else if (b.dataset.undo) ch = await undoDone(store.get('nwMoves', b.dataset.undo));
    if (ch) refresh();
  });
}

// ================= interest =================
export async function interest(el) {
  const io = interestOverview();
  const p = C.palette();
  el.innerHTML = String(html`<div class="page-head"><div><h1>Interest</h1><div class="sub">What your money earns, what your debts cost, and what sits idle. Set an APY on an account (Accounts → Edit) and its balance grows daily between your updates.</div></div>
    <div class="actions"><a class="btn" href="#/networth/accounts">Accounts</a><a class="btn primary" href="#/networth/update">Update balances</a></div></div>
    <div class="stats big">
      ${stat('Earning per month', money(io.earnMonth), { cls: io.earnMonth ? 'pos' : '', sub: `${money(io.earnYear)} / year · ${money(io.earnYear / 365, { decimals: 2 })} / day` })}
      ${stat('Blended APY', pct(io.blended, 2), { sub: `on ${money(io.earnValue)} earning interest` })}
      ${stat('Earned this year', money(io.ytd), { cls: io.ytd ? 'pos' : '', sub: `${money(io.total)} since you started tracking`, help: 'Estimate: between balance updates each recorded balance grows at the APY in force then. When you type a new balance, the estimate restarts from it.' })}
      ${stat('Debt interest', io.payMonth ? money(-io.payMonth) : '—', { cls: io.payMonth ? 'neg' : '', sub: io.payMonth ? `${money(io.payYear)} / year` : 'no debts with an APR', help: 'What your debts cost per month at their APR.' })}
    </div>
    ${io.earn.length ? html`<div class="card mt" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><h2>Interest-bearing accounts</h2><span class="hint">estimates at the current APY</span></div>
      <div class="table-wrap" style="border:0"><table class="data"><thead><tr><th>Account</th><th class="num">Balance now</th><th class="num">APY</th><th class="num">Per day</th><th class="num">Per month</th><th class="num">Per year</th><th class="num">Since last update</th><th class="num">This year</th></tr></thead><tbody>
      ${io.earn.map(x => html`<tr><td><b>${x.a.name}</b><div class="small muted">${typeLabel(x.a)}${x.lastUpdate ? ` · updated ${fmtDate(x.lastUpdate, { month: 'short', day: 'numeric' })}` : ''}</div></td><td class="num">${moneyIn(x.native, ccyOf(x.a))}${!sameMoney(ccyOf(x.a), displayCcy()) ? html`<div class="dist">≈ ${money(x.value)}</div>` : ''}</td><td class="num">${num(x.apy, 2)}%</td><td class="num">${money(x.perDay, { decimals: 2 })}</td><td class="num pos">${money(x.perMonth)}</td><td class="num">${money(x.perYear)}</td><td class="num">${money(x.sinceUpdate)}</td><td class="num">${money(x.ytd)}</td></tr>`)}
      </tbody><tfoot><tr><td>Total</td><td class="num">${money(io.earnValue)}</td><td class="num">${pct(io.blended, 2)}</td><td class="num">${money(io.earnYear / 365, { decimals: 2 })}</td><td class="num">${money(io.earnMonth)}</td><td class="num">${money(io.earnYear)}</td><td class="num">${money(io.sinceUpdate)}</td><td class="num">${money(io.ytd)}</td></tr></tfoot></table></div></div>`
      : html`<div class="empty mt"><div class="empty-title">No interest-bearing accounts yet</div><p>Savings accounts, money-market funds, staking, bonds… Edit the account and set its <b>APY</b> — the app then shows what it earns per day, month and year, and grows the balance between your updates.</p><a class="btn primary" href="#/networth/accounts">Go to accounts</a></div>`}
    ${io.earn.length ? html`<div class="grid g2 mt">
      <div class="card"><div class="card-head"><h2>Next 12 months</h2><span class="hint">cumulative interest if balances and rates stay the same</span></div><div class="chart"><canvas id="i-proj"></canvas></div></div>
      <div class="card"><div class="card-head"><h2>Where the interest comes from</h2><span class="hint">per year</span></div><div class="chart"><canvas id="i-src"></canvas></div></div></div>` : ''}
    <div class="grid g2 mt">
      <div class="card"><div class="card-head"><h2>Not earning anything</h2><span class="hint">cash & savings with no APY</span></div>
        ${io.idle.length ? html`<dl class="kv">${io.idle.map(x => html`<dt>${x.a.name}</dt><dd>${money(x.value)}</dd>`)}</dl>
          ${io.blended ? html`<p class="small muted mt">At your blended ${pct(io.blended, 2)} APY, ${money(io.idleValue)} would earn about <b class="pos">${money(io.idleValue * io.blended / 12)}</b> a month. Keep what you need for spending, move the rest with a <a href="#/networth/moves">planned move</a>.</p>` : ''}`
          : html`<p class="muted small">Nothing idle — every cash and savings account has an APY set.</p>`}</div>
      <div class="card"><div class="card-head"><h2>Debts</h2><span class="hint">interest you pay</span></div>
        ${io.pay.length ? html`<table class="data compact"><thead><tr><th>Debt</th><th class="num">Owed</th><th class="num">APR</th><th class="num">Per month</th></tr></thead><tbody>${io.pay.map(x => html`<tr><td>${x.a.name}</td><td class="num">${money(x.owed)}</td><td class="num">${num(x.rate, 2)}%</td><td class="num neg">${money(x.perMonth)}</td></tr>`)}</tbody></table>
          ${(() => { const top = [...io.pay].sort((x, y) => y.rate - x.rate)[0]; return io.blended != null && top.rate > io.blended * 100 ? html`<p class="small muted mt">${top.a.name} costs ${num(top.rate, 2)}% — more than your savings earn (${pct(io.blended, 2)}). Paying it down is a guaranteed ${num(top.rate, 2)}% return.</p>` : ''; })()}`
          : html`<p class="muted small">No debts with an interest rate (APR) set.</p>`}</div>
    </div>`);
  if (!io.earn.length) return;
  const labels = [], cum = [];
  const now = new Date();
  for (let m = 1; m <= 12; m++) {
    labels.push(fmtDate(dayKey(new Date(now.getFullYear(), now.getMonth() + m, 1)), { month: 'short', year: '2-digit' }));
    cum.push(io.earn.reduce((s, x) => s + x.value * (Math.pow(1 + x.apy / 100, m / 12) - 1), 0));
  }
  C.moneyLine(el.querySelector('#i-proj'), { labels, zero: true, series: [{ label: 'Interest earned', data: cum, color: p.pos, fill: true }] });
  C.plainBars(el.querySelector('#i-src'), { labels: io.earn.map(x => `${x.a.name} (${num(x.apy, 2)}%)`), values: io.earn.map(x => x.perYear), horizontal: true, fmt: v => money(v, { compact: true }), label: 'Per year' });
}
