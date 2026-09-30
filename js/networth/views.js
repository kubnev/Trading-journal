import * as store from '../store.js';
import { html, raw, money, pct, num, pnlClass, stat, fmtDate, fmtMonth, today, modal, toast, confirmDlg, formData, toNum, monthKey, parseDay, dayKey } from '../ui.js';
import * as C from '../charts.js';
import { ASSET_CATS, LIAB_CATS, catLabel, isLiquid, isInvestable, nwSeries, pointAt, cashflowMonths, trailing, fiMetrics, projection, changeDecomposition, debtMetrics } from './calc.js';
import { loadDemo } from '../demo.js';
import { go, refresh, query } from '../main.js';

const RANGES = [['all', 'All'], ['1y', '1Y'], ['3y', '3Y'], ['5y', '5Y']];
let range = 'all';
const catColor = (id, p) => { const i = ASSET_CATS.findIndex(c => c.id === id); return i >= 0 ? p.series[i % 8] : p.series[(LIAB_CATS.findIndex(c => c.id === id) + 2) % 8]; };
// Categories beyond 8 share hues, so allocation charts fold small ones into "Other" (max 7 slices)
function emptyNW() {
  return html`<div class="empty"><div class="empty-title">Start tracking your net worth</div><p>Add what you own (cash, investments, property) and what you owe (mortgage, loans, cards). Then update balances once a month — that's all it takes to build a history.</p>
    <a class="btn primary" href="#/networth/accounts">+ Add accounts</a><button class="btn" data-demo>Load demo data</button></div>`;
}
const wireDemo = el => el.querySelector('[data-demo]')?.addEventListener('click', async () => { await loadDemo(); refresh(); });

function rangeFilter(series) {
  if (range === 'all' || !series.length) return series;
  const yrs = { '1y': 1, '3y': 3, '5y': 5 }[range];
  const last = parseDay(series.at(-1).date);
  const cut = dayKey(new Date(last.getFullYear() - yrs, last.getMonth(), last.getDate()));
  const i = series.findIndex(p => p.date >= cut);
  return series.slice(Math.max(0, i - 1));
}

// ================= overview =================
export async function overview(el, _p, { mode }) {
  const pro = mode === 'pro';
  const accts = store.all('nwAccounts');
  const allSeries = nwSeries();
  el.innerHTML = String(html`<div class="page-head"><div><h1>Net worth</h1><div class="sub">${allSeries.length ? `Last updated ${fmtDate(allSeries.at(-1).date)}` : 'Everything you own minus everything you owe.'}</div></div>
    <div class="actions">${allSeries.length > 2 ? html`<div class="seg" id="rng">${RANGES.map(([k, l]) => html`<button data-r="${k}" class="${range === k ? 'on' : ''}">${l}</button>`)}</div>` : ''}<a class="btn primary" href="#/networth/update">Update balances</a></div></div><div id="body"></div>`);
  const body = el.querySelector('#body');
  if (!accts.length || !allSeries.length) { body.innerHTML = String(emptyNW()); wireDemo(body); return; }
  el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { range = b.dataset.r; el.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', x === b)); draw(); });

  const draw = () => {
    C.destroyAll();
    const series = rangeFilter(allSeries);
    const cur = allSeries.at(-1), prev = allSeries.at(-2), first = series[0];
    const yearAgo = allSeries.filter(p => p.date <= dayKey(new Date(parseDay(cur.date).getFullYear() - 1, parseDay(cur.date).getMonth(), parseDay(cur.date).getDate()))).at(-1);
    const ch = prev ? cur.net - prev.net : null;
    const chRange = first && first !== cur ? cur.net - first.net : null;
    const fi = fiMetrics(cur.investable);
    const t12 = trailing(cashflowMonths());
    const debt = debtMetrics(cur);
    const efMonths = t12.avgExpenses ? ((cur.byCat.cash || 0) + (cur.byCat.savings || 0)) / t12.avgExpenses : null;
    const p = C.palette();
    const assetCats = ASSET_CATS.filter(c => (cur.byCat[c.id] || 0) > 0);
    const liabCats = LIAB_CATS.filter(c => (cur.byCat[c.id] || 0) > 0);
    const liquidShare = cur.assets ? cur.liquid / cur.assets : null;
    const decomp = changeDecomposition(series);
    const hasDecomp = decomp.some(d => d.savings != null);

    body.innerHTML = String(html`
      <div class="stats big">
        ${stat('Net worth', money(cur.net), { sub: ch != null ? html`<span class="${pnlClass(ch)}">${money(ch, { sign: true })}</span> since ${fmtDate(prev.date, { month: 'short', day: 'numeric' })}` : '' })}
        ${stat(range === 'all' ? 'Change (all time)' : `Change (${range.toUpperCase()})`, money(chRange, { sign: true }), { cls: pnlClass(chRange), sub: chRange != null && first.net > 0 ? pct(chRange / Math.abs(first.net), 1, { sign: true }) : '' })}
        ${stat('Total assets', money(cur.assets), { sub: `${accts.filter(a => a.kind !== 'liability' && !a.archivedAt).length} accounts` })}
        ${stat('Total liabilities', money(cur.liabilities), { cls: cur.liabilities ? 'neg' : '', sub: `${accts.filter(a => a.kind === 'liability' && !a.archivedAt).length} debts` })}
      </div>
      ${pro ? html`<div class="stats mt">
        ${stat('Liquid net worth', money(cur.liquidNet), { cls: pnlClass(cur.liquidNet), sub: 'liquid assets − all debts', help: 'Liquid assets (cash, savings, brokerage, crypto, trading) minus all liabilities — what you could access in days.' })}
        ${stat('YoY change', yearAgo ? money(cur.net - yearAgo.net, { sign: true }) : '—', { cls: yearAgo ? pnlClass(cur.net - yearAgo.net) : '', sub: yearAgo && yearAgo.net > 0 ? pct((cur.net - yearAgo.net) / yearAgo.net, 1, { sign: true }) : '' })}
        ${stat('Debt-to-asset', pct(cur.assets ? cur.liabilities / cur.assets : null, 1), { cls: cur.assets && cur.liabilities / cur.assets > 0.5 ? 'neg' : '', help: 'Liabilities ÷ assets. Above 50% leaves you exposed to downturns.' })}
        ${stat('Emergency fund', efMonths != null ? `${num(efMonths, 1)} mo` : '—', { cls: efMonths != null && efMonths < 3 ? 'neg' : '', sub: 'cash ÷ avg monthly expenses', help: 'Cash & savings divided by average monthly expenses (from Cash flow). 3–6 months is the usual target.' })}
        ${stat('Savings rate (12m)', pct(t12.rate, 1), { cls: pnlClass(t12.rate), help: '(Income − expenses) ÷ income over the last 12 logged months.' })}
        ${stat('FI progress', pct(fi.progress, 1), { sub: fi.fiNumber ? `of ${money(fi.fiNumber, { compact: true })}` : 'set expenses in FI planning', help: 'Investable assets ÷ FI number (annual expenses ÷ withdrawal rate).' })}
      </div>` : ''}
      <div class="grid g-2-1 mt">
        <div class="card"><div class="card-head"><h2>Net worth over time</h2><span class="hint">${pro ? 'net worth, assets & liabilities' : ''}</span></div><div class="chart tall"><canvas id="n-line"></canvas></div></div>
        <div class="card"><div class="card-head"><h2>Asset allocation</h2><span class="hint">by category</span></div><div class="chart tall"><canvas id="n-alloc"></canvas></div></div>
      </div>
      ${pro ? html`
      <div class="grid g-2-1 mt">
        <div class="card"><div class="card-head"><h2>Assets by category</h2><span class="hint">stacked</span></div><div class="chart"><canvas id="n-stack"></canvas></div></div>
        <div class="card"><div class="card-head"><h2>Liquidity</h2></div>
          <div class="stat-label">Liquid share of assets</div><div class="stat-value">${pct(liquidShare, 0)}</div>
          <div class="meter" style="height:10px"><span style="width:${(liquidShare || 0) * 100}%;background:${p.series[0]}"></span><span style="flex:1;background:${p.neutral}"></span></div>
          <div class="legend-inline mt"><span><i style="background:${p.series[0]}"></i>Liquid ${money(cur.liquid, { compact: true })}</span><span><i style="background:${p.neutral}"></i>Illiquid ${money(cur.assets - cur.liquid, { compact: true })}</span></div>
          <div class="stat-label mt">Investable (counts toward FI)</div><div class="stat-value">${money(cur.investable)}</div>
          <div class="stat-sub">${pct(cur.assets ? cur.investable / cur.assets : null, 0)} of assets</div>
          ${liquidShare != null && liquidShare < 0.15 ? html`<div class="callout warn mt"><span class="ic">!</span><div>Under 15% of your assets are liquid.</div></div>` : ''}
        </div>
      </div>
      <div class="grid g2 mt">
        <div class="card"><div class="card-head"><h2>Change per period</h2><span class="hint">${hasDecomp ? 'savings vs. market & other' : 'log Cash flow to split savings from market moves'}</span></div><div class="chart"><canvas id="n-chg"></canvas></div></div>
        ${liabCats.length ? html`<div class="card"><div class="card-head"><h2>Debt breakdown</h2><span class="hint">${debt.wRate != null ? `weighted APR ${num(debt.wRate, 2)}%` : ''}</span></div><div class="chart"><canvas id="n-debt"></canvas></div></div>`
                          : html`<div class="card"><div class="card-head"><h2>Debt</h2></div><p class="muted">No liabilities recorded. 🎉</p></div>`}
      </div>` : ''}
      <div class="card mt" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><h2>Accounts</h2><a class="hint" href="#/networth/accounts">Manage →</a></div>
        <div class="table-wrap" style="border:0"><table class="data"><thead><tr><th>Account</th><th>Category</th>${pro ? raw('<th>Liquid</th>') : ''}<th class="num">Balance</th><th class="num">Change</th><th class="num">% of ${'assets'}</th>${pro ? raw('<th style="width:120px">Trend</th>') : ''}</tr></thead>
        <tbody>${accts.filter(a => !a.archivedAt).sort((a, b) => (a.kind === 'liability') - (b.kind === 'liability') || (cur.byAcct[b.id] || 0) - (cur.byAcct[a.id] || 0)).map(a => {
          const v = cur.byAcct[a.id] || 0, pv = prev ? prev.byAcct[a.id] || 0 : null;
          const d = pv == null ? null : (a.kind === 'liability' ? -(v - pv) : v - pv);
          return html`<tr><td><b>${a.name}</b>${a.institution ? html` <span class="muted small">${a.institution}</span>` : ''}${a.linkedTradingAccountId ? html` <span class="tag accent">linked</span>` : ''}</td><td>${catLabel(a.category)}</td>${pro ? html`<td>${a.kind === 'liability' ? '' : isLiquid(a) ? 'Yes' : 'No'}</td>` : ''}
            <td class="num ${a.kind === 'liability' ? 'neg' : ''}">${money(a.kind === 'liability' ? -v : v)}</td><td class="num ${pnlClass(d)}">${d ? money(d, { sign: true }) : '—'}</td><td class="num">${a.kind === 'liability' ? '' : pct(cur.assets ? v / cur.assets : null, 1)}</td>${pro ? html`<td><div style="height:28px;width:110px"><canvas data-spark="${a.id}"></canvas></div></td>` : ''}</tr>`;
        })}</tbody>
        <tfoot><tr><td colspan="${pro ? 3 : 2}">Net worth</td><td class="num">${money(cur.net)}</td><td class="num ${pnlClass(ch)}">${ch != null ? money(ch, { sign: true }) : ''}</td><td colspan="${pro ? 2 : 1}"></td></tr></tfoot></table></div></div>`);

    const labels = series.map(s => fmtDate(s.date, { month: 'short', year: '2-digit' }));
    C.moneyLine(body.querySelector('#n-line'), {
      labels,
      series: pro ? [{ label: 'Net worth', data: series.map(s => s.net), color: p.series[0], fill: true }, { label: 'Assets', data: series.map(s => s.assets), color: p.series[2] }, { label: 'Liabilities', data: series.map(s => s.liabilities), color: p.series[1] }]
                  : [{ label: 'Net worth', data: series.map(s => s.net), color: p.series[0], fill: true }],
    });
    C.doughnut(body.querySelector('#n-alloc'), { labels: assetCats.map(c => c.label), values: assetCats.map(c => cur.byCat[c.id]), colors: assetCats.map(c => catColor(c.id, p)), center: { value: money(cur.assets, { compact: true }), label: 'assets' } });
    if (pro) {
      const cats = ASSET_CATS.filter(c => series.some(s => (s.byCat[c.id] || 0) > 0));
      C.make(body.querySelector('#n-stack'), {
        type: 'line',
        data: { labels, datasets: cats.map(c => ({ label: c.label, data: series.map(s => s.byCat[c.id] || 0), borderColor: catColor(c.id, p), backgroundColor: C.alpha(catColor(c.id, p), 0.55), fill: true, borderWidth: 1, tension: 0.15, pointRadius: 0 })) },
        options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${money(c.parsed.y)}` } } }, scales: { x: C.plainAxis({ ticks: { maxTicksLimit: 8, maxRotation: 0 } }), y: { stacked: true, ...C.moneyAxis() } } },
      });
      const dl = decomp.map(d => fmtDate(d.date, { month: 'short', year: '2-digit' }));
      if (hasDecomp) {
        C.make(body.querySelector('#n-chg'), {
          type: 'bar',
          data: { labels: dl, datasets: [{ label: 'Savings', data: decomp.map(d => d.savings ?? 0), backgroundColor: p.series[0], maxBarThickness: 26 }, { label: 'Market & other', data: decomp.map(d => d.market ?? d.change), backgroundColor: p.series[2], maxBarThickness: 26 }] },
          options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${money(c.parsed.y, { sign: true })}`, footer: items => `Total: ${money(decomp[items[0].dataIndex].change, { sign: true })}` } } }, scales: { x: { stacked: true, ...C.plainAxis({ ticks: { maxRotation: 0 } }) }, y: { stacked: true, ...C.moneyAxis() } } },
        });
      } else C.signBars(body.querySelector('#n-chg'), { labels: dl, values: decomp.map(d => d.change) });
      if (liabCats.length) C.doughnut(body.querySelector('#n-debt'), { labels: liabCats.map(c => c.label), values: liabCats.map(c => cur.byCat[c.id]), colors: liabCats.map(c => catColor(c.id, p)), center: { value: money(cur.liabilities, { compact: true }), label: 'owed' } });
      body.querySelectorAll('[data-spark]').forEach(cv => { const id = cv.dataset.spark; const a = store.get('nwAccounts', id); C.sparkline(cv, series.map(s => s.byAcct[id] || 0), a.kind === 'liability' ? p.series[1] : p.series[0]); });
    }
  };
  draw();
}

// ================= update balances =================
export async function update(el) {
  const accts = store.all('nwAccounts').filter(a => !a.archivedAt).sort((a, b) => (a.kind === 'liability') - (b.kind === 'liability') || a.name.localeCompare(b.name));
  const snaps = [...store.all('nwSnapshots')].sort((a, b) => b.date.localeCompare(a.date));
  const date = query().get('date') || today();
  const existing = snaps.find(s => s.date === date);
  const prior = pointAt(date);
  el.innerHTML = String(html`<div class="page-head"><div><h1>Update balances</h1><div class="sub">Record what each account is worth on a date. Monthly (e.g. first of the month) is the sweet spot.</div></div>
      <div class="actions"><label class="row small">Snapshot date <input type="date" id="sd" value="${date}"></label></div></div>
    ${!accts.length ? html`<div class="empty"><div class="empty-title">No accounts yet</div><p>Add your assets and debts first.</p><a class="btn primary" href="#/networth/accounts">+ Add accounts</a><button class="btn" data-demo>Load demo data</button></div>` : html`
    <form id="uf" class="stack">
      ${existing ? html`<div class="note">Editing the existing snapshot for ${fmtDate(date)}.</div>` : html`<div class="note">Fields are pre-filled with the latest known values — change only what moved.</div>`}
      ${[['asset', 'Assets'], ['liability', 'Liabilities']].map(([k, l]) => {
        const list = accts.filter(a => (a.kind === 'liability') === (k === 'liability'));
        if (!list.length) return '';
        return html`<fieldset><legend>${l}</legend><div class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${list.map(a => {
          const v = existing && a.id in (existing.balances || {}) ? existing.balances[a.id] : prior.byAcct[a.id] || '';
          return html`<label class="field">${a.name} <span class="hint">${catLabel(a.category)}${a.linkedTradingAccountId ? ' · auto from trading journal' : ''}</span>
            <input type="number" step="any" name="${a.id}" value="${a.linkedTradingAccountId ? Math.round(prior.byAcct[a.id] * 100) / 100 : v}" ${a.linkedTradingAccountId ? raw('disabled') : ''} ${k === 'liability' ? raw('min="0" placeholder="amount owed"') : ''}></label>`;
        })}</div></fieldset>`;
      })}
      <div class="calc-preview" id="pv"></div>
      <div class="form-actions">${existing ? html`<button type="button" class="btn danger" data-del>Delete snapshot</button>` : ''}<button class="btn primary">Save snapshot</button></div>
    </form>`}
    ${snaps.length ? html`<div class="card mt" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><h2>Snapshot history</h2><span class="hint">${snaps.length}</span></div><div class="table-wrap" style="border:0;max-height:360px"><table class="data compact"><thead><tr><th>Date</th><th class="num">Assets</th><th class="num">Liabilities</th><th class="num">Net worth</th><th></th></tr></thead>
      <tbody>${snaps.map(s => { const pt = pointAt(s.date); return html`<tr><td>${fmtDate(s.date)}</td><td class="num">${money(pt.assets)}</td><td class="num">${money(pt.liabilities)}</td><td class="num"><b>${money(pt.net)}</b></td><td><a href="#/networth/update?date=${s.date}">Edit</a></td></tr>`; })}</tbody></table></div></div>` : ''}`);
  wireDemo(el);
  el.querySelector('#sd').onchange = e => e.target.value && go('/networth/update?date=' + e.target.value);
  const form = el.querySelector('#uf');
  if (!form) return;
  const pv = () => {
    let as = 0, li = 0;
    for (const a of accts) { const inp = form.elements[a.id]; const v = +inp.value || 0; if (a.kind === 'liability') li += v; else as += v; }
    el.querySelector('#pv').innerHTML = String(html`<span>Assets <b>${money(as)}</b></span><span>Liabilities <b>${money(li)}</b></span><span>Net worth <b>${money(as - li)}</b></span><span>vs. previous <b class="${pnlClass(as - li - prior.net)}">${money(as - li - prior.net, { sign: true })}</b></span>`);
  };
  form.addEventListener('input', pv); pv();
  form.onsubmit = async e => {
    e.preventDefault();
    const balances = {};
    for (const a of accts) if (!a.linkedTradingAccountId) { const v = form.elements[a.id].value; if (v !== '') balances[a.id] = a.kind === 'liability' ? Math.abs(+v) : +v; }
    await store.put('nwSnapshots', { ...(existing || {}), date, balances: { ...(existing?.balances || {}), ...balances } });
    toast('Snapshot saved'); go('/networth');
  };
  el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmDlg('Delete snapshot?', `Delete the snapshot for ${fmtDate(date)}?`))) return;
    await store.del('nwSnapshots', existing.id); toast('Snapshot deleted'); go('/networth/update');
  });
}

// ================= accounts =================
async function editAccount(a = { kind: 'asset', category: 'cash' }) {
  const tAccts = store.all('tAccounts');
  const catOpts = kind => (kind === 'liability' ? LIAB_CATS : ASSET_CATS).map(c => html`<option value="${c.id}" ${a.category === c.id ? raw('selected') : ''}>${c.label}</option>`);
  const res = await modal({
    title: a.id ? `Edit ${a.name}` : 'Add account', wide: true,
    body: String(html`<form id="nf" class="form-grid">
      <label class="field">Type<select name="kind"><option value="asset">Asset (you own)</option><option value="liability" ${a.kind === 'liability' ? raw('selected') : ''}>Liability (you owe)</option></select></label>
      <label class="field">Category<select name="category">${catOpts(a.kind)}</select></label>
      <label class="field span2">Name<input name="name" required value="${a.name || ''}" placeholder="e.g. Chase checking, Vanguard 401k, Home"></label>
      <label class="field">Institution<input name="institution" value="${a.institution || ''}"></label>
      ${!a.id ? html`<label class="field">Current balance<input name="balance" type="number" step="any" placeholder="${a.kind === 'liability' ? 'amount owed' : ''}"></label>` : ''}
      <div class="lia full form-grid" style="padding:0">
        <label class="field">Interest rate (APR %)<input name="rate" type="number" step="any" min="0" value="${a.rate ?? ''}"></label>
        <label class="field">Monthly payment<input name="payment" type="number" step="any" min="0" value="${a.payment ?? ''}"></label>
      </div>
      <div class="ast full form-grid" style="padding:0">
        <label class="field">Liquid?<select name="liquid"><option value="">Auto (by category)</option><option value="yes" ${a.liquid === true ? raw('selected') : ''}>Yes</option><option value="no" ${a.liquid === false ? raw('selected') : ''}>No</option></select></label>
        <label class="field">Counts toward FI?<select name="investable"><option value="">Auto (by category)</option><option value="yes" ${a.investable === true ? raw('selected') : ''}>Yes</option><option value="no" ${a.investable === false ? raw('selected') : ''}>No</option></select></label>
        ${tAccts.length ? html`<label class="field span2">Link to trading account <span class="hint">balance follows the journal</span><select name="linkedTradingAccountId"><option value="">— not linked —</option>${tAccts.map(t => html`<option value="${t.id}" ${a.linkedTradingAccountId === t.id ? raw('selected') : ''}>${t.name}</option>`)}</select></label>` : ''}
      </div>
      <label class="field full">Notes<input name="notes" value="${a.notes || ''}"></label>
    </form>`),
    onMount: w => {
      const f = w.querySelector('#nf');
      const sync = () => { const li = f.kind.value === 'liability'; w.querySelector('.lia').hidden = !li; w.querySelector('.ast').hidden = li; };
      f.kind.onchange = () => { f.category.innerHTML = String(html`${(f.kind.value === 'liability' ? LIAB_CATS : ASSET_CATS).map(c => html`<option value="${c.id}">${c.label}</option>`)}`); sync(); };
      sync();
    },
    actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', value: w => { const f = w.querySelector('#nf'); if (!f.name.value.trim()) { toast('Name is required', 'error'); return false; } return formData(f); } }],
  });
  if (!res || typeof res !== 'object') return null;
  const yn = v => (v === 'yes' ? true : v === 'no' ? false : null);
  const obj = { ...a, kind: res.kind, category: res.category, name: res.name.trim(), institution: res.institution, notes: res.notes,
    rate: toNum(res.rate), payment: toNum(res.payment), liquid: yn(res.liquid), investable: yn(res.investable), linkedTradingAccountId: res.kind === 'liability' ? '' : res.linkedTradingAccountId || '' };
  const saved = await store.put('nwAccounts', obj);
  if (!a.id && res.balance !== '' && res.balance != null) {
    const d = today();
    const snap = store.all('nwSnapshots').find(s => s.date === d);
    await store.put('nwSnapshots', { ...(snap || { date: d }), balances: { ...(snap?.balances || {}), [saved.id]: Math.abs(+res.balance) } });
  }
  return saved;
}

export async function accounts(el, _p, { mode }) {
  const pro = mode === 'pro';
  const accts = store.all('nwAccounts');
  const cur = pointAt(today());
  const sec = (title, list) => html`<div class="card mt" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><h2>${title}</h2><span class="hint">${money(list.filter(a => !a.archivedAt).reduce((s, a) => s + (cur.byAcct[a.id] || 0), 0))}</span></div>
    <div class="table-wrap" style="border:0"><table class="data"><thead><tr><th>Name</th><th>Category</th><th>Institution</th>${pro ? raw('<th>Details</th>') : ''}<th class="num">Latest balance</th><th></th></tr></thead><tbody>
    ${list.map(a => html`<tr ${a.archivedAt ? raw('style="opacity:.55"') : ''}><td><b>${a.name}</b>${a.archivedAt ? html` <span class="tag">closed ${fmtDate(a.archivedAt)}</span>` : ''}${a.linkedTradingAccountId ? html` <span class="tag accent">linked to journal</span>` : ''}</td><td>${catLabel(a.category)}</td><td>${a.institution || ''}</td>
      ${pro ? html`<td class="small muted">${a.kind === 'liability' ? [a.rate ? `${a.rate}% APR` : '', a.payment ? `${money(a.payment)}/mo` : ''].filter(Boolean).join(' · ') : [isLiquid(a) ? 'liquid' : 'illiquid', isInvestable(a) ? 'counts toward FI' : ''].filter(Boolean).join(' · ')}</td>` : ''}
      <td class="num">${money(cur.byAcct[a.id] || 0)}</td>
      <td style="text-align:right;white-space:nowrap"><button class="btn sm" data-edit="${a.id}">Edit</button> <button class="btn sm" data-arch="${a.id}">${a.archivedAt ? 'Reopen' : 'Close'}</button> <button class="icon-btn" data-del="${a.id}" aria-label="Delete">✕</button></td></tr>`)}
    </tbody></table></div></div>`;
  const assets = accts.filter(a => a.kind !== 'liability').sort((a, b) => !!a.archivedAt - !!b.archivedAt || a.name.localeCompare(b.name));
  const liabs = accts.filter(a => a.kind === 'liability').sort((a, b) => !!a.archivedAt - !!b.archivedAt || a.name.localeCompare(b.name));
  el.innerHTML = String(html`<div class="page-head"><div><h1>Assets & debts</h1><div class="sub">Everything you own and owe. Closing an account (sold, paid off) keeps its history.</div></div>
    <div class="actions"><button class="btn" data-new-l>+ Add debt</button><button class="btn primary" data-new>+ Add asset</button></div></div>
    ${!accts.length ? html`<div class="empty"><div class="empty-title">No accounts yet</div><p>Typical list: checking, savings, brokerage, retirement, crypto, home, car — and mortgage, car loan, credit cards.</p><button class="btn primary" data-new>+ Add asset</button><button class="btn" data-new-l>+ Add debt</button><button class="btn" data-demo>Load demo data</button></div>` : ''}
    ${assets.length ? sec('Assets', assets) : ''}${liabs.length ? sec('Liabilities', liabs) : ''}`);
  wireDemo(el);
  el.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.new !== undefined) { if (await editAccount()) refresh(); }
    else if (b.dataset.newL !== undefined) { if (await editAccount({ kind: 'liability', category: 'mortgage' })) refresh(); }
    else if (b.dataset.edit) { if (await editAccount(store.get('nwAccounts', b.dataset.edit))) refresh(); }
    else if (b.dataset.arch) {
      const a = store.get('nwAccounts', b.dataset.arch);
      if (a.archivedAt) { await store.put('nwAccounts', { ...a, archivedAt: null }); refresh(); return; }
      const d = await modal({ title: `Close ${a.name}`, body: String(html`<p class="small muted">From this date on the account counts as zero (sold, paid off, closed). History before it is kept.</p><label class="field">Closed on<input type="date" name="d" value="${today()}"></label>`), actions: [{ label: 'Cancel' }, { label: 'Close account', kind: 'primary', value: w => w.querySelector('[name=d]').value || false }] });
      if (d && d !== 'Cancel') { await store.put('nwAccounts', { ...a, archivedAt: d }); refresh(); }
    } else if (b.dataset.del) {
      const a = store.get('nwAccounts', b.dataset.del);
      if (!(await confirmDlg('Delete account?', `Delete ${a.name} and its balance history? To keep history, use Close instead.`))) return;
      for (const s of store.all('nwSnapshots')) if (s.balances && a.id in s.balances) { const nb = { ...s.balances }; delete nb[a.id]; await store.put('nwSnapshots', { ...s, balances: nb }); }
      await store.del('nwAccounts', a.id); refresh();
    }
  });
}

// ================= cash flow =================
export async function cashflow(el) {
  const months = cashflowMonths();
  const t12 = trailing(months), t3 = trailing(months, 3);
  const cm = monthKey(new Date());
  el.innerHTML = String(html`<div class="page-head"><div><h1>Cash flow</h1><div class="sub">Monthly income and spending. Drives savings rate, emergency-fund months, FI number and the savings-vs-market split.</div></div></div>
    <div class="grid g-1-2">
      <form class="card" id="cf"><div class="card-head"><h2>Log a month</h2></div><div class="form-grid" style="grid-template-columns:1fr 1fr">
        <label class="field full">Month<input type="month" name="id" value="${cm}" required></label>
        <label class="field">Income <span class="hint">take-home</span><input name="income" type="number" step="any" min="0" required></label>
        <label class="field">Expenses <span class="hint">all spending</span><input name="expenses" type="number" step="any" min="0" required></label>
        <label class="field full">Note<input name="note" placeholder="bonus, big purchase…"></label></div>
        <p class="small muted mt">Tip: income = net pay + trading withdrawals + other income. Money moved into investments is savings, not an expense.</p>
        <div class="row"><span class="spacer"></span><button class="btn primary">Save month</button></div></form>
      <div class="stack">
        <div class="stats">
          ${stat('Savings rate (12m)', pct(t12.rate, 1), { cls: pnlClass(t12.rate) })}
          ${stat('Savings rate (3m)', pct(t3.rate, 1), { cls: pnlClass(t3.rate) })}
          ${stat('Avg monthly income', money(t12.avgIncome))}
          ${stat('Avg monthly expenses', money(t12.avgExpenses))}
          ${stat('Saved (12m)', money(t12.savings, { sign: true }), { cls: pnlClass(t12.savings) })}
        </div>
        <div class="card"><div class="card-head"><h2>Income vs expenses</h2></div><div class="chart"><canvas id="c-ie"></canvas></div></div>
      </div>
    </div>
    ${months.length ? html`<div class="grid g2 mt"><div class="card"><div class="card-head"><h2>Savings rate</h2><span class="hint">monthly</span></div><div class="chart short"><canvas id="c-sr"></canvas></div></div>
      <div class="card" style="padding:0"><div class="table-wrap" style="border:0;max-height:260px"><table class="data compact"><thead><tr><th>Month</th><th class="num">Income</th><th class="num">Expenses</th><th class="num">Saved</th><th class="num">Rate</th><th></th></tr></thead>
      <tbody>${[...months].reverse().map(m => html`<tr><td>${fmtMonth(m.id)}${m.note ? html` <span class="muted small">${m.note}</span>` : ''}</td><td class="num">${money(m.income)}</td><td class="num">${money(m.expenses)}</td><td class="num ${pnlClass(m.savings)}">${money(m.savings, { sign: true })}</td><td class="num">${pct(m.rate, 0)}</td><td><button class="btn sm" data-edit="${m.id}">Edit</button> <button class="icon-btn" data-del="${m.id}" aria-label="Delete">✕</button></td></tr>`)}</tbody></table></div></div></div>` : ''}`);
  const form = el.querySelector('#cf');
  form.onsubmit = async e => {
    e.preventDefault();
    const f = formData(form);
    await store.put('nwCashflow', { ...(store.get('nwCashflow', f.id) || {}), id: f.id, income: +f.income, expenses: +f.expenses, note: f.note });
    toast(`${fmtMonth(f.id)} saved`); refresh();
  };
  el.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (b?.dataset.edit) { const m = store.get('nwCashflow', b.dataset.edit); form.id.value = m.id; form.income.value = m.income; form.expenses.value = m.expenses; form.note.value = m.note || ''; form.income.focus(); }
    if (b?.dataset.del) { if (await confirmDlg('Delete month?', `Delete ${fmtMonth(b.dataset.del)}?`)) { await store.del('nwCashflow', b.dataset.del); refresh(); } }
  });
  const p = C.palette();
  const last = months.slice(-24);
  const labels = last.map(m => fmtMonth(m.id));
  C.make(el.querySelector('#c-ie'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Income', data: last.map(m => m.income), backgroundColor: p.series[0], maxBarThickness: 16 }, { label: 'Expenses', data: last.map(m => m.expenses), backgroundColor: p.series[1], maxBarThickness: 16 }] },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${money(c.parsed.y)}`, footer: it => `Saved: ${money(last[it[0].dataIndex].savings, { sign: true })}` } } }, scales: { x: C.plainAxis({ ticks: { maxRotation: 0, autoSkipPadding: 10 } }), y: C.moneyAxis({ beginAtZero: true }) } },
  });
  if (months.length) C.signBars(el.querySelector('#c-sr'), { labels, values: last.map(m => (m.rate ?? 0) * 100), fmt: v => num(v, 0) + '%', axisFmt: v => v + '%' });
}

// ================= FI planning =================
export async function plan(el) {
  const s = store.getSettings();
  const series = nwSeries();
  const cur = series.at(-1) || pointAt(today());
  const fi = fiMetrics(cur.investable);
  const pl = s.plan;
  const assetCats = ASSET_CATS.filter(c => (cur.byCat[c.id] || 0) > 0 || +pl.targetAllocation?.[c.id]);
  const targetSum = assetCats.reduce((a, c) => a + (+pl.targetAllocation?.[c.id] || 0), 0);

  el.innerHTML = String(html`<div class="page-head"><div><h1>Financial independence</h1><div class="sub">How far your investable assets are from covering your spending forever — in today's money.</div></div></div>
    <div class="stats big">
      ${stat('FI number', money(fi.fiNumber), { sub: `${money(fi.annualExpenses)}/yr ÷ ${fi.withdrawalRate}%`, help: 'Annual expenses ÷ safe withdrawal rate. The classic 4% rule gives 25× annual spending.' })}
      ${stat('Investable assets', money(cur.investable), { sub: pct(fi.progress, 1) + ' of FI number' })}
      ${stat('Years to FI', fi.yearsToFI == null ? (fi.fiNumber ? '100+' : '—') : fi.yearsToFI === 0 ? 'Reached 🎉' : num(fi.yearsToFI, 1), { sub: fi.fiAge ? `at age ${num(fi.fiAge, 0)}` : '' })}
      ${stat('Coast FI', money(fi.coastNumber), { cls: fi.coastReached ? 'pos' : '', sub: fi.coastNumber ? (fi.coastReached ? 'reached — growth alone gets you there by ' + pl.retirementAge : `needed now to coast to FI by ${pl.retirementAge}`) : '', help: 'Amount that, left alone at the expected real return, grows to your FI number by your target retirement age.' })}
    </div>
    <div class="card mt"><div class="stat-label">Progress to FI</div><div class="progress mt"><span style="width:${Math.min(100, (fi.progress || 0) * 100)}%"></span></div>
      <div class="row small muted mt"><span>${money(cur.investable)}</span><span class="spacer"></span>${fi.coastNumber && fi.fiNumber ? html`<span>Coast FI at ${pct(fi.coastNumber / fi.fiNumber, 0)}</span><span class="spacer"></span>` : ''}<span>${money(fi.fiNumber)}</span></div></div>
    <div class="grid g-2-1 mt">
      <div class="card"><div class="card-head"><h2>Projection</h2><span class="hint">investable assets, real terms, ${pct(fi.realReturn, 1)} real return + ${money(fi.monthlyContribution)}/mo</span></div><div class="chart tall"><canvas id="p-proj"></canvas></div></div>
      <form class="card" id="pf"><div class="card-head"><h2>Assumptions</h2></div><div class="form-grid" style="grid-template-columns:1fr 1fr">
        <label class="field">Current age<input name="currentAge" type="number" min="0" max="120" value="${pl.currentAge}"></label>
        <label class="field">Target retirement age<input name="retirementAge" type="number" min="0" max="120" value="${pl.retirementAge}"></label>
        <label class="field full">Annual expenses in retirement <span class="hint">${fi.derivedExpenses ? `blank = from cash flow (${money(fi.annualExpenses)})` : ''}</span><input name="annualExpenses" type="number" step="any" min="0" value="${+pl.annualExpenses || ''}"></label>
        <label class="field full">Monthly investing <span class="hint">${fi.derivedContribution ? `blank = avg savings (${money(fi.monthlyContribution)})` : ''}</span><input name="monthlyContribution" type="number" step="any" min="0" value="${+pl.monthlyContribution || ''}"></label>
        <label class="field">Withdrawal rate %<input name="withdrawalRate" type="number" step="0.1" min="0.5" max="10" value="${pl.withdrawalRate}"></label>
        <label class="field">Expected return %<input name="expectedReturn" type="number" step="0.1" value="${pl.expectedReturn}"></label>
        <label class="field">Inflation %<input name="inflation" type="number" step="0.1" value="${pl.inflation}"></label>
        <label class="field">Emergency fund target (months)<input name="emergencyMonths" type="number" step="1" min="0" value="${pl.emergencyMonths}"></label>
      </div><div class="row mt"><span class="spacer"></span><button class="btn primary">Recalculate</button></div></form>
    </div>
    <div class="grid g2 mt">
      <form class="card" id="tf"><div class="card-head"><h2>Target allocation</h2><span class="hint ${Math.abs(targetSum - 100) > 0.01 && targetSum ? 'neg' : ''}">total ${num(targetSum, 0)}%</span></div>
        ${assetCats.length ? html`<table class="data compact"><thead><tr><th>Category</th><th class="num">Current</th><th class="num">Target %</th><th class="num">Drift</th><th class="num">To rebalance</th></tr></thead><tbody>
        ${assetCats.map(c => { const curPct = cur.assets ? (cur.byCat[c.id] || 0) / cur.assets : 0; const tg = +pl.targetAllocation?.[c.id] || 0; const drift = tg ? curPct - tg / 100 : null; const reb = tg ? (tg / 100) * cur.assets - (cur.byCat[c.id] || 0) : null;
          return html`<tr><td><span class="dot" style="background:${catColor(c.id, C.palette())}"></span>${c.label}</td><td class="num">${pct(curPct, 1)}</td><td class="num"><input name="${c.id}" type="number" min="0" max="100" step="1" value="${tg || ''}" style="width:70px;text-align:right"></td><td class="num ${drift != null && Math.abs(drift) > 0.05 ? 'neg' : ''}">${drift == null ? '—' : pct(drift, 1, { sign: true })}</td><td class="num">${reb == null ? '—' : money(reb, { sign: true })}</td></tr>`; })}
        </tbody></table><div class="row mt"><span class="small muted">Drift beyond ±5 points is highlighted.</span><span class="spacer"></span><button class="btn primary">Save targets</button></div>` : html`<p class="muted">Add assets first.</p>`}
      </form>
      <div class="card"><div class="card-head"><h2>Current vs target</h2></div><div class="chart"><canvas id="p-alloc"></canvas></div></div>
    </div>`);

  el.querySelector('#pf').onsubmit = async e => {
    e.preventDefault();
    const f = formData(e.target);
    const n = k => (f[k] === '' ? 0 : +f[k]);
    await store.saveSettings({ plan: { currentAge: n('currentAge'), retirementAge: n('retirementAge'), annualExpenses: n('annualExpenses'), monthlyContribution: n('monthlyContribution'), withdrawalRate: n('withdrawalRate') || 4, expectedReturn: n('expectedReturn'), inflation: n('inflation'), emergencyMonths: n('emergencyMonths') } });
    toast('Assumptions saved'); refresh();
  };
  el.querySelector('#tf').onsubmit = async e => {
    e.preventDefault();
    const f = formData(e.target);
    const ta = {};
    for (const [k, v] of Object.entries(f)) if (v !== '') ta[k] = +v;
    // replace (not merge) so cleared targets disappear
    const plan = { ...store.getSettings().plan, targetAllocation: ta };
    await store.saveSettings({ plan: { ...plan, targetAllocation: null } });
    await store.saveSettings({ plan });
    toast('Targets saved'); refresh();
  };

  const p = C.palette();
  const years = Math.max(10, Math.min(50, fi.yearsToFI != null ? Math.ceil(fi.yearsToFI) + 5 : 40));
  const pr = projection(cur.investable, years);
  C.moneyLine(el.querySelector('#p-proj'), {
    labels: pr.map(x => `Age ${num(x.age, 0)}`),
    series: [{ label: 'Projected investable assets', data: pr.map(x => x.value), color: p.series[0], fill: true }, ...(fi.fiNumber ? [{ label: 'FI number', data: pr.map(() => fi.fiNumber), color: p.series[2], dash: [] }] : [])],
  });
  if (assetCats.length) C.make(el.querySelector('#p-alloc'), {
    type: 'bar',
    data: { labels: assetCats.map(c => c.label), datasets: [{ label: 'Current', data: assetCats.map(c => (cur.assets ? (cur.byCat[c.id] || 0) / cur.assets : 0) * 100), backgroundColor: p.series[0], maxBarThickness: 14 }, { label: 'Target', data: assetCats.map(c => +pl.targetAllocation?.[c.id] || 0), backgroundColor: p.neutral, maxBarThickness: 14 }] },
    options: { indexAxis: 'y', plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${num(c.parsed.x, 1)}%` } } }, scales: { x: { grid: { color: p.grid }, border: { display: false }, ticks: { callback: v => v + '%' } }, y: C.plainAxis({ ticks: { autoSkip: false } }) } },
  });
}
