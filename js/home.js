// Overview: the one page to open every day — this month's spending, budget, net worth and what's due.
import * as store from './store.js';
import { html, money, pct, pnlClass, stat, fmtDate, today } from './ui.js';
import * as C from './charts.js';
import { nwSeries } from './networth/calc.js';
import { yieldCard, startTicker } from './networth/views.js';
import * as S from './spend/calc.js';
import { catById, catColor, catLabel } from './spend/categories.js';
import { txnModal } from './spend/txn.js';
import { moneyIn, ccyOf } from './fx.js';
import { loadDemo } from './demo.js';
import { refresh } from './main.js';
import { startTour } from './help.js';

export default async function home(el) {
  const hasAny = store.all('txns').length || store.all('nwAccounts').length;
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (!hasAny) {
    el.innerHTML = String(html`
      <section class="hero"><h1>${greet}.</h1>
        <p>Your private place to track <b>what you spend</b> and <b>what you're worth</b>. Everything stays in this browser — nothing is uploaded.</p></section>
      <div class="grid g3">
        <div class="choice"><h2>Log your first expense</h2><p class="small muted">Amount, category, done. Press <kbd>N</kbd> any time.</p><button class="btn primary" data-quick-add>+ Add expense</button></div>
        <div class="choice"><h2>Add your accounts</h2><p class="small muted">Cash, savings, trading capital, investments, things you own — and any debts.</p><a class="btn" href="#/networth/accounts">Add accounts</a></div>
        <div class="choice"><h2>Explore first</h2><p class="small muted">Load realistic sample data, or take a two-minute tour.</p><div class="row"><button class="btn" data-demo>Load demo data</button><button class="btn" data-tour-start>Start tour</button></div></div>
      </div>
      <div class="grid g3 mt">
        <div class="card"><h3>Private by design</h3><p class="small muted">Stored in this browser only. No account, no server, no tracking. Backups are password-encrypted.</p></div>
        <div class="card"><h3>Simple or Pro input</h3><p class="small muted">Decides how much you fill in, not what you see. Change it any time in Settings — nothing is lost.</p></div>
        <div class="card"><h3>Need help?</h3><p class="small muted">The <b>?</b> button (top right, or press <kbd>?</kbd>) explains the page you're on.</p></div>
      </div>`);
    el.querySelector('[data-demo]').onclick = async () => { await loadDemo(); refresh(); };
    el.querySelector('[data-tour-start]').onclick = () => startTour();
    return;
  }

  const m = S.currentMonth();
  const s = S.monthSummary(m);
  const prevToDay = S.spentToDay(S.shiftMonth(m, -1), s.dayNow);
  const vsPrev = prevToDay ? (s.spent - prevToDay) / prevToDay : null;
  const series = nwSeries();
  const cur = series.at(-1), prev = series.at(-2);
  const cats = S.byCategory(s.ex).slice(0, 6);
  const recent = [...store.all('txns')].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 8);
  const up = S.upcoming(null, 10).filter(u => u.date >= today()).slice(0, 6);
  const todaySpent = S.sum(S.expenses().filter(t => t.date === today()));
  const lastSnap = [...store.all('nwSnapshots')].sort((a, b) => b.date.localeCompare(a.date))[0];
  const st = store.getSettings();
  const todo = [
    [store.all('txns').some(t => t.date === today()), 'Log today\'s spending', '#/spending/transactions'],
    [!!lastSnap && lastSnap.date.slice(0, 7) === m, 'Update account balances this month', '#/networth/update'],
    [!!s.budget, 'Set a monthly budget', '#/spending/budgets'],
    [!!st.lastBackupAt && Date.now() - new Date(st.lastBackupAt) < 7 * 864e5, 'Back up (weekly)', '#/settings'],
  ];

  el.innerHTML = String(html`
    <div class="page-head"><div><h1>${greet}</h1><div class="sub">${fmtDate(today(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div></div>
      <div class="actions"><a class="btn" href="#/networth/update">Update balances</a><button class="btn primary" data-quick-add>+ Add expense</button></div></div>
    <div class="stats big">
      ${stat('Spent this month', money(s.spent), { sub: vsPrev != null ? html`<span class="${vsPrev > 0 ? 'neg' : 'pos'}">${pct(vsPrev, 0, { sign: true })}</span> vs last month at this point` : `${s.count} transactions` })}
      ${s.budget ? stat('Left in budget', money(s.left), { cls: s.left < 0 ? 'neg' : 'pos', sub: s.safeToday != null ? html`<b>${money(s.safeToday)}</b> safe to spend per day` : '' }) : stat('Today', money(todaySpent), { sub: html`<a href="#/spending/budgets">set a budget</a> for a daily limit` })}
      ${stat('Saved this month', s.income ? money(s.saved, { sign: true }) : '—', { cls: s.income ? pnlClass(s.saved) : '', sub: s.income ? `${pct(s.rate, 0)} of ${money(s.income)} income` : 'log your income to see it' })}
      ${stat('Net worth', cur ? money(cur.net) : '—', { sub: cur && prev ? html`<span class="${pnlClass(cur.net - prev.net)}">${money(cur.net - prev.net, { sign: true })}</span> since ${fmtDate(prev.date, { month: 'short', day: 'numeric' })}` : html`<a href="#/networth/accounts">add accounts</a>` })}
    </div>
    ${yieldCard() ? html`<div class="mt">${yieldCard()}</div>` : ''}
    <div class="grid g-2-1 mt">
      <div class="card"><div class="card-head"><h2>This month</h2><a class="hint" href="#/spending">Spending →</a></div>${s.spent ? html`<div class="chart"><canvas id="o-pace"></canvas></div>` : html`<p class="muted small">Nothing spent yet this month.</p>`}</div>
      <div class="card"><div class="card-head"><h2>Today</h2><span class="hint">${todo.filter(x => x[0]).length}/${todo.length} done</span></div>
        <div class="stack" style="gap:6px">${todo.map(([done, label, href]) => html`<a class="todo ${done ? 'done' : ''}" href="${href}"><span class="box">${done ? '✓' : ''}</span>${label}</a>`)}</div>
        ${up.length ? html`<h3 class="mt">Coming up</h3><div class="upcoming col">${up.map(u => html`<div class="up-item"><span class="muted small">${fmtDate(u.date, { weekday: 'short', day: 'numeric' })}</span><span>${u.r.name}</span><b class="${u.type === 'income' ? 'pos' : ''}">${money(u.value)}</b></div>`)}</div>` : ''}
      </div>
    </div>
    <div class="grid g3 mt">
      <div class="card"><div class="card-head"><h2>Top categories</h2><span class="hint">this month</span></div>${cats.length ? html`<dl class="kv">${cats.map(c => html`<dt>${catLabel(c.id)}</dt><dd>${money(c.total)}</dd>`)}</dl>` : html`<p class="muted small">—</p>`}</div>
      <div class="card" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><h2>Recent</h2><a class="hint" href="#/spending/transactions">All →</a></div>
        ${recent.length ? html`<div class="txn-list flat" style="padding:0 8px 8px">${recent.map(t => html`<button class="txn" data-id="${t.id}"><span class="txn-ic" style="background:${C.alpha(catColor(t.category, C.palette()), 0.16)}">${catById(t.category).emoji || '•'}</span><span class="txn-main"><b>${t.note || t.merchant || catById(t.category).name}</b><span class="small muted">${fmtDate(t.date, { month: 'short', day: 'numeric' })} · ${catById(t.category).name}</span></span><span class="txn-amt">${t.type === 'income' ? html`<span class="pos">+${moneyIn(+t.amount, ccyOf(t))}</span>` : moneyIn(-t.amount, ccyOf(t))}</span></button>`)}</div>` : html`<p class="muted small" style="padding:0 16px 16px">No transactions yet.</p>`}</div>
      <div class="card"><div class="card-head"><h2>Net worth</h2><a class="hint" href="#/networth">Details →</a></div>${series.length > 1 ? html`<div class="chart"><canvas id="o-nw"></canvas></div>` : html`<p class="muted small">Update balances on two or more dates to see the trend.</p>`}
</div>
    </div>`);

  el.querySelectorAll('.txn').forEach(b => b.onclick = async () => { if (await txnModal(store.get('txns', b.dataset.id))) refresh(); });
  const p = C.palette();
  if (s.spent) {
    let c1 = 0; const n = s.n;
    C.moneyLine(el.querySelector('#o-pace'), { labels: Array.from({ length: n }, (_, i) => String(i + 1)), zero: true,
      series: [{ label: 'Spent', data: s.daily.map((v, i) => (i < s.dayNow ? (c1 += v) : null)), color: p.accent, fill: true }, ...(s.budget ? [{ label: 'Budget pace', data: s.daily.map((_, i) => (s.budget * (i + 1)) / n), color: p.neg, dash: [2, 3] }] : [])] });
  }
  if (series.length > 1) C.moneyLine(el.querySelector('#o-nw'), { labels: series.map(x => fmtDate(x.date, { month: 'short', year: '2-digit' })), series: [{ label: 'Net worth', data: series.map(x => x.net), color: p.series[0], fill: true }] });
  const tick = startTicker(el);
  return () => clearInterval(tick);
}
