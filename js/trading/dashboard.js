import { all } from '../store.js';
import { html, money, pct, num, rmult, pnlClass, stat, fmtDate } from '../ui.js';
import * as C from '../charts.js';
import { stats, groupBy, rHistogram, holdBucket, monthlyTable, openBook } from './calc.js';
import { filterBar, filtered, tradeRow, tradeHead, wireRowLinks, emptyTrades, setupName } from './common.js';
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
  const hb = groupBy(trades, t => holdBucket(t.holdMs)).filter(g => g.count >= 3).sort((a, b) => b.expectancy - a.expectancy);
  if (hb.length > 1) out.push({ kind: 'good', text: html`Your sweet spot: trades held <b>${hb[0].key}</b> average ${money(hb[0].expectancy, { sign: true })} (${rmult(hb[0].avgR)}) over ${hb[0].count} trades.` });
  const er = groupBy(trades, t => t.exitReason || null).filter(g => g.count >= 3).sort((a, b) => a.expectancy - b.expectancy);
  if (er.length > 1 && er[0].net < 0) out.push({ kind: 'warn', text: html`Exits tagged <b>${er[0].key}</b> cost ${money(er[0].net, { sign: true })} over ${er[0].count} trades.` });
  const side = groupBy(trades, t => t.side);
  if (side.length === 2) { const [a, b] = side.sort((x, y) => y.expectancy - x.expectancy); if (a.expectancy > 0 && b.expectancy < 0) out.push({ kind: 'warn', text: html`Your ${a.key}s make ${money(a.expectancy, { sign: true })}/trade; your ${b.key}s lose ${money(b.expectancy)}/trade.` }); }
  if (s.daysW && s.daysL && s.daysL > s.daysW * 1.5) out.push({ kind: 'warn', text: html`You hold losers ${num(s.daysL / s.daysW, 1)}× longer than winners (${num(s.daysL, 1)} vs ${num(s.daysW, 1)} days) — cut losers faster.` });
  if (s.adherence != null && s.adherence < 0.75) out.push({ kind: 'bad', text: html`Plan followed on only ${pct(s.adherence, 0)} of rated trades — this is an execution problem, not a strategy problem.` });
  if (s.avgCapture != null && s.avgCapture < 0.4) out.push({ kind: 'warn', text: html`On winners you keep only ${pct(s.avgCapture, 0)} of the best available move — you're leaving most of the favourable move on the table.` });
  return out;
}

export async function dashboard(el, _p, { mode }) {
  const pro = mode === 'pro';
  el.innerHTML = String(html`
    <div class="page-head"><div><h1>Performance</h1><div class="sub">How your swing trading is doing — edge, risk and consistency.</div></div>
      <div class="actions"><a class="btn" href="#/trading/positions">Open positions</a><a class="btn primary" href="#/trading/new">+ New trade</a></div></div>
    <div id="fb"></div><div id="body"></div>`);
  const body = el.querySelector('#body');

  const draw = () => {
    C.destroyAll();
    const { trades, capital } = filtered();
    if (!all('trades').length) { body.innerHTML = String(emptyTrades()); body.querySelector('[data-demo]').onclick = async () => { await loadDemo(); refresh(); }; return; }
    const s = stats(trades, { capital });
    const closed = trades.filter(t => t.closed).sort((a, b) => a.closeDate.localeCompare(b.closeDate));
    const book = openBook(trades, capital + s.net);
    const recent = [...trades].sort((a, b) => (b.closeDate || b.openDate || '').localeCompare(a.closeDate || a.openDate || '')).slice(0, 8);
    const ins = pro ? insights(trades, s) : [];
    const months = monthlyTable(closed).flatMap(y => y.months.map((v, i) => ({ k: `${y.year}-${String(i + 1).padStart(2, '0')}`, v }))).filter(m => m.v != null).sort((a, b) => a.k.localeCompare(b.k)).slice(-18);
    const winBar = s.n ? html`<div class="meter"><span style="width:${(s.wins / s.n) * 100}%;background:var(--pnl-pos)"></span><span style="width:${(s.bes / s.n) * 100}%;background:var(--neutral)"></span><span style="width:${(s.losses / s.n) * 100}%;background:var(--pnl-neg)"></span></div>` : '';
    const pf = s.profitFactor === Infinity ? '∞' : num(s.profitFactor);
    const monthsSpan = closed.length ? Math.max(1, (new Date(closed.at(-1).closeDate) - new Date(closed[0].openDate)) / (30.44 * 864e5)) : null;

    body.innerHTML = String(html`
      <div class="stats big">
        ${stat('Net P&L', money(s.net, { sign: true }), { cls: pnlClass(s.net), sub: capital > 0 ? `${pct(s.net / capital, 1, { sign: true })} on capital` : `${s.n} closed trades` })}
        <div class="stat"><div class="stat-label">Win rate</div><div class="stat-value">${pct(s.winRate, 0)}</div>${winBar}<div class="stat-sub">${s.wins}W · ${s.losses}L${s.bes ? ` · ${s.bes}BE` : ''}</div></div>
        ${stat('Avg R per trade', rmult(s.avgR), { cls: pnlClass(s.avgR), sub: `expectancy ${money(s.expectancy, { sign: true })}`, help: 'Average R-multiple: net result ÷ initial risk. Above +0.3R over 30+ trades suggests a real edge.' })}
        ${stat('Profit factor', pf, { sub: `avg win ${rmult(s.avgWinR)} · loss ${rmult(s.avgLossR)}`, help: 'Gross profit ÷ gross loss. Above 1.5 is solid, above 2 strong.' })}
        ${stat('Avg hold', s.daysAll != null ? `${num(s.daysAll, 1)} d` : '—', { sub: `winners ${num(s.daysW, 1)}d · losers ${num(s.daysL, 1)}d` })}
        ${stat('Open', `${book.open.length}`, { sub: book.unreal ? `${money(book.unreal, { sign: true })} unrealised` : book.open.length ? 'refresh prices on Positions' : 'no open positions' })}
      </div>
      ${pro ? html`<div class="stats mt">
        ${stat('Max drawdown', money(s.maxDD), { cls: s.maxDD < 0 ? 'neg' : '', sub: s.maxDDPct != null ? pct(s.maxDDPct, 1) + ' of capital' : 'on closed P&L' })}
        ${stat('Trades / month', monthsSpan ? num(s.n / monthsSpan, 1) : '—')}
        ${stat('Total R', rmult(s.totalR, 1), { cls: pnlClass(s.totalR) })}
        ${stat('SQN', num(s.sqn), { sub: s.sqn == null ? '' : s.sqn >= 3 ? 'excellent' : s.sqn >= 2 ? 'good' : s.sqn >= 1.6 ? 'average' : 'below average', help: 'System Quality Number: √N × mean R ÷ stdev R. Needs 30+ trades to mean much.' })}
        ${stat('Largest win / loss', `${rmult(Math.max(...closed.map(t => t.r ?? -Infinity)), 1)} / ${rmult(Math.min(...closed.map(t => t.r ?? Infinity)), 1)}`)}
        ${stat('Plan followed', pct(s.adherence, 0), { cls: s.adherence != null && s.adherence < 0.75 ? 'neg' : '' })}
        ${stat('Portfolio heat', book.heatPct != null ? pct(book.heatPct, 1) : '—', { sub: 'open risk ÷ capital' })}
      </div>` : ''}
      <div class="grid g-2-1 mt">
        <div class="card"><div class="card-head"><h2>Equity curve</h2><span class="hint">cumulative net P&L by closed trade</span></div><div class="chart tall"><canvas id="c-eq"></canvas></div></div>
        ${pro && ins.length ? html`<div class="card"><div class="card-head"><h2>Insights</h2><span class="hint">from filtered trades</span></div><div class="callout-list">${ins.slice(0, 6).map(i => html`<div class="callout ${i.kind}"><span class="ic">${i.kind === 'good' ? '▲' : i.kind === 'bad' ? '▼' : '!'}</span><div>${i.text}</div></div>`)}</div></div>`
          : html`<div class="card"><div class="card-head"><h2>Monthly P&L</h2></div><div class="chart tall"><canvas id="c-mon"></canvas></div></div>`}
      </div>
      ${pro ? html`<div class="grid g2 mt">
        <div class="card"><div class="card-head"><h2>Monthly P&L</h2><span class="hint">last 18 months</span></div><div class="chart"><canvas id="c-mon"></canvas></div></div>
        <div class="card"><div class="card-head"><h2>R vs days held</h2><span class="hint">where your edge lives</span></div><div class="chart"><canvas id="c-hold"></canvas></div></div>
      </div>
      <div class="grid g2 mt">
        <div class="card"><div class="card-head"><h2>P&L by setup</h2><a class="hint" href="#/trading/reports">All reports →</a></div><div class="chart"><canvas id="c-setup"></canvas></div></div>
        <div class="card"><div class="card-head"><h2>R-multiple distribution</h2></div><div class="chart"><canvas id="c-rdist"></canvas></div></div>
      </div>` : ''}
      <div class="card mt" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><h2>Recent trades</h2><a class="hint" href="#/trading/trades">Trade log →</a></div>
        <div class="table-wrap" style="border:0"><table class="data"><thead>${tradeHead(pro)}</thead><tbody>${recent.map(t => tradeRow(t, { pro }))}</tbody></table></div></div>`);
    wireRowLinks(body);

    const p = C.palette();
    C.moneyLine(body.querySelector('#c-eq'), {
      labels: ['Start', ...closed.map(t => fmtDate(t.closeDate, { month: 'short', day: 'numeric', year: '2-digit' }))],
      series: [{ label: 'Equity', data: [0, ...s.equity], color: p.accent, fill: true }],
    });
    C.signBars(body.querySelector('#c-mon'), { labels: months.map(m => fmtDate(m.k + '-01', { month: 'short', year: '2-digit' })), values: months.map(m => m.v) });
    if (pro) {
      C.scatter(body.querySelector('#c-hold'), {
        groups: [{ label: 'Winners', color: p.pos, points: closed.filter(t => t.r != null && t.r > 0).map(t => ({ x: t.daysHeld, y: t.r, t })) }, { label: 'Losers', color: p.neg, points: closed.filter(t => t.r != null && t.r <= 0).map(t => ({ x: t.daysHeld, y: t.r, t })) }],
        xLabel: 'Days held', yLabel: 'R', fmtX: v => num(v, 0), fmtY: v => num(v, 1), tip: r => `${r.t.symbol}: ${rmult(r.y)} in ${num(r.x, 1)} days`, refLines: [{ y: 0 }],
      });
      const g = groupBy(trades, t => setupName(t.setupId)).sort((a, b) => b.net - a.net);
      C.signBars(body.querySelector('#c-setup'), { labels: g.map(x => x.key), values: g.map(x => x.net), horizontal: true, extraTooltip: i => `${g[i].count} trades · ${pct(g[i].winRate, 0)} win · ${rmult(g[i].avgR)}` });
      const h = rHistogram(closed);
      C.plainBars(body.querySelector('#c-rdist'), { labels: h.labels, values: h.counts, colors: h.mids.map(m => (m >= 0 ? p.pos : p.neg)), label: 'Trades' });
    }
  };
  filterBar(el.querySelector('#fb'), draw, { pro });
  draw();
}
