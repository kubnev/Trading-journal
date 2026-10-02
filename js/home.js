// Overview: the one page to open every day.
import * as store from './store.js';
import { html, raw, money, pct, num, pnlClass, stat, fmtDate, today, price, rmult } from './ui.js';
import * as C from './charts.js';
import { computedTrades, stats, filterTrades, openBook, startingCapital } from './trading/calc.js';
import { nwSeries, ASSET_CATS } from './networth/calc.js';
import { yieldCard, startTicker } from './networth/views.js';
import { streaks, MOODS } from './journal/views.js';
import { loadDemo } from './demo.js';
import { refresh } from './main.js';
import { startTour } from './help.js';

export default async function home(el) {
  const own = c => store.all(c).length;
  const hasAny = own('trades') || own('nwAccounts') || own('days');
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (!hasAny) {
    el.innerHTML = String(html`
      <section class="hero"><h1>${greet}.</h1>
        <p>This is your private place for <b>net worth</b>, a <b>daily journal</b> and <b>swing-trade</b> tracking. Everything stays in this browser — nothing is uploaded.</p></section>
      <div class="grid g3">
        <div class="choice"><h2>Take the tour</h2><p class="small muted">Two minutes, every part of the app.</p><button class="btn primary" data-tour-start>Start tour</button></div>
        <div class="choice"><h2>Explore with sample data</h2><p class="small muted">Realistic net worth history, journal entries and swing trades. Removable in one click.</p><button class="btn" data-demo>Load demo data</button></div>
        <div class="choice"><h2>Start for real</h2><p class="small muted">Add your accounts, then write today's check-in.</p><div class="row"><a class="btn" href="#/networth/accounts">Add accounts</a><a class="btn" href="#/journal">Journal</a></div></div>
      </div>
      <div class="grid g3 mt">
        <div class="card"><h3>Private by design</h3><p class="small muted">Stored in IndexedDB in this browser. No account, no server, no tracking.</p></div>
        <div class="card"><h3>Simple or Pro</h3><p class="small muted">One switch at the top of the sidebar. Simple keeps the essentials; Pro adds every field, report and chart.</p></div>
        <div class="card"><h3>Need help?</h3><p class="small muted">The <b>?</b> button (top right, or press <kbd>?</kbd>) explains the page you're on.</p></div>
      </div>`);
    el.querySelector('[data-demo]').onclick = async () => { await loadDemo(); refresh(); };
    el.querySelector('[data-tour-start]').onclick = () => startTour();
    return;
  }

  const series = nwSeries();
  const cur = series.at(-1), prev = series.at(-2);
  const trades = computedTrades();
  const capital = startingCapital(null) + trades.filter(t => t.closed).reduce((s, t) => s + t.net, 0);
  const book = openBook(trades, capital);
  const month = stats(filterTrades(trades, { range: 'mtd' }));
  const ytd = stats(filterTrades(trades, { range: 'ytd' }));
  const j = store.get('days', today());
  const st = streaks();
  const lastSnap = [...store.all('nwSnapshots')].sort((a, b) => b.date.localeCompare(a.date))[0];
  const s = store.getSettings();
  const lessons = [...store.all('days')].filter(d => d.lesson).sort((a, b) => b.id.localeCompare(a.id)).slice(0, 3);
  const todo = [
    [!!j, 'Write today\'s check-in', '#/journal'],
    [!book.open.length || book.open.every(t => (t.updates || []).some(u => u.date === today()) || t.markAt?.slice(0, 10) === today()), 'Review open positions', '#/trading/positions'],
    [!!lastSnap && lastSnap.date.slice(0, 7) === today().slice(0, 7), 'Update balances this month', '#/networth/update'],
    [!!s.lastBackupAt && Date.now() - new Date(s.lastBackupAt) < 7 * 864e5, 'Back up (weekly)', '#/settings'],
  ];

  el.innerHTML = String(html`
    <div class="page-head"><div><h1>${greet}</h1><div class="sub">${fmtDate(today(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div></div>
      <div class="actions"><a class="btn" href="#/journal">${j ? 'Edit today\'s journal' : 'Write today\'s journal'}</a><a class="btn primary" href="#/networth/update">Update balances</a></div></div>
    <div class="stats big">
      ${stat('Net worth', cur ? money(cur.net) : '—', { sub: cur && prev ? html`<span class="${pnlClass(cur.net - prev.net)}">${money(cur.net - prev.net, { sign: true })}</span> since ${fmtDate(prev.date, { month: 'short', day: 'numeric' })}` : 'add accounts to start' })}
      ${stat('Liquid', cur ? money(cur.liquid) : '—', { sub: cur?.assets ? `${pct(cur.liquid / cur.assets, 0)} of assets` : '' })}
      ${stat('Open positions', book.open.length, { cls: '', sub: book.open.length ? html`${book.priced ? html`<span class="${pnlClass(book.unreal)}">${money(book.unreal, { sign: true })}</span> unrealised · ` : ''}heat ${pct(book.heatPct, 1)}` : 'flat' })}
      ${stat('Trading this month', money(month.net, { sign: true }), { cls: pnlClass(month.net), sub: `${month.n} closed · YTD ${money(ytd.net, { sign: true })}` })}
      ${stat('Journal', j ? (j.mood ? MOODS[j.mood - 1] + ' written' : 'written') : 'not yet', { sub: `${st.current}-day streak · best ${st.best}` })}
    </div>
    ${yieldCard() ? html`<div class="mt">${yieldCard()}</div>` : ''}
    <div class="grid g-2-1 mt">
      <div class="card"><div class="card-head"><h2>Net worth</h2><a class="hint" href="#/networth">Details →</a></div>${series.length > 1 ? html`<div class="chart"><canvas id="o-nw"></canvas></div>` : html`<p class="muted small">Update balances on two or more dates to see the trend.</p>`}</div>
      <div class="card"><div class="card-head"><h2>Today</h2><span class="hint">${todo.filter(x => x[0]).length}/${todo.length} done</span></div>
        <div class="stack" style="gap:6px">${todo.map(([done, label, href]) => html`<a class="todo ${done ? 'done' : ''}" href="${href}"><span class="box">${done ? '✓' : ''}</span>${label}</a>`)}</div>
        ${j?.intention ? html`<h3 class="mt">Intention</h3><p class="small">${j.intention}</p>` : ''}
      </div>
    </div>
    <div class="grid g2 mt">
      <div class="card" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><h2>Open positions</h2><a class="hint" href="#/trading/positions">Manage →</a></div>
        ${book.open.length ? html`<div class="table-wrap" style="border:0"><table class="data compact"><thead><tr><th>Symbol</th><th class="num">Days</th><th class="num">Entry</th><th class="num">Last</th><th class="num">P&L</th><th class="num">R</th></tr></thead><tbody>
          ${book.open.slice(0, 8).map(t => html`<tr class="click" data-href="#/trading/trade/${t.id}"><td><b>${t.symbol}</b> <span class="pill ${t.side}">${t.side === 'short' ? 'S' : 'L'}</span></td><td class="num">${Math.round(t.daysHeld)}</td><td class="num">${price(t.avgEntry)}</td><td class="num">${price(t.mark)}</td><td class="num ${pnlClass(t.unreal)}">${t.unreal != null ? money(t.unreal, { sign: true }) : '—'}</td><td class="num ${pnlClass(t.unrealR)}">${rmult(t.unrealR)}</td></tr>`)}
        </tbody></table></div>` : html`<p class="muted small" style="padding:0 16px 16px">No open positions.</p>`}</div>
      <div class="card"><div class="card-head"><h2>Allocation</h2></div>${cur && cur.assets > 0 ? html`<div class="chart"><canvas id="o-alloc"></canvas></div>` : html`<p class="muted small">Add net-worth accounts and update their balances to see how your money is split.</p>`}</div>
    </div>
    ${lessons.length ? html`<div class="card mt"><div class="card-head"><h2>Recent lessons</h2><a class="hint" href="#/journal/insights">Insights →</a></div>${lessons.map(d => html`<div class="small" style="padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">${fmtDate(d.id, { month: 'short', day: 'numeric' })}</span> — ${d.lesson}</div>`)}</div>` : ''}`);

  el.addEventListener('click', e => { const tr = e.target.closest('tr[data-href]'); if (tr) location.hash = tr.dataset.href; });
  const p = C.palette();
  if (series.length > 1) C.moneyLine(el.querySelector('#o-nw'), { labels: series.map(x => fmtDate(x.date, { month: 'short', year: '2-digit' })), series: [{ label: 'Net worth', data: series.map(x => x.net), color: p.accent, fill: true }] });
  if (cur && cur.assets > 0) {
    const cats = ASSET_CATS.filter(c => (cur.byCat[c.id] || 0) > 0);
    C.doughnut(el.querySelector('#o-alloc'), { labels: cats.map(c => c.label), values: cats.map(c => cur.byCat[c.id]), colors: cats.map(c => p.series[ASSET_CATS.indexOf(c) % 8]), center: { value: money(cur.assets, { compact: true }), label: 'assets' } });
  }
  const tick = startTicker(el);
  return () => clearInterval(tick);
}
