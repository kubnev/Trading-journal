// Overview: net worth first — what you own, how it's moving, where it sits, what it earns, the
// moves you've planned — then how you're doing (journal) and a compact look at this month's spending.
import * as store from './store.js';
import { html, money, pct, num, pnlClass, stat, fmtDate, today, dayKey, parseDay, estTag } from './ui.js';
import { moneyIn } from './fx.js';
import { MOODS, streaks } from './journal/views.js';
import * as C from './charts.js';
import { nwSeries, assetCats, baseline, yearAgoEstimate, interestOverview } from './networth/calc.js';
import { yieldCard, startTicker, lastUpdate } from './networth/views.js';
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
        <p>Your private place to see <b>where your money sits</b>, what it earns, the moves you plan — and where it goes. Everything stays in this browser — nothing is uploaded.</p></section>
      <div class="grid g3">
        <div class="choice"><h2>Add your accounts</h2><p class="small muted">Bank, savings, exchanges, brokers, wallets, things you own — and any debts. Then update the balances every so often.</p><a class="btn primary" href="#/networth/accounts">Add accounts</a></div>
        <div class="choice"><h2>Log spending</h2><p class="small muted">Amount, category, done. Press <kbd>N</kbd> any time.</p><button class="btn" data-quick-add>+ Add expense</button></div>
        <div class="choice"><h2>Explore first</h2><p class="small muted">Take the guided tour (with sample data that disappears afterwards), or load demo data to keep exploring.</p><div class="row"><button class="btn" data-tour-start>Take the tour</button><button class="btn" data-demo>Load demo data</button></div></div>
      </div>
      ${!store.getSettings().estimates ? html`<div class="note mt">Add your <a href="#/setup">starting estimates</a> (usual monthly spending, net worth a year ago) so the analytics have something to work with from day one.</div>` : ''}`);
    el.querySelector('[data-demo]').onclick = async () => { await loadDemo(); refresh(); };
    el.querySelector('[data-tour-start]').onclick = () => startTour();
    return;
  }

  const series = nwSeries();
  const cur = series.at(-1), prev = series.at(-2);
  const yearAgo = cur ? series.filter(p => p.date <= dayKey(new Date(parseDay(cur.date).getFullYear() - 1, parseDay(cur.date).getMonth(), parseDay(cur.date).getDate()))).at(-1) : null;
  const yaEst = cur && !yearAgo ? yearAgoEstimate() : null;
  const yoy = cur ? (yearAgo ? cur.net - yearAgo.net : yaEst != null ? cur.net - yaEst : null) : null, yoyBase = yearAgo ? yearAgo.net : yaEst;
  const base = baseline();
  const io = interestOverview();
  const efMonths = cur && base.avgExpenses ? ((cur.byCat.cash || 0) + (cur.byCat.savings || 0)) / base.avgExpenses : null;
  const m = S.currentMonth(), s = S.monthSummary(m);
  const cats = S.byCategory(s.ex).slice(0, 4);
  const up = S.upcoming(null, 10).filter(u => u.date >= today()).slice(0, 4);
  const st = store.getSettings();
  const last = lastUpdate();
  const daysSince = last ? Math.floor((Date.now() - parseDay(last)) / 864e5) : null;
  const aCats = assetCats(), alloc = cur ? aCats.filter(c => (cur.byCat[c.id] || 0) > 0) : [];
  const planned = store.all('nwMoves').filter(x => x.status !== 'done').sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const acctName = id => store.get('nwAccounts', id)?.name || '—';
  const jToday = store.get('days', today());
  const jst = streaks();
  const stale = daysSince != null && daysSince > 35;

  el.innerHTML = String(html`
    <div class="page-head"><div><h1>${greet}</h1><div class="sub">${fmtDate(today(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${daysSince != null ? ` · balances last updated ${daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince} days ago`}` : ''}</div></div>
      <div class="actions"><button class="btn" data-quick-add>+ Add expense</button><a class="btn primary" href="#/networth/update">Update balances</a></div></div>
    ${stale ? html`<div class="callout mt" style="margin-top:0;margin-bottom:14px"><span class="ic">↻</span><div>It's been ${daysSince} days since your last balance update. A monthly snapshot keeps your history meaningful — <a href="#/networth/update">update balances</a>.</div></div>` : ''}
    <div class="stats big" data-tour="nw-stats">
      ${stat('Net worth', cur ? money(cur.net) : '—', { sub: cur && prev ? html`<span class="${pnlClass(cur.net - prev.net)}">${money(cur.net - prev.net, { sign: true })}</span> since ${fmtDate(prev.date, { month: 'short', day: 'numeric' })}` : cur ? 'your next balance update shows the change' : html`<a href="#/networth/accounts">add accounts</a>` })}
      ${stat(html`Past 12 months${estTag(!yearAgo && yaEst != null, 'the net worth you estimated for a year ago')}`, yoy != null ? money(yoy, { sign: true }) : '—', { cls: pnlClass(yoy), sub: yoyBase > 0 ? `${pct(yoy / yoyBase, 1, { sign: true })} vs a year ago` : html`add your net worth a year ago in <a href="#/setup">starting estimates</a>` })}
      ${stat('Liquid net worth', cur ? money(cur.liquidNet) : '—', { cls: cur ? pnlClass(cur.liquidNet) : '', sub: cur?.assets ? `${pct(cur.liquid / cur.assets, 0)} of assets are liquid` : '', help: 'Liquid assets (cash, savings, investments, crypto, trading capital) minus all debts — what you could reach within days.' })}
      ${stat('Interest / month', money(io.earnMonth), { cls: io.earnMonth ? 'pos' : '', sub: io.earn.length ? html`${pct(io.blended, 2)} on ${money(io.earnValue, { compact: true })} · <a href="#/networth/interest">details</a>` : html`set an APY on savings — <a href="#/networth/interest">how</a>`, help: 'What your interest-bearing accounts earn per month at their current APY.' })}
    </div>
    ${yieldCard() ? html`<div class="mt">${yieldCard()}</div>` : ''}
    <div class="grid g-2-1 mt">
      <div class="card" data-tour="nw-chart"><div class="card-head"><h2>Net worth</h2><a class="hint" href="#/networth">Details →</a></div>${series.length > 1 ? html`<div class="chart tall"><canvas id="o-nw"></canvas></div>` : html`<p class="muted small">Your first balance update is in${cur ? ` (${fmtDate(cur.date)})` : ''}. Update again next month and your net-worth line starts here. <a href="#/networth/update">Update balances →</a></p>`}</div>
      <div class="card" data-tour="alloc"><div class="card-head"><h2>Where it sits</h2><a class="hint" href="#/networth/analytics">Analytics →</a></div>${alloc.length ? html`<div class="chart tall"><canvas id="o-alloc"></canvas></div>` : html`<p class="muted small">Add accounts to see how your money is split.</p>`}</div>
    </div>
    <div class="grid g3 mt">
      <div class="card" data-tour="moves"><div class="card-head"><h2>Planned moves</h2><a class="hint" href="#/networth/moves">Moves →</a></div>
        ${planned.length ? html`<div class="stack" style="gap:6px">${planned.slice(0, 4).map(x => html`<a class="move-row small" href="#/networth/moves"><span class="${x.date < today() ? 'neg' : 'muted'}">${fmtDate(x.date, { month: 'short', day: 'numeric' })}</span><span class="ellipsis">${acctName(x.fromId)} → ${acctName(x.toId)}</span><b>${moneyIn(+x.amount, x.currency)}</b></a>`)}</div>${planned.length > 4 ? html`<p class="small muted">+ ${planned.length - 4} more</p>` : ''}`
          : html`<p class="small muted">Plan your next transfer — take profits off an exchange, top up savings, pay down a card. Mark it done and both balances update.</p><a class="btn sm" href="#/networth/moves">+ Plan a move</a>`}</div>
      <div class="card"><div class="card-head"><h2>Cash runway</h2></div>
        <div class="stat-value">${efMonths != null ? `${num(efMonths, 1)} months` : '—'}${estTag(base.estimated.spending)}</div>
        <p class="small muted" style="margin:4px 0 0">${efMonths != null ? html`Cash & savings cover this many months of your ${base.estimated.spending ? 'estimated' : 'usual'} spending (${money(base.avgExpenses)} / month).` : html`Log spending or add a monthly spending <a href="#/setup">estimate</a> to see how long your cash lasts.`}</p>
        ${efMonths != null ? html`<div class="budget-bar mt"><span class="${efMonths < 3 ? 'over' : efMonths < (st.plan?.emergencyMonths || 6) ? 'warn' : ''}" style="width:${Math.min(100, (efMonths / (st.plan?.emergencyMonths || 6)) * 100)}%"></span></div><div class="small muted">target ${st.plan?.emergencyMonths || 6} months</div>` : ''}</div>
      <div class="card" data-tour="journal-mini"><div class="card-head"><h2>Journal</h2><a class="hint" href="#/journal">${jToday ? 'Today →' : 'Write →'}</a></div>
        ${jToday ? html`<div class="stat-value">${jToday.mood ? MOODS[jToday.mood - 1] : '✎'}</div><p class="small muted" style="margin:4px 0 0">${(jToday.mind || jToday.recap || 'Checked in today.').slice(0, 90)}</p>`
          : html`<p class="small muted">How are you today? A two-minute check-in — mood, energy, stress, sleep.</p><a class="btn sm" href="#/journal">Check in</a>`}
        <div class="small muted mt">${jst.current ? `${jst.current}-day streak` : jst.total ? `${jst.total} entries` : ''}</div></div>
    </div>
    <div class="card mt" data-tour="spend-mini"><div class="card-head"><h2>Spending this month</h2><a class="hint" href="#/spending">Spending →</a></div>
      <div class="grid g3" style="gap:18px">
        <div><div class="stat-label">Spent</div><div class="stat-value">${money(s.spent)}</div><div class="stat-sub">${s.budget ? html`<span class="${s.left < 0 ? 'neg' : 'pos'}">${money(Math.abs(s.left))} ${s.left < 0 ? 'over' : 'left'}</span> of ${money(s.budget)}${s.safeToday != null ? html` · <b>${money(s.safeToday)}</b>/day` : ''}` : base.avgExpenses ? html`usual month ${money(base.avgExpenses)}${estTag(base.estimated.spending)}` : html`<a href="#/spending/budgets">set a budget</a>`}</div>
          ${s.budget ? html`<div class="budget-bar mt"><span class="${s.spent > s.budget ? 'over' : ''}" style="width:${Math.min(100, (s.spent / s.budget) * 100)}%"></span><i style="left:${(s.dayNow / s.n) * 100}%"></i></div>` : ''}</div>
        <div><div class="stat-label">Top categories</div>${cats.length ? html`<dl class="kv small">${cats.map(c => html`<dt>${catLabel(c.id)}</dt><dd>${money(c.total)}</dd>`)}</dl>` : html`<p class="muted small">Nothing logged yet.</p>`}</div>
        <div><div class="stat-label">Coming up</div>${up.length ? html`<div class="upcoming col">${up.map(u => html`<div class="up-item"><span class="muted small">${fmtDate(u.date, { weekday: 'short', day: 'numeric' })}</span><span>${u.r.name}</span><b>${money(u.value)}</b></div>`)}</div>` : html`<p class="muted small">No bills in the next 10 days.</p>`}</div>
      </div></div>`);

  const p = C.palette();
  if (series.length > 1) C.moneyLine(el.querySelector('#o-nw'), { labels: series.map(x => fmtDate(x.date, { month: 'short', year: '2-digit' })), series: [{ label: 'Net worth', data: series.map(x => x.net), color: p.series[0], fill: true }, { label: 'Liquid net worth', data: series.map(x => x.liquidNet), color: p.series[2] }] });
  if (alloc.length) C.doughnut(el.querySelector('#o-alloc'), { labels: alloc.map(c => c.label), values: alloc.map(c => cur.byCat[c.id]), colors: alloc.map(c => p.series[aCats.indexOf(c) % 8]), center: { value: money(cur.assets, { compact: true }), label: 'assets' } });
  const tick = startTicker(el);
  return () => clearInterval(tick);
}
