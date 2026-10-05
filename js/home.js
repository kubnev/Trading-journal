// Overview: net worth first — what you own, how it's moving, where it sits, how close you are to
// financial independence — and then a compact look at this month's spending.
import * as store from './store.js';
import { html, money, pct, num, pnlClass, stat, fmtDate, today, dayKey, parseDay, estTag } from './ui.js';
import * as C from './charts.js';
import { nwSeries, assetCats, fiMetrics, baseline, yearAgoEstimate, MIN_MONTHS } from './networth/calc.js';
import { yieldCard, startTicker } from './networth/views.js';
import * as S from './spend/calc.js';
import { catLabel } from './spend/categories.js';
import { loadDemo } from './demo.js';
import { refresh } from './main.js';
import { startTour } from './tour.js';

export default async function home(el) {
  const hasAny = store.all('txns').length || store.all('nwAccounts').length;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (!hasAny) {
    el.innerHTML = String(html`
      <section class="hero"><h1>${greet}.</h1>
        <p>Your private place to track <b>what you're worth</b> — and where your money goes. Everything stays in this browser — nothing is uploaded.</p></section>
      <div class="grid g3">
        <div class="choice"><h2>Add your accounts</h2><p class="small muted">Cash, savings, trading capital, investments, things you own — and any debts. That's your net worth.</p><a class="btn primary" href="#/networth/accounts">Add accounts</a></div>
        <div class="choice"><h2>Log spending</h2><p class="small muted">Amount, category, done. Press <kbd>N</kbd> any time.</p><button class="btn" data-quick-add>+ Add expense</button></div>
        <div class="choice"><h2>Explore first</h2><p class="small muted">Take the guided tour (with sample data that disappears afterwards), or load demo data to keep exploring.</p><div class="row"><button class="btn" data-tour-start>Take the tour</button><button class="btn" data-demo>Load demo data</button></div></div>
      </div>
      ${!store.getSettings().estimates ? html`<div class="note mt">Add your <a href="#/setup">starting estimates</a> (income, spending, net worth a year ago…) so the analytics have something to work with from day one.</div>` : ''}`);
    el.querySelector('[data-demo]').onclick = async () => { await loadDemo(); refresh(); };
    el.querySelector('[data-tour-start]').onclick = () => startTour();
    return;
  }

  const series = nwSeries();
  const cur = series.at(-1), prev = series.at(-2);
  const yearAgo = cur ? series.filter(p => p.date <= dayKey(new Date(parseDay(cur.date).getFullYear() - 1, parseDay(cur.date).getMonth(), parseDay(cur.date).getDate()))).at(-1) : null;
  const yaEst = cur && !yearAgo ? yearAgoEstimate() : null;
  const yoy = cur ? (yearAgo ? cur.net - yearAgo.net : yaEst != null ? cur.net - yaEst : null) : null, yoyBase = yearAgo ? yearAgo.net : yaEst;
  const fi = cur ? fiMetrics(cur.investable) : null;
  const base = baseline();
  const efMonths = cur && base.avgExpenses ? ((cur.byCat.cash || 0) + (cur.byCat.savings || 0)) / base.avgExpenses : null;
  const m = S.currentMonth(), s = S.monthSummary(m);
  const cats = S.byCategory(s.ex).slice(0, 4);
  const up = S.upcoming(null, 10).filter(u => u.date >= today()).slice(0, 4);
  const lastSnap = [...store.all('nwSnapshots')].sort((a, b) => b.date.localeCompare(a.date))[0];
  const st = store.getSettings();
  const daysSince = lastSnap ? Math.floor((Date.now() - parseDay(lastSnap.date)) / 864e5) : null;
  const todo = [
    [!!lastSnap && lastSnap.date.slice(0, 7) === m, 'Update account balances this month', '#/networth/update'],
    [store.all('txns').some(t => t.date === today()), 'Log today\'s spending', '#/spending/transactions'],
    [!!st.lastBackupAt && Date.now() - new Date(st.lastBackupAt) < 7 * 864e5, 'Back up (weekly)', '#/settings'],
    ...(!st.estimates && base.realMonths < MIN_MONTHS ? [[false, 'Add your starting estimates', '#/setup']] : []),
  ];
  const aCats = assetCats(), alloc = cur ? aCats.filter(c => (cur.byCat[c.id] || 0) > 0) : [];

  el.innerHTML = String(html`
    <div class="page-head"><div><h1>${greet}</h1><div class="sub">${fmtDate(today(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${daysSince != null ? ` · balances last updated ${daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince} days ago`}` : ''}</div></div>
      <div class="actions"><button class="btn" data-quick-add>+ Add expense</button><a class="btn primary" href="#/networth/update">Update balances</a></div></div>
    <div class="stats big" data-tour="nw-stats">
      ${stat('Net worth', cur ? money(cur.net) : '—', { sub: cur && prev ? html`<span class="${pnlClass(cur.net - prev.net)}">${money(cur.net - prev.net, { sign: true })}</span> since ${fmtDate(prev.date, { month: 'short', day: 'numeric' })}` : cur ? 'your next balance update shows the change' : html`<a href="#/networth/accounts">add accounts</a>` })}
      ${stat(html`Past 12 months${estTag(!yearAgo && yaEst != null, 'the net worth you estimated for a year ago')}`, yoy != null ? money(yoy, { sign: true }) : '—', { cls: pnlClass(yoy), sub: yoyBase > 0 ? `${pct(yoy / yoyBase, 1, { sign: true })} vs a year ago` : html`add your net worth a year ago in <a href="#/setup">starting estimates</a>` })}
      ${stat('Liquid net worth', cur ? money(cur.liquidNet) : '—', { cls: cur ? pnlClass(cur.liquidNet) : '', sub: cur?.assets ? `${pct(cur.liquid / cur.assets, 0)} of assets are liquid` : '', help: 'Liquid assets (cash, savings, investments, crypto, trading capital) minus all debts — what you could reach within days.' })}
      ${stat(html`Savings rate${estTag(base.isEstimate)}`, pct(base.rate, 0), { cls: pnlClass(base.rate), sub: base.avgSavings != null ? `${money(base.avgSavings, { sign: true })} / month` : 'log income & spending', help: '(Income − spending) ÷ income over your recent complete months — from your starting estimates until you have a full month of transactions.' })}
    </div>
    ${yieldCard() ? html`<div class="mt">${yieldCard()}</div>` : ''}
    <div class="grid g-2-1 mt">
      <div class="card" data-tour="nw-chart"><div class="card-head"><h2>Net worth</h2><a class="hint" href="#/networth">Details →</a></div>${series.length > 1 ? html`<div class="chart tall"><canvas id="o-nw"></canvas></div>` : html`<p class="muted small">Update balances on two or more dates and your net-worth line appears here. <a href="#/networth/update">Update balances →</a></p>`}</div>
      <div class="card"><div class="card-head"><h2>Where it sits</h2><a class="hint" href="#/networth/analytics">Analytics →</a></div>${alloc.length ? html`<div class="chart tall"><canvas id="o-alloc"></canvas></div>` : html`<p class="muted small">Add accounts to see how your money is split.</p>`}</div>
    </div>
    <div class="grid g3 mt">
      <div class="card" data-tour="fi"><div class="card-head"><h2>Financial independence</h2><a class="hint" href="#/networth/plan">Plan →</a></div>
        ${fi?.fiNumber ? html`<div class="stat-value">${pct(fi.progress, 1)}${estTag(fi.derivedExpenses && base.estimated.spending)}</div><div class="budget-bar mt"><span style="width:${Math.min(100, (fi.progress || 0) * 100)}%"></span></div>
          <dl class="kv small mt"><dt>Invested toward FI</dt><dd>${money(cur.investable)}</dd><dt>FI number</dt><dd>${money(fi.fiNumber)}</dd><dt>At this pace</dt><dd>${fi.yearsToFI != null ? `${num(fi.yearsToFI, 1)} years (age ${num(fi.fiAge, 0)})` : '—'}</dd></dl>`
          : html`<p class="small muted">Your FI number = yearly spending ÷ withdrawal rate. Log spending or add your <a href="#/setup">starting estimates</a> to see your progress.</p>`}</div>
      <div class="card"><div class="card-head"><h2>Safety net</h2></div>
        <div class="stat-value">${efMonths != null ? `${num(efMonths, 1)} months` : '—'}${estTag(base.estimated.spending)}</div>
        <p class="small muted" style="margin:4px 0 0">Cash & savings cover this many months of your ${base.estimated.spending ? 'estimated' : 'average'} spending. Target: ${st.plan?.emergencyMonths || 6} months.</p>
        ${efMonths != null ? html`<div class="budget-bar mt"><span class="${efMonths < 3 ? 'over' : efMonths < (st.plan?.emergencyMonths || 6) ? 'warn' : ''}" style="width:${Math.min(100, (efMonths / (st.plan?.emergencyMonths || 6)) * 100)}%"></span></div>` : ''}</div>
      <div class="card"><div class="card-head"><h2>To do</h2><span class="hint">${todo.filter(x => x[0]).length}/${todo.length}</span></div>
        <div class="stack" style="gap:6px">${todo.map(([done, label, href]) => html`<a class="todo ${done ? 'done' : ''}" href="${href}"><span class="box">${done ? '✓' : ''}</span>${label}</a>`)}</div></div>
    </div>
    <div class="card mt" data-tour="spend-mini"><div class="card-head"><h2>Spending this month</h2><a class="hint" href="#/spending">Spending →</a></div>
      <div class="grid g3" style="gap:18px">
        <div><div class="stat-label">Spent</div><div class="stat-value">${money(s.spent)}</div><div class="stat-sub">${s.budget ? html`<span class="${s.left < 0 ? 'neg' : 'pos'}">${money(Math.abs(s.left))} ${s.left < 0 ? 'over' : 'left'}</span> of ${money(s.budget)}${s.safeToday != null ? html` · <b>${money(s.safeToday)}</b>/day` : ''}` : html`<a href="#/spending/budgets">set a budget</a>`}</div>
          ${s.budget ? html`<div class="budget-bar mt"><span class="${s.spent > s.budget ? 'over' : ''}" style="width:${Math.min(100, (s.spent / s.budget) * 100)}%"></span><i style="left:${(s.dayNow / s.n) * 100}%"></i></div>` : ''}</div>
        <div><div class="stat-label">Top categories</div>${cats.length ? html`<dl class="kv small">${cats.map(c => html`<dt>${catLabel(c.id)}</dt><dd>${money(c.total)}</dd>`)}</dl>` : html`<p class="muted small">Nothing logged yet.</p>`}</div>
        <div><div class="stat-label">Coming up</div>${up.length ? html`<div class="upcoming col">${up.map(u => html`<div class="up-item"><span class="muted small">${fmtDate(u.date, { weekday: 'short', day: 'numeric' })}</span><span>${u.r.name}</span><b class="${u.type === 'income' ? 'pos' : ''}">${money(u.value)}</b></div>`)}</div>` : html`<p class="muted small">No bills in the next 10 days.</p>`}</div>
      </div></div>`);

  const p = C.palette();
  if (series.length > 1) C.moneyLine(el.querySelector('#o-nw'), { labels: series.map(x => fmtDate(x.date, { month: 'short', year: '2-digit' })), series: [{ label: 'Net worth', data: series.map(x => x.net), color: p.series[0], fill: true }, { label: 'Liquid net worth', data: series.map(x => x.liquidNet), color: p.series[2] }] });
  if (alloc.length) C.doughnut(el.querySelector('#o-alloc'), { labels: alloc.map(c => c.label), values: alloc.map(c => cur.byCat[c.id]), colors: alloc.map(c => p.series[aCats.indexOf(c) % 8]), center: { value: money(cur.assets, { compact: true }), label: 'assets' } });
  const tick = startTicker(el);
  return () => clearInterval(tick);
}
