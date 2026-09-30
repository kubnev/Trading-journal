import { all } from '../store.js';
import { html, raw, money, pct, num, rmult, pnlClass, stat, fmtDate, duration } from '../ui.js';
import * as C from '../charts.js';
import { stats, groupBy, rHistogram, DOW } from './calc.js';
import { filterBar, filtered, tradeRow, wireRowLinks, emptyTrades, setupName } from './common.js';
import { loadDemo } from '../demo.js';
import { refresh } from '../main.js';

export function insights(trades, s) {
  const out = [];
  if (s.n < 5) return out;
  const bySetup = groupBy(trades, t => t.setupId ? setupName(t.setupId) : null).filter(g => g.count >= 3).sort((a, b) => b.net - a.net);
  if (bySetup.length > 1) {
    out.push({ kind: 'good', text: html`Best setup: <b>${bySetup[0].key}</b> — ${money(bySetup[0].net, { sign: true })} over ${bySetup[0].count} trades (${pct(bySetup[0].winRate, 0)} win rate).` });
    const w = bySetup.at(-1);
    if (w.net < 0) out.push({ kind: 'bad', text: html`Weakest setup: <b>${w.key}</b> — ${money(w.net, { sign: true })} over ${w.count} trades. Consider cutting size or dropping it.` });
  }
  const mist = groupBy(trades, t => t.mistakes || []).sort((a, b) => a.net - b.net);
  if (mist.length && mist[0].net < 0) out.push({ kind: 'bad', text: html`Costliest mistake: <b>${mist[0].key}</b> — ${money(mist[0].net, { sign: true })} across ${mist[0].count} trades.` });
  const clean = trades.filter(t => t.closed && !(t.mistakes || []).length), dirty = trades.filter(t => t.closed && (t.mistakes || []).length);
  if (clean.length >= 3 && dirty.length >= 3) {
    const e1 = clean.reduce((a, t) => a + t.net, 0) / clean.length, e2 = dirty.reduce((a, t) => a + t.net, 0) / dirty.length;
    out.push({ kind: e1 > e2 ? 'good' : 'warn', text: html`Trades without mistakes average <b>${money(e1, { sign: true })}</b> vs <b>${money(e2, { sign: true })}</b> with mistakes.` });
  }
  const dow = groupBy(trades, t => DOW[new Date(t.closeDate).getDay()]).filter(g => g.count >= 3).sort((a, b) => a.net - b.net);
  if (dow.length > 2 && dow[0].net < 0) out.push({ kind: 'warn', text: html`<b>${dow[0].key}</b> is your worst day: ${money(dow[0].net, { sign: true })} over ${dow[0].count} trades.` });
  const side = groupBy(trades, t => t.side);
  if (side.length === 2) { const [a, b] = side.sort((x, y) => y.expectancy - x.expectancy); if (a.expectancy > 0 && b.expectancy < 0) out.push({ kind: 'warn', text: html`Your ${a.key}s make ${money(a.expectancy, { sign: true })}/trade; your ${b.key}s lose ${money(b.expectancy)}/trade.` }); }
  if (s.holdW && s.holdL && s.holdL > s.holdW * 1.5) out.push({ kind: 'warn', text: html`You hold losers ${num(s.holdL / s.holdW, 1)}× longer than winners (${duration(s.holdL)} vs ${duration(s.holdW)}).` });
  if (s.adherence != null && s.adherence < 0.75) out.push({ kind: 'bad', text: html`Plan followed on only ${pct(s.adherence, 0)} of rated trades — this is an execution problem, not a strategy problem.` });
  if (s.avgCapture != null && s.avgCapture < 0.4) out.push({ kind: 'warn', text: html`On winners you keep only ${pct(s.avgCapture, 0)} of the best available move — you're leaving most of the favourable move on the table.` });
  return out;
}

export async function dashboard(el, _p, { mode }) {
  const pro = mode === 'pro';
  el.innerHTML = String(html`
    <div class="page-head"><div><h1>Trading dashboard</h1><div class="sub">${pro ? 'Pro view — full performance picture' : 'Simple view — switch to Pro in the sidebar for deeper analytics'}</div></div>
      <div class="actions"><a class="btn" href="#/trading/journal">Today's journal</a><a class="btn primary" href="#/trading/new">+ New trade</a></div></div>
    <div id="fb"></div><div id="body"></div>`);
  const body = el.querySelector('#body');

  const draw = () => {
    C.destroyAll();
    const { trades, capital } = filtered();
    if (!all('trades').length) { body.innerHTML = String(emptyTrades()); body.querySelector('[data-demo]').onclick = async () => { await loadDemo(); refresh(); }; return; }
    const s = stats(trades, { capital });
    const closed = trades.filter(t => t.closed).sort((a, b) => a.closeDate.localeCompare(b.closeDate));
    const recent = [...trades].sort((a, b) => (b.closeDate || b.openDate || '').localeCompare(a.closeDate || a.openDate || '')).slice(0, 8);
    const ins = pro ? insights(trades, s) : [];
    const winBar = s.n ? html`<div class="meter"><span style="width:${(s.wins / s.n) * 100}%;background:var(--pnl-pos)"></span><span style="width:${(s.bes / s.n) * 100}%;background:var(--neutral)"></span><span style="width:${(s.losses / s.n) * 100}%;background:var(--pnl-neg)"></span></div>` : '';
    const pf = s.profitFactor === Infinity ? '∞' : num(s.profitFactor);

    body.innerHTML = String(html`
      <div class="stats big">
        ${stat('Net P&L', money(s.net, { sign: true }), { cls: pnlClass(s.net), sub: `${s.n} closed trades${s.open ? ` · ${s.open} open` : ''}` })}
        <div class="stat"><div class="stat-label">Win rate</div><div class="stat-value">${pct(s.winRate, 1)}</div>${winBar}<div class="stat-sub">${s.wins}W · ${s.losses}L${s.bes ? ` · ${s.bes}BE` : ''}</div></div>
        ${stat('Profit factor', pf, { sub: 'gross profit ÷ gross loss', help: 'Gross profit divided by gross loss. Above 1.5 is solid, above 2 is strong.' })}
        ${stat('Expectancy', money(s.expectancy, { sign: true }), { cls: pnlClass(s.expectancy), sub: s.avgR != null ? `${rmult(s.avgR)} per trade` : 'per trade', help: 'Average net result per trade. What you expect to make each time you take a trade.' })}
        ${stat('Avg win / avg loss', s.payoff != null ? num(s.payoff) : '—', { sub: `${money(s.avgWin)} / ${money(s.avgLoss)}`, help: 'Payoff ratio: average winner divided by average loser.' })}
        ${stat(pro ? 'Max drawdown' : 'Day win rate', pro ? money(s.maxDD) : pct(s.dayWinRate, 0), { cls: pro ? (s.maxDD < 0 ? 'neg' : '') : '', sub: pro ? (s.maxDDPct != null ? pct(s.maxDDPct, 1) + ' of equity' : 'peak-to-trough on closed P&L') : `${s.greenDays} green · ${s.redDays} red days` })}
      </div>
      ${pro ? html`<div class="stats mt">
        ${stat('Avg R', rmult(s.avgR), { cls: pnlClass(s.avgR), sub: `${s.rCount} trades with a stop`, help: 'Mean R-multiple: net result divided by initial risk (entry to stop).' })}
        ${stat('Total R', rmult(s.totalR, 1), { cls: pnlClass(s.totalR) })}
        ${stat('SQN', num(s.sqn), { sub: s.sqn == null ? '' : s.sqn >= 3 ? 'excellent' : s.sqn >= 2 ? 'good' : s.sqn >= 1.6 ? 'average' : 'below average', help: 'Van Tharp System Quality Number: √N × mean R ÷ stdev R (N capped at 100).' })}
        ${stat('Sharpe (daily)', num(s.sharpe), { help: 'Mean daily P&L ÷ stdev of daily P&L × √252. P&L-based, risk-free rate ignored.' })}
        ${stat('Sortino', num(s.sortino), { help: 'Like Sharpe but only penalises downside days.' })}
        ${stat('Recovery factor', num(s.recovery), { help: 'Net profit ÷ max drawdown.' })}
        ${stat('Plan followed', pct(s.adherence, 0), { cls: s.adherence != null && s.adherence < 0.75 ? 'neg' : '', help: 'Share of trades marked as following your plan.' })}
        ${stat('Streak', s.curStreak ? `${Math.abs(s.curStreak)} ${s.curStreak > 0 ? 'W' : 'L'}` : '—', { sub: `max ${s.maxConsecWins}W / ${s.maxConsecLosses}L` })}
      </div>` : ''}

      <div class="grid g-2-1 mt">
        <div class="card"><div class="card-head"><h2>Equity curve</h2><span class="hint">cumulative net P&L</span></div><div class="chart tall"><canvas id="c-eq"></canvas></div></div>
        ${pro && ins.length ? html`<div class="card"><div class="card-head"><h2>Insights</h2><span class="hint">from filtered trades</span></div><div class="callout-list">${ins.slice(0, 6).map(i => html`<div class="callout ${i.kind}"><span class="ic">${i.kind === 'good' ? '▲' : i.kind === 'bad' ? '▼' : '!'}</span><div>${i.text}</div></div>`)}</div></div>`
                            : html`<div class="card"><div class="card-head"><h2>Daily P&L</h2><span class="hint">last 30 trading days</span></div><div class="chart tall"><canvas id="c-daily"></canvas></div></div>`}
      </div>
      ${pro ? html`<div class="grid g2 mt">
        <div class="card"><div class="card-head"><h2>Drawdown</h2><span class="hint">distance below equity peak</span></div><div class="chart short"><canvas id="c-dd"></canvas></div></div>
        <div class="card"><div class="card-head"><h2>Daily P&L</h2><span class="hint">last 30 trading days</span></div><div class="chart short"><canvas id="c-daily"></canvas></div></div>
      </div>
      <div class="grid g2 mt">
        <div class="card"><div class="card-head"><h2>P&L by setup</h2><a class="hint" href="#/trading/reports">All reports →</a></div><div class="chart"><canvas id="c-setup"></canvas></div></div>
        <div class="card"><div class="card-head"><h2>R-multiple distribution</h2><span class="hint">trades per bucket</span></div><div class="chart"><canvas id="c-rdist"></canvas></div></div>
      </div>` : ''}
      <div class="card mt" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><h2>Recent trades</h2><a class="hint" href="#/trading/trades">View all →</a></div>
        <div class="table-wrap" style="border:0"><table class="data"><thead><tr><th>Date</th><th>Symbol</th><th>Side</th>${pro ? raw('<th>Setup</th>') : ''}<th class="num">Qty</th><th class="num">Entry</th><th class="num">Exit</th><th class="num">Net P&L</th><th class="num">R</th>${pro ? raw('<th>Grade</th><th>Mistakes</th>') : ''}</tr></thead>
        <tbody>${recent.map(t => tradeRow(t, { pro }))}</tbody></table></div></div>`);
    wireRowLinks(body);

    const p = C.palette();
    const labels = closed.map(t => fmtDate(t.closeDate, { month: 'short', day: 'numeric' }));
    C.moneyLine(body.querySelector('#c-eq'), {
      labels: ['Start', ...labels],
      series: [{ label: 'Equity', data: [0, ...s.equity], color: p.accent, fill: true, segment: { borderColor: ctx => (ctx.p1.parsed.y >= 0 ? p.accent : p.neg) } }],
    });
    const days = s.days.slice(-30);
    C.signBars(body.querySelector('#c-daily'), { labels: days.map(d => fmtDate(d.day, { month: 'short', day: 'numeric' })), values: days.map(d => d.net), extraTooltip: i => `${days[i].count} trades` });
    if (pro) {
      C.moneyLine(body.querySelector('#c-dd'), { labels: ['Start', ...labels], series: [{ label: 'Drawdown', data: [0, ...s.dd], color: p.neg, fill: C.alpha(p.neg, 0.15) }], yExtra: { max: 0 } });
      const g = groupBy(trades, t => setupName(t.setupId)).sort((a, b) => b.net - a.net);
      C.signBars(body.querySelector('#c-setup'), { labels: g.map(x => x.key), values: g.map(x => x.net), horizontal: true, extraTooltip: i => `${g[i].count} trades · ${pct(g[i].winRate, 0)} win · ${rmult(g[i].avgR)}` });
      const h = rHistogram(closed);
      C.plainBars(body.querySelector('#c-rdist'), { labels: h.labels, values: h.counts, colors: h.mids.map(m => (m >= 0 ? p.pos : p.neg)), label: 'Trades' });
    }
  };
  filterBar(el.querySelector('#fb'), draw, { pro });
  draw();
}
