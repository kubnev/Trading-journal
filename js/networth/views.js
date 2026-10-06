import * as store from '../store.js';
import { html, raw, money, pct, num, pnlClass, stat, fmtDate, fmtMonth, today, modal, toast, confirmDlg, formData, toNum, monthKey, parseDay, dayKey, estTag } from '../ui.js';
import * as C from '../charts.js';
import { ASSET_CATS, LIAB_CATS, catLabel, assetCats, liabCats, GROUPS, DEBT, groupOf, groupInfo, simpleMode, typeLabel, isLiquid, nwSeries, pointAt, baseline, yearAgoEstimate, changes, debtMetrics, interestOverview, interestEarned, apyAt, grow, catKey, CUSTODY, custodyOf, custodyLabel, PURPOSES, purposeOf, TIERS, yieldSummary, liveValue, positions, concentration } from './calc.js';
import { loadDemo } from '../demo.js';
import { toDisplay, ccyOf, moneyIn, ccySelect, displayCcy, sameMoney } from '../fx.js';
import { updateAllPrices, summaryText, holdingsTotal, holdingValue, syncHoldingsSnapshot, normSymbol } from './prices.js';
import { go, refresh, query } from '../main.js';

const RANGES = [['all', 'All'], ['1y', '1Y'], ['3y', '3Y'], ['5y', '5Y']];
let nativeFirst = (() => { try { return localStorage.getItem('tj.nativeFirst') === '1'; } catch { return false; } })();
let range = 'all';
const catColor = (id, p) => { const i = assetCats().findIndex(c => c.id === id); return i >= 0 ? p.series[i % 8] : p.series[(liabCats().findIndex(c => c.id === id) + 2) % 8]; };
// Categories beyond 8 share hues, so allocation charts fold small ones into "Other" (max 7 slices)
function emptyNW() {
  return html`<div class="empty"><div class="empty-title">Start tracking your net worth</div><p>Add what you own (cash, investments, property) and what you owe (mortgage, loans, cards). Then update balances once a month — that's all it takes to build a history.</p>
    <a class="btn primary" href="#/networth/accounts">+ Add accounts</a><button class="btn" data-demo>Load demo data</button></div>`;
}
const hasHoldings = () => store.all('nwAccounts').some(a => a.tracksHoldings && !a.archivedAt && (a.holdings || []).length);
function ago(iso) {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}
const priceBtn = () => (hasHoldings() ? html`<button class="btn" data-prices title="Fetch live crypto / stock prices for your holdings. Last update: ${ago(store.getSettings().priceApi?.lastUpdate)}">↻ Update prices</button>` : '');
function wirePrices(el) {
  el.querySelectorAll('[data-prices]').forEach(b => b.onclick = async () => {
    const label = b.textContent;
    b.disabled = true; b.textContent = 'Updating…';
    try {
      const r = await updateAllPrices();
      toast(summaryText(r), r.updated ? 'info' : 'error');
      if (r.updated) refresh();
    } catch (e) { toast('Price update failed: ' + e.message, 'error'); }
    finally { b.disabled = false; b.textContent = label; }
  });
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

// ================= live yield ticker =================
// enough decimals that the counter visibly moves every second
const tickDecimals = perSecond => Math.max(2, Math.min(7, Math.ceil(-Math.log10(perSecond || 1e-2)) + 1));
export function yieldCard() {
  const y = yieldSummary();
  if (!y.accts.length) return '';
  return html`<div class="card ticker-card" data-ticker>
    <div class="row"><div><div class="stat-label">Earned today from yields</div><div class="stat-value ticker pos" data-earned>${money(y.earnedToday, { decimals: tickDecimals(y.perSecond) })}</div></div><span class="spacer"></span>
      <dl class="kv cols2 small" style="min-width:min(420px,100%)"><dt>Per day</dt><dd>${money(y.perDay, { decimals: 2 })}</dd><dt>Per month</dt><dd>${money(y.perMonth)}</dd><dt>Per year</dt><dd>${money(y.perYear)}</dd><dt>Blended APY</dt><dd>${pct(y.blendedApy, 2)}</dd></dl></div>
    <div class="small muted mt">${y.accts.length} yield account${y.accts.length > 1 ? 's' : ''} (${y.accts.map(a => `${a.name} ${a.apy}%`).join(', ')}) · balances grow daily from your last update, compounding at the stated APY.</div></div>`;
}
export function startTicker(root) {
  if (!yieldSummary().accts.length) return null;
  return setInterval(() => { const el = root.querySelector('[data-earned]'); if (el) { const y = yieldSummary(); el.textContent = money(y.earnedToday, { decimals: tickDecimals(y.perSecond) }); } }, 1000);
}

// Net worth by type as bars — used when there's only one balance update, so there's no trend to draw yet
export function typeBreakdown(cur) {
  const p = C.palette();
  const debtCats = liabCats();
  const cats = [...assetCats(), ...debtCats].filter(c => (cur.byCat[c.id] || 0) > 0);
  return html`<div class="breakdown">${cats.map(c => { const v = cur.byCat[c.id], debt = debtCats.includes(c), share = cur.assets ? v / cur.assets : 0, col = catColor(c.id, p);
    return html`<div class="bd-row"><span class="bd-label"><span class="dot" style="background:${col}"></span>${c.label}</span><span class="bd-bar"><span style="width:${Math.min(100, share * 100)}%;background:${col}"></span></span><b class="${debt ? 'neg' : ''}">${money(debt ? -v : v)}</b><span class="muted small bd-pct">${debt ? '' : pct(share, 1)}</span></div>`; })}</div>`;
}

// Interest summary card — fills the slot the debt chart uses when there are no debts
function interestMini(io) {
  return html`<div class="card"><div class="card-head"><h2>Interest</h2><a class="hint" href="#/networth/interest">Details →</a></div>
    ${io.earn.length ? html`<div class="stat-value pos">${money(io.earnMonth)} <span class="small muted" style="font-family:var(--font-sans);font-weight:400">/ month</span></div>
      <div class="stat-sub">${pct(io.blended, 2)} blended on ${money(io.earnValue, { compact: true })} · ${money(io.earnYear)} / year</div>
      <dl class="kv small mt">${io.earn.slice(0, 4).map(x => html`<dt>${x.a.name} <span class="muted">${num(x.apy, 2)}%</span></dt><dd>${money(x.perMonth)} / mo</dd>`)}</dl>
      ${io.idleValue > 0 ? html`<p class="small muted" style="margin:10px 0 0">${money(io.idleValue, { compact: true })} in cash & savings earns nothing.</p>` : ''}`
      : html`<p class="small muted">No account has an interest rate yet. Set an APY on savings (Accounts → Edit) and its balance grows daily; this card shows what it earns.</p>`}
    <p class="small muted" style="margin:10px 0 0">No debts recorded.</p></div>`;
}

// ================= overview =================
export async function overview(el) {
  const accts = store.all('nwAccounts');
  const allSeries = nwSeries();
  el.innerHTML = String(html`<div class="page-head"><div><h1>Net worth</h1><div class="sub">${allSeries.length ? `Last updated ${fmtDate(lastUpdate() || allSeries.at(-1).date)}` : 'Everything you own minus everything you owe.'}</div></div>
    <div class="actions">${allSeries.length > 2 ? html`<div class="seg" id="rng">${RANGES.map(([k, l]) => html`<button data-r="${k}" class="${range === k ? 'on' : ''}">${l}</button>`)}</div>` : ''}${priceBtn()}<a class="btn primary" href="#/networth/update">Update balances</a></div></div><div id="body"></div>`);
  wirePrices(el);
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
    const base = baseline();
    const yaEst = !yearAgo ? yearAgoEstimate() : null;
    const yoy = yearAgo ? cur.net - yearAgo.net : yaEst != null ? cur.net - yaEst : null, yoyBase = yearAgo ? yearAgo.net : yaEst;
    const debt = debtMetrics(cur);
    const efMonths = base.avgExpenses ? ((cur.byCat.cash || 0) + (cur.byCat.savings || 0)) / base.avgExpenses : null;
    const io = interestOverview();
    const p = C.palette();
    const aCats = assetCats().filter(c => (cur.byCat[c.id] || 0) > 0);
    const lCats = liabCats().filter(c => (cur.byCat[c.id] || 0) > 0);
    const liquidShare = cur.assets ? cur.liquid / cur.assets : null;
    const chg = changes(series);
    const one = series.length < 2;
    const multiCcy = accts.some(a => !a.archivedAt && !sameMoney(ccyOf(a), displayCcy()));
    // converted to the display currency, with the account's own currency underneath (or the other way round)
    const balCell = (a, v, nat) => { const sg = a.kind === 'liability' ? -1 : 1; if (sameMoney(ccyOf(a), displayCcy())) return money(sg * v); const conv = money(sg * v), own = moneyIn(sg * nat, ccyOf(a)); return nativeFirst ? html`${own}<div class="dist">≈ ${conv}</div>` : html`${conv}<div class="dist">${own}</div>`; };

    body.innerHTML = String(html`
      <div class="stats big">
        ${stat('Net worth', money(cur.net), { sub: ch != null ? html`<span class="${pnlClass(ch)}">${money(ch, { sign: true })}</span> since ${fmtDate(prev.date, { month: 'short', day: 'numeric' })}` : 'first balance update' })}
        ${stat(range === 'all' ? 'Change since you started' : `Change (${range.toUpperCase()})`, chRange != null ? money(chRange, { sign: true }) : '—', { cls: pnlClass(chRange), sub: chRange != null ? (first.net > 0 ? `${pct(chRange / Math.abs(first.net), 1, { sign: true })} since ${fmtDate(first.date, { month: 'short', year: 'numeric' })}` : `since ${fmtDate(first.date, { month: 'short', year: 'numeric' })}`) : 'shows after your next balance update' })}
        ${stat('Total assets', money(cur.assets), { sub: `${accts.filter(a => a.kind !== 'liability' && !a.archivedAt).length} accounts` })}
        ${stat('Total debts', money(cur.liabilities), { cls: cur.liabilities ? 'neg' : '', sub: `${accts.filter(a => a.kind === 'liability' && !a.archivedAt).length} debts` })}
      </div>
      ${yieldCard() ? html`<div class="mt">${yieldCard()}</div>` : ''}
      <div class="stats mt">
        ${stat('Liquid net worth', money(cur.liquidNet), { cls: pnlClass(cur.liquidNet), sub: 'reachable in days, minus debts', help: 'Liquid assets (cash, savings, brokerage, crypto, trading) minus all debts — what you could access in days.' })}
        ${stat(html`Past 12 months${estTag(!yearAgo && yaEst != null, 'the net worth you estimated for a year ago')}`, yoy != null ? money(yoy, { sign: true }) : '—', { cls: pnlClass(yoy), sub: yoyBase > 0 ? pct(yoy / yoyBase, 1, { sign: true }) : !yearAgo && yaEst == null ? 'after a year of history' : '' })}
        ${stat('Interest / month', money(io.earnMonth), { cls: io.earnMonth ? 'pos' : '', sub: io.earn.length ? html`${pct(io.blended, 2)} blended · <a href="#/networth/interest">details</a>` : html`<a href="#/networth/interest">add an APY</a>`, help: 'What your interest-bearing accounts earn per month at their current APY.' })}
        ${stat('Debt-to-asset', pct(cur.assets ? cur.liabilities / cur.assets : null, 1), { cls: cur.assets && cur.liabilities / cur.assets > 0.5 ? 'neg' : '', help: 'Debts ÷ assets. Above 50% leaves you exposed to downturns.' })}
        ${stat(html`Cash runway${estTag(base.estimated.spending)}`, efMonths != null ? `${num(efMonths, 1)} mo` : '—', { cls: efMonths != null && efMonths < 3 ? 'neg' : '', sub: efMonths != null ? 'cash & savings ÷ monthly spending' : html`log spending or add an <a href="#/setup">estimate</a>`, help: 'How many months your cash and savings would cover your usual monthly spending.' })}
      </div>
      <div class="grid g-2-1 mt">
        <div class="card"><div class="card-head"><h2>Net worth over time</h2><span class="hint">net worth, assets & debts</span></div>
          ${one ? html`<div class="first-snap">${typeBreakdown(cur)}<p class="muted small" style="margin:0">One balance update so far (${fmtDate(cur.date)}). Each update adds a point — update again next month and your trend line starts here. Assets by type and change per update appear then too. <a href="#/networth/update">Update balances →</a></p></div>` : html`<div class="chart tall"><canvas id="n-line"></canvas></div>`}</div>
        <div class="card"><div class="card-head"><h2>Asset allocation</h2><span class="hint">by type</span></div><div class="chart tall"><canvas id="n-alloc"></canvas></div></div>
      </div>
      ${one ? html`<div class="grid g2 mt">
        <div class="card"><div class="card-head"><h2>Liquidity</h2></div>
          <div class="stat-label">Liquid share of assets</div><div class="stat-value">${pct(liquidShare, 0)}</div>
          <div class="meter" style="height:10px"><span style="width:${(liquidShare || 0) * 100}%;background:${p.series[0]}"></span><span style="flex:1;background:${p.neutral}"></span></div>
          <div class="legend-inline mt"><span><i style="background:${p.series[0]}"></i>Liquid ${money(cur.liquid, { compact: true })}</span><span><i style="background:${p.neutral}"></i>Illiquid ${money(cur.assets - cur.liquid, { compact: true })}</span></div>
          <div class="stat-label mt">Earning interest</div><div class="stat-value">${money(io.earnValue)}</div>
          <div class="stat-sub">${pct(cur.assets ? io.earnValue / cur.assets : null, 0)} of assets${io.idleValue > 0 ? html` · ${money(io.idleValue, { compact: true })} in cash & savings earns nothing` : ''}</div>
          ${liquidShare != null && liquidShare < 0.15 ? html`<div class="callout warn mt"><span class="ic">!</span><div>Under 15% of your assets are liquid.</div></div>` : ''}
        </div>
        ${lCats.length ? html`<div class="card"><div class="card-head"><h2>Debt breakdown</h2><span class="hint">${debt.wRate != null ? `weighted APR ${num(debt.wRate, 2)}%` : ''}</span></div><div class="chart"><canvas id="n-debt"></canvas></div></div>`
                          : interestMini(io)}
      </div>` : html`
      <div class="grid g-2-1 mt">
        <div class="card"><div class="card-head"><h2>Assets by type</h2><span class="hint">stacked</span></div><div class="chart"><canvas id="n-stack"></canvas></div></div>
        <div class="card"><div class="card-head"><h2>Liquidity</h2></div>
          <div class="stat-label">Liquid share of assets</div><div class="stat-value">${pct(liquidShare, 0)}</div>
          <div class="meter" style="height:10px"><span style="width:${(liquidShare || 0) * 100}%;background:${p.series[0]}"></span><span style="flex:1;background:${p.neutral}"></span></div>
          <div class="legend-inline mt"><span><i style="background:${p.series[0]}"></i>Liquid ${money(cur.liquid, { compact: true })}</span><span><i style="background:${p.neutral}"></i>Illiquid ${money(cur.assets - cur.liquid, { compact: true })}</span></div>
          <div class="stat-label mt">Earning interest</div><div class="stat-value">${money(io.earnValue)}</div>
          <div class="stat-sub">${pct(cur.assets ? io.earnValue / cur.assets : null, 0)} of assets${io.idleValue > 0 ? html` · ${money(io.idleValue, { compact: true })} in cash & savings earns nothing` : ''}</div>
          ${liquidShare != null && liquidShare < 0.15 ? html`<div class="callout warn mt"><span class="ic">!</span><div>Under 15% of your assets are liquid.</div></div>` : ''}
        </div>
      </div>
      <div class="grid g2 mt">
        <div class="card"><div class="card-head"><h2>Change per update</h2><span class="hint">net worth change between balance updates</span></div><div class="chart"><canvas id="n-chg"></canvas></div></div>
        ${lCats.length ? html`<div class="card"><div class="card-head"><h2>Debt breakdown</h2><span class="hint">${debt.wRate != null ? `weighted APR ${num(debt.wRate, 2)}%` : ''}</span></div><div class="chart"><canvas id="n-debt"></canvas></div></div>`
                          : interestMini(io)}
      </div>`}
      <div class="card mt" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><h2>Accounts</h2><div class="row">${multiCcy ? html`<div class="seg sm" role="radiogroup" aria-label="Show balances in"><button data-native="0" class="${nativeFirst ? '' : 'on'}">${displayCcy()}</button><button data-native="1" class="${nativeFirst ? 'on' : ''}">Own currency</button></div>` : ''}<a class="hint" href="#/networth/accounts">Manage →</a></div></div>
        <div class="table-wrap" style="border:0"><table class="data"><thead><tr><th>Account</th><th>Type</th><th>Liquid</th><th class="num">Balance</th><th class="num">Change</th><th class="num">% of assets</th><th style="width:120px">Trend</th></tr></thead>
        <tbody>${accts.filter(a => !a.archivedAt).sort((a, b) => (a.kind === 'liability') - (b.kind === 'liability') || (cur.byAcct[b.id] || 0) - (cur.byAcct[a.id] || 0)).map(a => {
          const v = cur.byAcct[a.id] || 0, pv = prev ? prev.byAcct[a.id] || 0 : null;
          const d = pv == null ? null : (a.kind === 'liability' ? -(v - pv) : v - pv);
          return html`<tr><td><b>${a.name}</b>${a.institution ? html` <span class="muted small">${a.institution}</span>` : ''}</td><td>${typeLabel(a)}</td><td>${a.kind === 'liability' ? '' : isLiquid(a) ? 'Yes' : 'No'}</td>
            <td class="num ${a.kind === 'liability' ? 'neg' : ''}">${balCell(a, v, cur.byAcctNative[a.id] || 0)}</td><td class="num ${pnlClass(d)}">${d ? money(d, { sign: true }) : '—'}</td><td class="num">${a.kind === 'liability' ? '' : pct(cur.assets ? v / cur.assets : null, 1)}</td><td>${one ? '' : html`<div style="height:28px;width:110px"><canvas data-spark="${a.id}"></canvas></div>`}</td></tr>`;
        })}</tbody>
        <tfoot><tr><td colspan="3">Net worth</td><td class="num">${money(cur.net)}</td><td class="num ${pnlClass(ch)}">${ch != null ? money(ch, { sign: true }) : ''}</td><td colspan="2"></td></tr></tfoot></table></div></div>`);

    const labels = series.map(s => fmtDate(s.date, { month: 'short', year: '2-digit' }));
    if (!one) C.moneyLine(body.querySelector('#n-line'), {
      labels,
      series: [{ label: 'Net worth', data: series.map(s => s.net), color: p.series[0], fill: true }, { label: 'Assets', data: series.map(s => s.assets), color: p.series[2] }, { label: 'Debts', data: series.map(s => s.liabilities), color: p.series[1] }],
    });
    C.doughnut(body.querySelector('#n-alloc'), { labels: aCats.map(c => c.label), values: aCats.map(c => cur.byCat[c.id]), colors: aCats.map(c => catColor(c.id, p)), center: { value: money(cur.assets, { compact: true }), label: 'assets' } });
    if (!one) {
      const cats = assetCats().filter(c => series.some(s => (s.byCat[c.id] || 0) > 0));
      C.make(body.querySelector('#n-stack'), {
        type: 'line',
        data: { labels, datasets: cats.map(c => ({ label: c.label, data: series.map(s => s.byCat[c.id] || 0), borderColor: catColor(c.id, p), backgroundColor: C.alpha(catColor(c.id, p), 0.55), fill: true, borderWidth: 1, tension: 0.15, pointRadius: 0 })) },
        options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${money(c.parsed.y)}` } } }, scales: { x: C.plainAxis({ ticks: { maxTicksLimit: 8, maxRotation: 0 } }), y: { stacked: true, ...C.moneyAxis() } } },
      });
      C.signBars(body.querySelector('#n-chg'), { labels: chg.map(d => fmtDate(d.date, { month: 'short', year: '2-digit' })), values: chg.map(d => d.change) });
      body.querySelectorAll('[data-spark]').forEach(cv => { const id = cv.dataset.spark; const a = store.get('nwAccounts', id); C.sparkline(cv, series.map(s => s.byAcct[id] || 0), a.kind === 'liability' ? p.series[1] : p.series[0]); });
    }
    if (lCats.length) C.doughnut(body.querySelector('#n-debt'), { labels: lCats.map(c => c.label), values: lCats.map(c => cur.byCat[c.id]), colors: lCats.map(c => catColor(c.id, p)), center: { value: money(cur.liabilities, { compact: true }), label: 'owed' } });
  };
  draw();
  body.addEventListener('click', e => { const b = e.target.closest('[data-native]'); if (!b) return; nativeFirst = b.dataset.native === '1'; try { localStorage.setItem('tj.nativeFirst', nativeFirst ? '1' : '0'); } catch {} draw(); });
  let tick = startTicker(body);
  return () => clearInterval(tick);
}
// date of the latest real balance update (not the "today" point added for growing yields)
export const lastUpdate = () => store.all('nwSnapshots').map(s => s.date).filter(d => d <= today()).sort().at(-1) || null;

// ================= update balances =================
export async function update(el) {
  const accts = store.all('nwAccounts').filter(a => !a.archivedAt).sort((a, b) => (a.kind === 'liability') - (b.kind === 'liability') || a.name.localeCompare(b.name));
  const snaps = [...store.all('nwSnapshots')].sort((a, b) => b.date.localeCompare(a.date));
  const date = query().get('date') || today();
  const existing = snaps.find(s => s.date === date);
  const prior = pointAt(date);
  el.innerHTML = String(html`<div class="page-head"><div><h1>Update balances</h1><div class="sub">Record what each account is worth on a date. Monthly (e.g. first of the month) is the sweet spot.</div></div>
      <div class="actions">${priceBtn()}<label class="row small">Snapshot date <input type="date" id="sd" value="${date}"></label></div></div>
    ${!accts.length ? html`<div class="empty"><div class="empty-title">No accounts yet</div><p>Add your assets and debts first.</p><a class="btn primary" href="#/networth/accounts">+ Add accounts</a><button class="btn" data-demo>Load demo data</button></div>` : html`
    <form id="uf" class="stack">
      ${existing ? html`<div class="note">Editing the existing snapshot for ${fmtDate(date)}.</div>` : html`<div class="note">Fields are pre-filled with the latest known values — change only what moved.</div>`}
      ${[['asset', 'Assets'], ['liability', 'Liabilities']].map(([k, l]) => {
        const list = accts.filter(a => (a.kind === 'liability') === (k === 'liability'));
        if (!list.length) return '';
        return html`<fieldset><legend>${l}</legend><div class="form-grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${list.map(a => {
          const v = existing && a.id in (existing.balances || {}) ? existing.balances[a.id] : prior.byAcctNative[a.id] || '';
          return html`<label class="field">${a.name} <span class="hint">${ccyOf(a)} · ${typeLabel(a)}${a.tracksHoldings ? ' · from holdings × prices' : +a.apy ? ` · grows ${a.apy}% APY daily` : ''}</span>
            <input type="number" step="any" name="${a.id}" value="${a.tracksHoldings && date === today() ? Math.round(holdingsTotal(a) * 100) / 100 : v}" ${a.tracksHoldings ? raw('disabled') : ''} ${k === 'liability' ? raw('min="0" placeholder="amount owed"') : ''}></label>`;
        })}</div></fieldset>`;
      })}
      <div class="calc-preview" id="pv"></div>
      <div class="form-actions">${existing ? html`<button type="button" class="btn danger" data-del>Delete snapshot</button>` : ''}<button class="btn primary">Save snapshot</button></div>
    </form>`}
    ${snaps.length ? html`<div class="card mt" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><h2>Snapshot history</h2><span class="hint">${snaps.length}</span></div><div class="table-wrap" style="border:0;max-height:360px"><table class="data compact"><thead><tr><th>Date</th><th class="num">Assets</th><th class="num">Liabilities</th><th class="num">Net worth</th><th></th></tr></thead>
      <tbody>${snaps.map(s => { const pt = pointAt(s.date); return html`<tr><td>${fmtDate(s.date)}</td><td class="num">${money(pt.assets)}</td><td class="num">${money(pt.liabilities)}</td><td class="num"><b>${money(pt.net)}</b></td><td><a href="#/networth/update?date=${s.date}">Edit</a></td></tr>`; })}</tbody></table></div></div>` : ''}`);
  wireDemo(el);
  wirePrices(el);
  el.querySelector('#sd').onchange = e => e.target.value && go('/networth/update?date=' + e.target.value);
  const form = el.querySelector('#uf');
  if (!form) return;
  const pv = () => {
    let as = 0, li = 0;
    for (const a of accts) { const inp = form.elements[a.id]; const v = toDisplay(+inp.value || 0, ccyOf(a), date); if (a.kind === 'liability') li += v; else as += v; }
    el.querySelector('#pv').innerHTML = String(html`<span>Assets <b>${money(as)}</b></span><span>Liabilities <b>${money(li)}</b></span><span>Net worth <b>${money(as - li)}</b></span><span>vs. previous <b class="${pnlClass(as - li - prior.net)}">${money(as - li - prior.net, { sign: true })}</b></span>`);
  };
  form.addEventListener('input', pv); pv();
  form.onsubmit = async e => {
    e.preventDefault();
    const balances = {};
    for (const a of accts) if (!a.tracksHoldings) { const v = form.elements[a.id].value; if (v !== '') balances[a.id] = a.kind === 'liability' ? Math.abs(+v) : +v; }
    await store.put('nwSnapshots', { ...(existing || {}), date, balances: { ...(existing?.balances || {}), ...balances } });
    toast('Snapshot saved'); go('/networth');
  };
  el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmDlg('Delete snapshot?', `Delete the snapshot for ${fmtDate(date)}?`))) return;
    await store.del('nwSnapshots', existing.id); toast('Snapshot deleted'); go('/networth/update');
  });
}

// ================= accounts =================
// the standard buckets plus any custom ones already used on other accounts
const purposeChoices = a => [...new Set([...PURPOSES, ...store.all('nwAccounts').map(x => (x.purpose || '').trim()).filter(Boolean), ...(a.purpose ? [a.purpose] : [])])];
// Simple input: pick one of six types; everything else (custody, purpose, liquidity…) is automatic.
// today's value in the account's own currency (incl. yield growth since the last update)
const currentBalance = a => Math.round((pointAt(today()).byAcctNative[a.id] || 0) * 100) / 100;
const balField = a => html`<label class="field bal">${a.id ? 'Balance today' : 'Current balance'}${a.id ? html` <span class="hint">change it to record today's value — earlier history is kept</span>` : ''}<input name="balance" type="number" step="any" value="${a.id && !a.archivedAt ? currentBalance(a) : ''}" placeholder="${a.kind === 'liability' ? 'amount owed' : ''}" ${a.archivedAt ? raw('disabled') : ''}></label>`;

async function editAccountSimple(a) {
  const g0 = a.id ? groupOf(a) : a.kind === 'liability' ? 'debt' : 'cash';
  const types = [...GROUPS, DEBT];
  const res = await modal({
    title: a.id ? `Edit ${a.name}` : 'Add account',
    body: String(html`<form id="nf" class="form-grid">
      <div class="field full">What is it?
        <div class="type-pick" role="radiogroup">${types.map(t => html`<label class="type-opt"><input type="radio" name="group" value="${t.id}" ${t.id === g0 ? raw('checked') : ''}><span><b>${t.label}</b><small>${t.hint}</small></span></label>`)}</div></div>
      <label class="field span2">Name<input name="name" required value="${a.name || ''}" placeholder="e.g. Revolut, Savings account, Binance, Car"></label>
      <label class="field">Currency${raw(ccySelect('currency', a.currency || displayCcy()))}</label>
      ${balField(a)}
      <label class="field yld">Interest / yield (APY %) <span class="hint">optional</span><input name="apy" type="number" step="any" min="0" max="100" value="${a.apy ?? ''}" placeholder="e.g. 3.5"></label>
      <label class="field lia">Interest rate (APR %) <span class="hint">optional</span><input name="rate" type="number" step="any" min="0" value="${a.rate ?? ''}"></label>
      <label class="check full hld"><input type="checkbox" name="tracksHoldings" ${a.tracksHoldings ? raw('checked') : ''}> List what I hold (e.g. 0.5 BTC, 10 AAPL) and update prices automatically</label>
    </form>`),
    onMount: w => {
      const f = w.querySelector('#nf');
      const sync = () => {
        const g = f.group.value, show = (sel, on) => { const e = w.querySelector(sel); if (e) e.hidden = !on; };
        show('.yld', g !== 'debt' && g !== 'assets');
        show('.lia', g === 'debt');
        show('.hld', g === 'trading' || g === 'investments');
        const hl = f.tracksHoldings; if (w.querySelector('.hld').hidden) hl.checked = false;
        show('.bal', !hl.checked);
      };
      f.addEventListener('change', sync); sync();
    },
    actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', value: w => { const f = w.querySelector('#nf'); if (!f.name.value.trim()) { toast('Name is required', 'error'); return false; } return formData(f); } }],
  });
  if (!res || typeof res !== 'object') return null;
  const g = res.group, isDebt = g === 'debt';
  // keep the detailed (Pro) category and settings if the type didn't change — switching to Pro later restores them
  const same = a.id && groupOf(a) === g;
  const obj = { ...a, name: res.name.trim(), currency: res.currency || displayCcy(),
    kind: isDebt ? 'liability' : 'asset', category: same ? a.category : groupInfo(g).cat,
    apy: isDebt ? null : toNum(res.apy), rate: isDebt ? toNum(res.rate) : null,
    linkedTradingAccountId: '',
    tracksHoldings: (g === 'trading' || g === 'investments') && !!res.tracksHoldings, holdings: a.holdings || [] };
  if (!same) Object.assign(obj, { custody: '', purpose: '', liquid: null, payment: isDebt ? a.payment : null });
  return finishAccountSave(a, obj, res);
}

async function editAccount(a = { kind: 'asset', category: 'cash' }) {
  if (simpleMode()) return editAccountSimple(a);
  const catOpts = kind => (kind === 'liability' ? LIAB_CATS : ASSET_CATS).map(c => html`<option value="${c.id}" ${a.category === c.id ? raw('selected') : ''}>${c.label}</option>`);
  const res = await modal({
    title: a.id ? `Edit ${a.name}` : 'Add account', wide: true,
    body: String(html`<form id="nf" class="form-grid">
      <label class="field">Type<select name="kind"><option value="asset">Asset (you own)</option><option value="liability" ${a.kind === 'liability' ? raw('selected') : ''}>Liability (you owe)</option></select></label>
      <label class="field">Category<select name="category">${catOpts(a.kind)}</select></label>
      <label class="field span2">Name<input name="name" required value="${a.name || ''}" placeholder="e.g. Chase checking, Vanguard 401k, Home"></label>
      <label class="field">Institution<input name="institution" value="${a.institution || ''}"></label>
      <label class="field">Currency <span class="hint">the account's own currency</span>${raw(ccySelect('currency', a.currency || displayCcy()))}</label>
      ${balField(a)}
      <div class="lia full form-grid" style="padding:0">
        <label class="field">Interest rate (APR %)<input name="rate" type="number" step="any" min="0" value="${a.rate ?? ''}"></label>
        <label class="field">Monthly payment<input name="payment" type="number" step="any" min="0" value="${a.payment ?? ''}"></label>
      </div>
      <div class="ast full form-grid" style="padding:0">
        <label class="field">Held at<select name="custody">${CUSTODY.map(c => html`<option value="${c.id}" ${custodyOf(a) === c.id ? raw('selected') : ''}>${c.label}</option>`)}</select></label>
        <label class="field">Purpose / bucket<select name="purpose"><option value="">Auto (${purposeOf({ category: a.category || 'cash' })})</option>${purposeChoices(a).map(p => html`<option ${a.purpose === p ? raw('selected') : ''}>${p}</option>`)}<option value="__custom">Other — type your own…</option></select><input name="purposeOther" placeholder="e.g. Wedding fund" maxlength="40" hidden style="margin-top:6px"></label>
        <label class="field">Fixed yield (APY %) <span class="hint">savings, money market, staking</span><input name="apy" type="number" step="any" min="0" max="100" value="${a.apy ?? ''}" placeholder="e.g. 4.2"></label>
        <label class="field">Liquid?<select name="liquid"><option value="">Auto (by category)</option><option value="yes" ${a.liquid === true ? raw('selected') : ''}>Yes</option><option value="no" ${a.liquid === false ? raw('selected') : ''}>No</option></select></label>
        <label class="check full"><input type="checkbox" name="tracksHoldings" ${a.tracksHoldings ? raw('checked') : ''}> Track individual holdings (crypto / stocks) — value = quantity × price, with one-click price updates</label>
      </div>
      <label class="field full">Notes<input name="notes" value="${a.notes || ''}"></label>
    </form>`),
    onMount: w => {
      const f = w.querySelector('#nf');
      const purp = () => { f.purposeOther.hidden = f.purpose.value !== '__custom'; if (!f.purposeOther.hidden) f.purposeOther.focus(); f.purpose.options[0].textContent = `Auto (${purposeOf({ category: f.category.value })})`; };
      f.purpose.onchange = purp; f.category.addEventListener('change', purp);
      const sync = () => { const li = f.kind.value === 'liability'; w.querySelector('.lia').hidden = !li; w.querySelector('.ast').hidden = li; const bal = w.querySelector('.bal'); if (bal) bal.hidden = !li && f.tracksHoldings.checked; };
      f.tracksHoldings.onchange = sync;
      f.kind.onchange = () => { f.category.innerHTML = String(html`${(f.kind.value === 'liability' ? LIAB_CATS : ASSET_CATS).map(c => html`<option value="${c.id}">${c.label}</option>`)}`); sync(); purp(); };
      sync();
    },
    actions: [{ label: 'Cancel' }, { label: 'Save', kind: 'primary', value: w => { const f = w.querySelector('#nf'); if (!f.name.value.trim()) { toast('Name is required', 'error'); return false; } if (f.purpose.value === '__custom' && !f.purposeOther.value.trim()) { toast('Type a name for the purpose, or pick one from the list', 'error'); return false; } return formData(f); } }],
  });
  if (!res || typeof res !== 'object') return null;
  const yn = v => (v === 'yes' ? true : v === 'no' ? false : null);
  const obj = { ...a, kind: res.kind, category: res.category, name: res.name.trim(), institution: res.institution, notes: res.notes,
    rate: toNum(res.rate), payment: toNum(res.payment), liquid: yn(res.liquid), linkedTradingAccountId: '', currency: res.currency || displayCcy(),
    tracksHoldings: res.kind !== 'liability' && !!res.tracksHoldings, holdings: a.holdings || [],
    custody: res.kind === 'liability' ? '' : res.custody, purpose: res.kind === 'liability' ? '' : ((res.purpose === '__custom' ? res.purposeOther : res.purpose) || '').trim().slice(0, 40), apy: res.kind === 'liability' ? null : toNum(res.apy) };
  // a linked account is valued in its trading account's currency
  return finishAccountSave(a, obj, res);
}

async function finishAccountSave(a, obj, res) {
  const before = a.id ? currentBalance(a) : null;
  // keep a history of APY changes, so interest earned before a rate change uses the old rate
  const oldApy = +a.apy || 0, newApy = +obj.apy || 0;
  if (oldApy !== newApy) {
    const d = today(), h = (a.apyHistory || []).filter(x => x.from !== d);
    if (!h.length && a.id && oldApy) h.push({ from: '0000-01-01', apy: oldApy });
    obj.apyHistory = [...h, { from: d, apy: newApy }];
  }
  const saved = await store.put('nwAccounts', obj);
  if (saved.tracksHoldings && !a.tracksHoldings) { await editHoldings(saved); return saved; }
  // a changed balance is recorded for today (earlier snapshots keep the history)
  const changed = res.balance !== '' && res.balance != null && (before == null || Math.abs(Math.abs(+res.balance) - before) >= 0.005);
  if (!saved.tracksHoldings && !saved.archivedAt && changed) {
    const d = today();
    const snap = store.all('nwSnapshots').find(s => s.date === d);
    await store.put('nwSnapshots', { ...(snap || { date: d }), balances: { ...(snap?.balances || {}), [saved.id]: Math.abs(+res.balance) } });
  }
  return saved;
}

async function editHoldings(a) {
  const cur = ccyOf(a);
  let rows = (a.holdings || []).map(h => ({ ...h }));
  if (!rows.length) rows.push({ id: store.uid(), type: a.category === 'crypto' ? 'crypto' : 'stock', symbol: '', qty: '', price: '', cost: '' });
  const rowHtml = h => html`<tr data-id="${h.id}">
    <td><select data-k="type"><option value="crypto" ${h.type === 'crypto' ? raw('selected') : ''}>Crypto</option><option value="stock" ${h.type === 'stock' ? raw('selected') : ''}>Stock / ETF</option></select></td>
    <td><input data-k="symbol" value="${h.symbol || ''}" placeholder="BTC, AAPL" style="text-transform:uppercase;width:90px"></td>
    <td><input data-k="qty" type="number" step="any" min="0" value="${h.qty ?? ''}" style="width:110px"></td>
    <td><input data-k="price" type="number" step="any" min="0" value="${h.price ?? ''}" placeholder="auto" style="width:110px"></td>
    <td class="num" data-val>${moneyIn(holdingValue(h), cur)}</td>
    <td><input data-k="cost" type="number" step="any" min="0" value="${h.cost ?? ''}" placeholder="optional" style="width:110px"></td>
    <td><button type="button" class="icon-btn" data-rm aria-label="Remove holding">✕</button></td></tr>`;
  const res = await modal({
    title: `Holdings — ${a.name}`, wide: true,
    body: String(html`<p class="small muted">Price is per unit in ${cur}. Leave it blank and use <b>Update prices</b> to fetch it — crypto from Binance/Coinbase, stocks from Finnhub (free key in Settings). You can always type a price manually.</p>
      <div class="table-wrap"><table class="data compact exec-table"><thead><tr><th>Type</th><th>Symbol</th><th>Quantity</th><th>Price (${cur})</th><th class="num">Value</th><th>Total cost basis</th><th></th></tr></thead><tbody id="hrows"></tbody>
      <tfoot><tr><td colspan="4">Total</td><td class="num" id="htot"></td><td colspan="2"></td></tr></tfoot></table></div>
      <button type="button" class="btn sm mt" data-addh>+ Add holding</button>`),
    onMount: w => {
      const tb = w.querySelector('#hrows');
      const draw = () => { tb.innerHTML = String(html`${rows.map(rowHtml)}`); tot(); };
      const tot = () => { w.querySelector('#htot').textContent = moneyIn(rows.reduce((s, h) => s + holdingValue(h), 0), cur); };
      tb.addEventListener('input', e => { const tr = e.target.closest('tr'); const h = rows.find(x => x.id === tr.dataset.id); h[e.target.dataset.k] = e.target.value; if (e.target.dataset.k === 'price' || e.target.dataset.k === 'symbol') { delete h.priceSource; delete h.priceAt; } tr.querySelector('[data-val]').textContent = moneyIn(holdingValue(h), cur); tot(); });
      tb.addEventListener('change', e => { const tr = e.target.closest('tr'); const h = rows.find(x => x.id === tr.dataset.id); h[e.target.dataset.k] = e.target.value; });
      tb.addEventListener('click', e => { if (e.target.closest('[data-rm]')) { const id = e.target.closest('tr').dataset.id; rows = rows.filter(x => x.id !== id); draw(); } });
      w.querySelector('[data-addh]').onclick = () => { rows.push({ id: store.uid(), type: rows.at(-1)?.type || 'crypto', symbol: '', qty: '', price: '', cost: '' }); draw(); tb.querySelector('tr:last-child [data-k=symbol]').focus(); };
      draw();
    },
    actions: [{ label: 'Cancel' }, { label: 'Save holdings', kind: 'primary', value: () => true }],
  });
  if (res !== true) return false;
  const holdings = rows.map(h => ({ ...h, symbol: normSymbol(h.symbol), qty: toNum(h.qty), price: toNum(h.price), cost: toNum(h.cost) })).filter(h => h.symbol && h.qty);
  const fresh = { ...store.get('nwAccounts', a.id), holdings };
  await store.put('nwAccounts', fresh);
  await syncHoldingsSnapshot([fresh]);
  toast(`${holdings.length} holding${holdings.length === 1 ? '' : 's'} saved`);
  return true;
}

function holdingsCard(a, pro) {
  const hs = a.holdings || [];
  const total = holdingsTotal(a), cur = ccyOf(a);
  const last = hs.map(h => h.priceAt).filter(Boolean).sort().at(-1);
  return html`<div class="card mt" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><div><h2>${a.name} — holdings</h2><div class="small muted">${hs.length} position${hs.length === 1 ? '' : 's'} · prices ${ago(last)}</div></div>
    <div class="row"><span class="hint">${moneyIn(total, cur)}${!sameMoney(cur, displayCcy()) ? html` ≈ ${money(toDisplay(total, cur))}` : ''}</span><button class="btn sm" data-hold="${a.id}">Edit holdings</button></div></div>
    ${hs.length ? html`<div class="table-wrap" style="border:0"><table class="data compact"><thead><tr><th>Symbol</th><th>Type</th><th class="num">Quantity</th><th class="num">Price</th><th class="num">Value</th><th class="num">Weight</th>${pro ? raw('<th class="num">Cost basis</th><th class="num">Unrealised P&L</th>') : ''}<th>Source</th></tr></thead><tbody>
      ${[...hs].sort((x, y) => holdingValue(y) - holdingValue(x)).map(h => { const v = holdingValue(h), pl = h.cost ? v - h.cost : null; return html`<tr><td><b>${h.symbol}</b></td><td>${h.type === 'crypto' ? 'Crypto' : 'Stock / ETF'}</td><td class="num">${num(+h.qty, +h.qty % 1 ? 6 : 0)}</td><td class="num">${h.price ? moneyIn(+h.price, cur) : html`<span class="muted">—</span>`}</td><td class="num">${moneyIn(v, cur)}</td><td class="num">${pct(total ? v / total : null, 1)}</td>${pro ? html`<td class="num">${h.cost ? moneyIn(+h.cost, cur) : '—'}</td><td class="num ${pnlClass(pl)}">${pl == null ? '—' : html`${moneyIn(pl, cur, { sign: true })} <span class="small">(${pct(pl / h.cost, 1, { sign: true })})</span>`}</td>` : ''}<td class="small muted">${h.priceSource ? `${h.priceSource}, ${ago(h.priceAt)}` : h.price ? 'manual' : 'not priced'}</td></tr>`; })}
    </tbody></table></div>` : html`<p class="muted small" style="padding:0 16px 16px">No holdings yet.</p>`}</div>`;
}

export async function accounts(el) {
  const accts = store.all('nwAccounts');
  const cur = pointAt(today());
  const totalAssets = cur.assets || 0;
  const sec = (title, list, { hint = '', debt = false } = {}) => { const tot = list.filter(a => !a.archivedAt).reduce((s, a) => s + (cur.byAcct[a.id] || 0), 0); return html`<div class="card mt acct-group" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><div><h2>${title}</h2>${hint ? html`<div class="small muted">${hint}</div>` : ''}</div><span class="hint"><b class="${debt ? 'neg' : ''}">${money(debt ? -tot : tot)}</b>${!debt && totalAssets ? html` · ${pct(tot / totalAssets, 1)} of assets` : ''}</span></div>
    <div class="table-wrap" style="border:0"><table class="data"><thead><tr><th>Name</th><th>Institution</th><th>Details</th><th class="num">Balance</th><th></th></tr></thead><tbody>
    ${list.map(a => html`<tr ${a.archivedAt ? raw('style="opacity:.55"') : ''}><td><b>${a.name}</b>${a.archivedAt ? html` <span class="tag">closed ${fmtDate(a.archivedAt)}</span>` : ''}${+a.apy ? html` <span class="tag accent">${a.apy}% APY</span>` : a.kind !== 'liability' && groupOf(a) === 'savings' ? html` <span class="tag">0% APY</span>` : ''}${a.kind === 'liability' && +a.rate ? html` <span class="tag">${a.rate}% APR</span>` : ''}</td><td>${a.institution || ''}</td>
      <td class="small muted">${a.kind === 'liability' ? [typeLabel(a), a.payment ? `${moneyIn(+a.payment, ccyOf(a))}/mo` : ''].filter(Boolean).join(' · ') : [simpleMode() ? '' : typeLabel(a), custodyLabel(custodyOf(a)), purposeOf(a), isLiquid(a) ? 'liquid' : 'illiquid'].filter(Boolean).join(' · ')}</td>
      <td class="num ${a.kind === 'liability' ? 'neg' : ''}">${moneyIn((a.kind === 'liability' ? -1 : 1) * (cur.byAcctNative[a.id] || 0), ccyOf(a))}${!sameMoney(ccyOf(a), displayCcy()) ? html`<div class="dist">≈ ${money((a.kind === 'liability' ? -1 : 1) * (cur.byAcct[a.id] || 0))}</div>` : ''}</td>
      <td style="text-align:right;white-space:nowrap">${a.tracksHoldings ? html`<button class="btn sm" data-hold="${a.id}">Holdings</button> ` : ''}<button class="btn sm" data-edit="${a.id}">Edit</button> <button class="btn sm" data-arch="${a.id}">${a.archivedAt ? 'Reopen' : 'Close'}</button> <button class="icon-btn" data-del="${a.id}" aria-label="Delete">✕</button></td></tr>`)}
    </tbody></table></div></div>`; };
  // grouped by type (the six Simple types, or the detailed Pro categories); biggest first inside each group
  const order = (a, b) => !!a.archivedAt - !!b.archivedAt || (cur.byAcct[b.id] || 0) - (cur.byAcct[a.id] || 0) || a.name.localeCompare(b.name);
  const types = [...assetCats(), ...liabCats()].map(c => ({ ...c, debt: liabCats().includes(c), list: accts.filter(a => catKey(a) === c.id && (a.kind === 'liability') === liabCats().includes(c)).sort(order) })).filter(g => g.list.length);
  const holdingAccts = accts.filter(a => a.tracksHoldings && !a.archivedAt && a.kind !== 'liability');
  el.innerHTML = String(html`<div class="page-head"><div><h1>Accounts & holdings</h1><div class="sub">Everything you own and owe, grouped by type. Closing an account (sold, paid off) keeps its history.</div></div>
    <div class="actions">${priceBtn()}${simpleMode() ? html`<button class="btn primary" data-new>+ Add account</button>` : html`<button class="btn" data-new-l>+ Add debt</button><button class="btn primary" data-new>+ Add asset</button>`}</div></div>
    ${!accts.length ? html`<div class="empty"><div class="empty-title">No accounts yet</div><p>${simpleMode() ? 'Add your cash, savings, trading capital, investments and the things you own — and any debts.' : 'Typical list: bank accounts, savings, brokers, exchanges, wallets, property — and any loans or cards.'}</p><button class="btn primary" data-new>+ Add asset</button><button class="btn" data-new-l>+ Add debt</button><button class="btn" data-demo>Load demo data</button></div>` : html`
    <div class="type-strip">${types.map(g => html`<a href="#grp-${g.id}" class="type-chip"><span>${g.label}</span><b class="${g.debt ? 'neg' : ''}">${money((g.debt ? -1 : 1) * g.list.filter(a => !a.archivedAt).reduce((s, a) => s + (cur.byAcct[a.id] || 0), 0), { compact: true })}</b></a>`)}</div>`}
    ${types.map(g => html`<div id="grp-${g.id}">${sec(g.label, g.list, { debt: g.debt, hint: g.hint && simpleMode() ? g.hint.split(' — ')[0] : '' })}</div>`)}
    ${holdingAccts.length ? html`<h2 class="mt">Holdings</h2>${holdingAccts.map(a => holdingsCard(a, true))}` : ''}`);
  el.querySelectorAll('.type-chip').forEach(x => x.onclick = e => { e.preventDefault(); el.querySelector(x.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  wireDemo(el);
  wirePrices(el);
  el.addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.new !== undefined) { if (await editAccount()) refresh(); }
    else if (b.dataset.newL !== undefined) { if (await editAccount({ kind: 'liability', category: 'mortgage' })) refresh(); }
    else if (b.dataset.edit) { if (await editAccount(store.get('nwAccounts', b.dataset.edit))) refresh(); }
    else if (b.dataset.hold) { if (await editHoldings(store.get('nwAccounts', b.dataset.hold))) refresh(); }
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

// ================= target allocation (shown on Analytics) =================
// Rebalancing bands — the "5/25 rule": act when a category drifts more than 5 percentage points
// from its target, or more than 25% of the target itself, whichever is smaller.
const band = tg => Math.min(0.05, (tg / 100) * 0.25);
function renderTargets(host, cur) {
  const pl = store.getSettings().plan || {};
  const ta = pl.targetAllocation || {};
  const aCats = assetCats().filter(c => (cur.byCat[c.id] || 0) > 0 || +ta[c.id]);
  const targetSum = aCats.reduce((a, c) => a + (+ta[c.id] || 0), 0);
  host.innerHTML = String(html`<div class="grid g2 mt">
      <form class="card" id="tf"><div class="card-head"><h2>Target allocation</h2><span class="hint ${Math.abs(targetSum - 100) > 0.01 && targetSum ? 'neg' : ''}">${targetSum ? `targets add up to ${num(targetSum, 0)}%` : 'set a target % per type'}</span></div>
        ${aCats.length ? html`<div class="table-wrap" style="border:0"><table class="data compact"><thead><tr><th>Type</th><th class="num">Current</th><th class="num">Target %</th><th class="num">Drift</th><th class="num">Adjust by</th></tr></thead><tbody>
        ${aCats.map(c => { const curPct = cur.assets ? (cur.byCat[c.id] || 0) / cur.assets : 0; const tg = +ta[c.id] || 0; const drift = tg ? curPct - tg / 100 : null; const reb = tg ? (tg / 100) * cur.assets - (cur.byCat[c.id] || 0) : null; const out = drift != null && Math.abs(drift) > band(tg);
          return html`<tr><td style="white-space:nowrap"><span class="dot" style="background:${catColor(c.id, C.palette())}"></span>${c.label}</td><td class="num">${pct(curPct, 1)}</td><td class="num"><input name="${c.id}" type="number" min="0" max="100" step="1" value="${tg || ''}" style="width:58px;text-align:right" aria-label="${c.label} target"></td><td class="num ${out ? 'neg' : ''}">${drift == null ? '—' : num(drift * 100, 1, { sign: true }) + ' pts'}</td><td class="num ${out ? '' : 'muted'}">${reb == null ? '—' : money(reb, { sign: true })}</td></tr>`; })}
        </tbody></table></div><div class="row mt"><span class="small muted">Red = outside the rebalancing band (5 points, or 25% of the target if smaller).</span><span class="spacer"></span><button class="btn primary">Save targets</button></div>` : html`<p class="muted">Add assets first.</p>`}
      </form>
      <div class="card"><div class="card-head"><h2>Current vs target</h2></div><div class="chart"><canvas id="p-alloc"></canvas></div></div>
    </div>`);
  host.querySelector('#tf').onsubmit = async e => {
    e.preventDefault();
    const f = formData(e.target);
    const next = {};
    for (const [k, v] of Object.entries(f)) if (v !== '') next[k] = +v;
    await store.saveSettings({ plan: { targetAllocation: null } });   // replace, so cleared targets disappear
    await store.saveSettings({ plan: { targetAllocation: next } });
    toast('Targets saved'); refresh();
  };
  const p = C.palette();
  if (aCats.length) C.make(host.querySelector('#p-alloc'), {
    type: 'bar',
    data: { labels: aCats.map(c => c.label), datasets: [{ label: 'Current', data: aCats.map(c => (cur.assets ? (cur.byCat[c.id] || 0) / cur.assets : 0) * 100), backgroundColor: p.series[0], maxBarThickness: 14 }, { label: 'Target', data: aCats.map(c => +ta[c.id] || 0), backgroundColor: p.neutral, maxBarThickness: 14 }] },
    options: { indexAxis: 'y', plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${num(c.parsed.x, 1)}%` } } }, scales: { x: { grid: { color: p.grid }, border: { display: false }, ticks: { callback: v => v + '%' } }, y: C.plainAxis({ ticks: { autoSkip: false } }) } },
  });
}

// ================= analytics =================
export async function analytics(el, _p, { mode }) {
  const series = nwSeries();
  el.innerHTML = String(html`<div class="page-head"><div><h1>Net worth analytics</h1><div class="sub">Where your money sits, what it's for, how concentrated it is, and how healthy the balance sheet looks.</div></div></div><div id="body"></div>`);
  const body = el.querySelector('#body');
  if (!series.length) { body.innerHTML = String(emptyNW()); wireDemo(body); return; }
  const cur = series.at(-1);
  const p = C.palette();
  const t12 = baseline();
  const y = yieldSummary();
  const pos = positions(cur);
  const conc = concentration(pos);
  const posTotal = pos.reduce((a, x) => a + x.value, 0);
  const finCust = custody => custody.filter(c => !['physical', 'other'].includes(c.id));
  const custody = CUSTODY.map(c => ({ ...c, v: cur.byCustody[c.id] || 0 })).filter(c => c.v > 0).sort((a, b) => b.v - a.v);
  const purposes = Object.entries(cur.byPurpose).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const tiers = TIERS.map(t => ({ t, v: cur.byTier[t] || 0 }));
  const custTbl = html`<table class="data compact"><tbody>${custody.map(c => html`<tr><td>${c.label}</td><td class="num">${money(c.v)}</td><td class="num">${pct(c.v / cur.assets, 1)}</td></tr>`)}</tbody></table>`;
  const purpTbl = html`<table class="data compact"><tbody>${purposes.map(([k, v]) => html`<tr><td>${k}</td><td class="num">${money(v)}</td><td class="num">${pct(v / cur.assets, 1)}</td></tr>`)}</tbody></table>`;
  const crypto = store.all('nwAccounts').filter(a => a.category === 'crypto' && a.kind !== 'liability').reduce((s, a) => s + (cur.byAcct[a.id] || 0), 0);
  const annualExp = t12.avgExpenses ? t12.avgExpenses * 12 : null;
  const cash = (cur.byCat.cash || 0) + (cur.byCat.savings || 0);
  // growth
  const monthly = [];
  for (let i = 1; i < series.length; i++) monthly.push(series[i].net - series[i - 1].net);
  const yrs = series.length > 1 ? (parseDay(cur.date) - parseDay(series[0].date)) / (365.25 * 864e5) : 0;
  const cagr = yrs >= 1 && series[0].net > 0 && cur.net > 0 ? Math.pow(cur.net / series[0].net, 1 / yrs) - 1 : null;
  const health = [
    [html`Cash runway${estTag(t12.estimated.spending)}`, t12.avgExpenses ? cash / t12.avgExpenses : null, v => `${num(v, 1)} months`, v => v >= 6 ? 'good' : v >= 3 ? 'ok' : 'bad', '3–6+ months of spending in cash & savings'],
    ['Debt-to-asset', cur.assets ? cur.liabilities / cur.assets : null, v => pct(v, 1), v => v <= 0.3 ? 'good' : v <= 0.5 ? 'ok' : 'bad', 'under 50%, ideally under 30%'],
    ['Solvency (net worth ÷ assets)', cur.assets ? cur.net / cur.assets : null, v => pct(v, 1), v => v >= 0.5 ? 'good' : v >= 0.2 ? 'ok' : 'bad', 'above 50%'],
    [html`Interest vs your spending${estTag(t12.estimated.spending)}`, annualExp ? y.perYear / annualExp : null, v => pct(v, 1), v => v >= 1 ? 'good' : v >= 0.25 ? 'ok' : 'bad', 'yearly interest ÷ yearly spending (100% = interest covers it)'],
    ['Largest single position', conc.top1, v => `${pct(v, 1)} · ${pos[0]?.label}`, v => v <= 0.2 ? 'good' : v <= 0.35 ? 'ok' : 'bad', 'under ~20% of your assets'],
    ['Largest custodian type', finCust(custody).length ? finCust(custody)[0].v / finCust(custody).reduce((a, c) => a + c.v, 0) : null, v => `${pct(v, 0)} · ${finCust(custody)[0]?.label}`, v => v <= 0.5 ? 'good' : v <= 0.7 ? 'ok' : 'bad', 'share of financial assets with one type of custodian'],
    ['On crypto exchanges', cur.assets ? (cur.byCustody.cex || 0) / cur.assets : null, v => pct(v, 1), v => v <= 0.1 ? 'good' : v <= 0.25 ? 'ok' : 'bad', 'exchange balances carry counterparty risk'],
  ];
  const icon = k => (k === 'good' ? raw('<span class="pos">✔</span>') : k === 'ok' ? raw('<span style="color:var(--warn)">●</span>') : raw('<span class="neg">▲</span>'));

  body.innerHTML = String(html`
    <div class="stats big">
      ${stat('Net worth', money(cur.net), { sub: `as of ${fmtDate(cur.date)}` })}
      ${stat('Growth (CAGR)', cagr != null ? pct(cagr, 1, { sign: true }) : '—', { sub: cagr != null ? `over ${num(yrs, 1)} years` : 'needs a year of history' })}
      ${stat('Avg change / update', monthly.length ? money(monthly.reduce((a, b) => a + b, 0) / monthly.length, { sign: true }) : '—', { sub: monthly.length ? `${pct(monthly.filter(x => x > 0).length / monthly.length, 0)} of periods up` : '' })}
      ${stat('Interest per year', money(y.perYear), { sub: y.accts.length ? html`${money(y.perMonth)} / month · <a href="#/networth/interest">details</a>` : 'add an APY to savings accounts' })}
      ${stat('Effective positions', conc.effective ? num(conc.effective, 1) : '—', { sub: conc.top5 != null ? `top 5 = ${pct(conc.top5, 0)} of assets` : '', help: '1 ÷ Herfindahl index of position weights: how many equal-sized positions your investments behave like. Higher = more diversified.' })}
      ${stat('Crypto exposure', pct(cur.assets ? crypto / cur.assets : null, 1), { sub: money(crypto) })}
    </div>
    <div class="grid g2 mt">
      <div class="card"><div class="card-head"><h2>Where it's held</h2><span class="hint">counterparty / custody</span></div><div class="chart"><canvas id="a-cust"></canvas></div></div>
      <div class="card"><div class="card-head"><h2>What it's for</h2><span class="hint">purpose buckets</span></div><div class="chart"><canvas id="a-purp"></canvas></div></div>
    </div>
    <div class="grid g2 mt">
      <div class="card"><div class="card-head"><h2>Liquidity ladder</h2><span class="hint">how fast you could reach it</span></div><div class="chart short"><canvas id="a-tier"></canvas></div></div>
      <div class="card"><div class="card-head"><h2>Largest positions</h2><span class="hint">% of assets</span></div><div class="chart short"><canvas id="a-top"></canvas></div></div>
    </div>
    ${series.length > 1 ? html`<div class="grid g-2-1 mt">
      <div class="card"><div class="card-head"><h2>Custody over time</h2><span class="hint">stacked</span></div><div class="chart"><canvas id="a-custt"></canvas></div></div>
      <div class="card"><div class="card-head"><h2>By custody</h2></div>${custTbl}
        <h3 class="mt">By purpose</h3>${purpTbl}</div>
    </div>` : html`<div class="grid g2 mt">
      <div class="card"><div class="card-head"><h2>By custody</h2><span class="hint">over time after your next update</span></div>${custTbl}</div>
      <div class="card"><div class="card-head"><h2>By purpose</h2></div>${purpTbl}</div>
    </div>`}
    <div class="card mt" data-tour="health"><div class="card-head"><h2>Balance-sheet health</h2><span class="hint">rules of thumb used by planners — context matters</span></div>
      <div class="table-wrap" style="border:0"><table class="data"><thead><tr><th></th><th>Measure</th><th class="num">You</th><th>Guideline</th></tr></thead><tbody>
      ${health.map(([name, v, f, judge, guide]) => html`<tr><td style="width:28px">${v == null ? html`<span class="muted">–</span>` : icon(judge(v))}</td><td>${name}</td><td class="num">${v == null ? html`<span class="muted">needs data</span>` : f(v)}</td><td class="small muted">${guide}</td></tr>`)}
      </tbody></table></div></div>
    <div id="targets"></div>`);
  renderTargets(body.querySelector('#targets'), cur);

  C.doughnut(body.querySelector('#a-cust'), { labels: custody.map(c => c.label), values: custody.map(c => c.v), colors: custody.map(c => p.series[CUSTODY.findIndex(x => x.id === c.id) % 8]), center: { value: money(cur.assets, { compact: true }), label: 'assets' } });
  C.doughnut(body.querySelector('#a-purp'), { labels: purposes.map(x => x[0]), values: purposes.map(x => x[1]), center: { value: String(purposes.length), label: 'buckets' } });
  C.plainBars(body.querySelector('#a-tier'), { labels: tiers.map(x => x.t), values: tiers.map(x => x.v), horizontal: true, fmt: v => money(v, { compact: true }), label: 'Value' });
  const top = pos.slice(0, 8);
  C.plainBars(body.querySelector('#a-top'), { labels: top.map(x => x.label), values: top.map(x => (x.value / posTotal) * 100), horizontal: true, fmt: v => num(v, 1) + '%', label: 'Share of assets' });
  const used = CUSTODY.filter(c => series.some(s => (s.byCustody[c.id] || 0) > 0));
  if (series.length > 1) C.make(body.querySelector('#a-custt'), {
    type: 'line',
    data: { labels: series.map(s => fmtDate(s.date, { month: 'short', year: '2-digit' })), datasets: used.map(c => { const col = p.series[CUSTODY.findIndex(x => x.id === c.id) % 8]; return { label: c.label, data: series.map(s => s.byCustody[c.id] || 0), borderColor: col, backgroundColor: C.alpha(col, 0.5), fill: true, borderWidth: 1, tension: 0.15, pointRadius: 0 }; }) },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${money(c.parsed.y)}` } } }, scales: { x: C.plainAxis({ ticks: { maxTicksLimit: 8, maxRotation: 0 } }), y: { stacked: true, ...C.moneyAxis() } } },
  });
}
