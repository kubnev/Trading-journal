import { all } from './store.js';
import { html, money, pnlClass, pct } from './ui.js';
import { computedTrades, stats, filterTrades } from './trading/calc.js';
import { nwSeries } from './networth/calc.js';
import { loadDemo } from './demo.js';
import { refresh } from './main.js';

export default async function home(el) {
  const trades = computedTrades();
  const month = stats(filterTrades(trades, { range: 'mtd' }));
  const ser = nwSeries();
  const lastNW = ser.at(-1), prevNW = ser.at(-2);
  const hasAny = all('trades').length || all('nwAccounts').length;

  el.innerHTML = String(html`
    <section class="hero">
      <h1>Your trading journal & net worth, in one private place.</h1>
      <p>Log trades, review your edge, and track everything you own and owe. Nothing is uploaded — every entry is stored in this browser only. Export a backup from <a href="#/settings">Settings & data</a> whenever you like.</p>
    </section>
    <div class="grid g2">
      <a class="choice" href="#/trading">
        <h2>Trading journal</h2>
        <ul>
          <li>Trades with scale-in/out executions, fees, stops, R-multiples</li>
          <li>Equity curve, drawdown, calendar, P&L by setup / time / symbol</li>
          <li>Playbook, mistakes & emotions tracking, daily pre/post-market journal</li>
          <li>MAE / MFE, expectancy, profit factor, SQN, Sharpe & more (Pro)</li>
        </ul>
        ${trades.length ? html`<div class="mini"><div><b class="${pnlClass(month.net)}">${money(month.net, { sign: true })}</b>this month</div><div><b>${month.n}</b>trades this month</div><div><b>${month.winRate == null ? '—' : pct(month.winRate, 0)}</b>win rate</div></div>` : ''}
        <span class="go">Open journal →</span>
      </a>
      <a class="choice" href="#/networth">
        <h2>Net worth</h2>
        <ul>
          <li>Assets & liabilities with monthly balance snapshots</li>
          <li>Net worth over time, allocation, liquid vs. illiquid, debt breakdown</li>
          <li>Savings rate and cash flow; growth split into savings vs. market (Pro)</li>
          <li>FI number, years to financial independence, Coast FI (Pro)</li>
        </ul>
        ${lastNW ? html`<div class="mini"><div><b>${money(lastNW.net)}</b>net worth</div>${prevNW ? html`<div><b class="${pnlClass(lastNW.net - prevNW.net)}">${money(lastNW.net - prevNW.net, { sign: true })}</b>since last update</div>` : ''}</div>` : ''}
        <span class="go">Open net worth →</span>
      </a>
    </div>
    ${!hasAny ? html`<div class="card mt"><div class="row"><div><h2>Want to look around first?</h2><p class="muted small" style="margin:4px 0 0">Load realistic sample data into both sections. It is tagged as demo data and can be removed in one click from Settings.</p></div><span class="spacer"></span><button class="btn primary" data-demo>Load demo data</button></div></div>` : ''}
    <div class="grid g3 mt">
      <div class="card"><h3>Private by design</h3><p class="small muted">Stored in IndexedDB in this browser. No account, no server, no tracking. Other visitors of this site see only their own data.</p></div>
      <div class="card"><h3>Simple or Pro</h3><p class="small muted">Each section has a Simple / Pro switch in the sidebar. Simple keeps the essentials; Pro unlocks every field, report and chart. Your data is the same either way.</p></div>
      <div class="card"><h3>Back it up</h3><p class="small muted">Browser storage can be cleared. Export a JSON backup regularly — it restores everything, screenshots included.</p></div>
    </div>`);
  el.querySelector('[data-demo]')?.addEventListener('click', async () => { await loadDemo(); refresh(); });
}
