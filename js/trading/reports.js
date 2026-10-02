import { html, raw, money, pct, num, rmult, pnlClass, fmtDate, stat } from '../ui.js';
import * as C from '../charts.js';
import { stats, groupBy, rHistogram, rolling, monthlyTable, holdBucket, HOLD_ORDER, DOW, assetLabel, GRADES } from './calc.js';
import { filterBar, filtered, setupName, accountName } from './common.js';
import { all } from '../store.js';

const TABS = [['overview', 'Overview'], ['time', 'Timing'], ['setups', 'Setups & instruments'], ['risk', 'Risk & execution'], ['psych', 'Psychology & discipline']];
let tab = 'overview';

function groupTable(rows, keyLabel, { sortBy = 'net' } = {}) {
  if (!rows.length) return html`<p class="muted small">No data.</p>`;
  const r = sortBy ? [...rows].sort((a, b) => b[sortBy] - a[sortBy]) : rows;
  const pf = v => (v === Infinity ? '∞' : num(v));
  return html`<div class="table-wrap"><table class="data compact"><thead><tr><th>${keyLabel}</th><th class="num">Trades</th><th class="num">Win %</th><th class="num">Net P&L</th><th class="num">Expectancy</th><th class="num">PF</th><th class="num">Avg R</th></tr></thead>
    <tbody>${r.map(g => html`<tr><td>${g.key}</td><td class="num">${g.count}</td><td class="num">${pct(g.winRate, 0)}</td><td class="num ${pnlClass(g.net)}">${money(g.net, { sign: true })}</td><td class="num ${pnlClass(g.expectancy)}">${money(g.expectancy, { sign: true })}</td><td class="num">${pf(g.pf)}</td><td class="num ${pnlClass(g.avgR)}">${rmult(g.avgR)}</td></tr>`)}</tbody></table></div>`;
}

const tip = g => i => `${g[i].count} trades · ${pct(g[i].winRate, 0)} win · exp ${money(g[i].expectancy, { sign: true })}`;
const card = (title, hint, id, cls = '') => html`<div class="card"><div class="card-head"><h2>${title}</h2>${hint ? html`<span class="hint">${hint}</span>` : ''}</div><div class="chart ${cls}"><canvas id="${id}"></canvas></div></div>`;

export async function reports(el, _p, { mode }) {
  el.innerHTML = String(html`
    <div class="page-head"><div><h1>Reports</h1><div class="sub">Slice your performance to find where the edge is — and where it leaks.</div></div></div>
    <div id="fb"></div>
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => html`<button role="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}" aria-selected="${tab === k}">${l}</button>`)}</div>
    <div id="body"></div>`);
  const body = el.querySelector('#body');
  el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; el.querySelectorAll('[data-tab]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); draw(); });

  const draw = () => {
    C.destroyAll();
    const { trades, capital } = filtered();
    const closed = trades.filter(t => t.closed).sort((a, b) => a.closeDate.localeCompare(b.closeDate));
    if (!closed.length) { body.innerHTML = String(html`<div class="empty"><div class="empty-title">No closed trades match these filters</div><p>Adjust the filters or log some trades.</p></div>`); return; }
    const s = stats(trades, { capital });
    const p = C.palette();
    const q = id => body.querySelector('#' + id);

    if (tab === 'overview') {
      const mt = monthlyTable(closed);
      const row = (k, v, cls = '') => html`<dt>${k}</dt><dd class="${cls}">${v}</dd>`;
      body.innerHTML = String(html`
        <div class="grid g-1-2">
          <div class="card"><div class="card-head"><h2>Summary statistics</h2></div><dl class="kv">
            ${row('Net P&L', money(s.net, { sign: true }), pnlClass(s.net))}${row('Gross profit', money(s.grossProfit))}${row('Gross loss', money(-s.grossLoss))}${row('Fees & commissions', money(s.fees))}
            ${row('Closed trades', s.n)}${row('Winners / losers / BE', `${s.wins} / ${s.losses} / ${s.bes}`)}${row('Win rate', pct(s.winRate, 1))}
            ${row('Average win', money(s.avgWin))}${row('Average loss', money(s.avgLoss ? -s.avgLoss : null))}${row('Payoff ratio', num(s.payoff))}
            ${row('Profit factor', s.profitFactor === Infinity ? '∞' : num(s.profitFactor))}${row('Expectancy / trade', money(s.expectancy, { sign: true }), pnlClass(s.expectancy))}
            ${row('Average R', rmult(s.avgR), pnlClass(s.avgR))}${row('Avg winner / loser R', `${rmult(s.avgWinR)} / ${rmult(s.avgLossR)}`)}${row('Std dev of R', num(s.sdR))}${row('SQN', num(s.sqn))}
            ${row('Largest win', money(s.largestWin))}${row('Largest loss', money(s.largestLoss))}
            ${row('Max drawdown', money(s.maxDD) + (s.maxDDPct != null ? ` (${pct(s.maxDDPct, 1)})` : ''), 'neg')}${row('Recovery factor', num(s.recovery))}
            ${row('Kelly %', pct(s.kelly, 1))}
            ${row('Max consecutive W / L', `${s.maxConsecWins} / ${s.maxConsecLosses}`)}
            ${row('Avg days held (all / W / L)', `${num(s.daysAll, 1)} / ${num(s.daysW, 1)} / ${num(s.daysL, 1)}`)}
          </dl><p class="small muted mt">Kelly % is the theoretical optimal risk fraction; most professionals use a quarter to half of it, if at all.</p></div>
          <div class="stack">
            ${card('Equity curve by day', 'cumulative net P&L', 'r-eq', 'tall')}
            <div class="card"><div class="card-head"><h2>Monthly returns</h2></div><div class="table-wrap"><table class="data heat compact"><thead><tr><th>Year</th>${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => html`<th class="num">${m}</th>`)}<th class="num">Total</th></tr></thead>
              <tbody>${mt.map(y => html`<tr><td><b>${y.year}</b></td>${y.months.map(v => html`<td class="${v == null ? 'muted' : pnlClass(v)}" ${v ? raw(`style="background:${C.alpha(v >= 0 ? p.pos : p.neg, 0.1)}"`) : ''}>${v == null ? '·' : money(v, { compact: true })}</td>`)}<td class="${pnlClass(y.total)}"><b>${money(y.total, { compact: true })}</b></td></tr>`)}</tbody></table></div></div>
          </div>
        </div>`);
      let cum = 0;
      C.moneyLine(q('r-eq'), { labels: s.days.map(d => fmtDate(d.day, { month: 'short', day: 'numeric', year: '2-digit' })), series: [{ label: 'Equity', data: s.days.map(d => (cum += d.net)), color: p.accent, fill: true }] });
    }

    if (tab === 'time') {
      const hold = HOLD_ORDER.map(k => groupBy(trades, t => holdBucket(t.holdMs)).find(g => g.key === k)).filter(Boolean);
      const mon = groupBy(trades, t => t.closeDate.slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key));
      const dowE = groupBy(trades, t => new Date(t.openDate).getDay());
      const dowRows = [1, 2, 3, 4, 5, 6, 0].map(d => dowE.find(g => g.key === d)).filter(Boolean).map(g => ({ ...g, key: DOW[g.key] }));
      const plan = closed.filter(t => t.plannedDays && t.daysHeld != null);
      const overstay = plan.filter(t => t.daysHeld > t.plannedDays * 1.5);
      body.innerHTML = String(html`
        <div class="stats">
          ${stat('Avg days held', num(s.daysAll, 1), { sub: `W ${num(s.daysW, 1)} · L ${num(s.daysL, 1)}` })}
          ${stat('Held past plan', plan.length ? `${overstay.length}/${plan.length}` : '—', { sub: overstay.length ? `avg ${rmult(overstay.reduce((a, t) => a + (t.r || 0), 0) / overstay.length)} on those` : 'trades with a planned hold', help: 'Trades held more than 1.5× their planned holding period.' })}
        </div>
        <div class="grid g2 mt">${card('Expectancy by holding period', 'avg net per trade', 'r-hold')}${card('Win rate by holding period', '', 'r-holdwr')}</div>
        <div class="grid g2 mt">${card('P&L by month', '', 'r-mon')}${card('P&L by entry weekday', '', 'r-dow')}</div>
        <div class="card mt"><div class="card-head"><h2>Holding period</h2></div>${groupTable(hold, 'Held', { sortBy: null })}</div>`);
      C.signBars(q('r-hold'), { labels: hold.map(g => g.key), values: hold.map(g => g.expectancy), extraTooltip: tip(hold) });
      C.plainBars(q('r-holdwr'), { labels: hold.map(g => g.key), values: hold.map(g => g.winRate * 100), fmt: v => num(v, 0) + '%', label: 'Win rate' });
      C.signBars(q('r-mon'), { labels: mon.map(g => g.key), values: mon.map(g => g.net), extraTooltip: tip(mon) });
      C.signBars(q('r-dow'), { labels: dowRows.map(g => g.key), values: dowRows.map(g => g.net), extraTooltip: tip(dowRows) });
    }

    if (tab === 'setups') {
      const su = groupBy(trades, t => setupName(t.setupId)).sort((a, b) => b.net - a.net);
      const sy = groupBy(trades, t => t.symbol).sort((a, b) => b.net - a.net);
      const syShown = sy.length > 16 ? [...sy.slice(0, 8), ...sy.slice(-8)] : sy;
      const ac = groupBy(trades, t => assetLabel(t.assetClass)).sort((a, b) => b.count - a.count);
      const side = groupBy(trades, t => (t.side === 'short' ? 'Short' : 'Long'));
      const acc = groupBy(trades, t => accountName(t.accountId));
      const cat = groupBy(trades, t => t.catalyst || null).sort((a, b) => b.net - a.net);
      const sec = groupBy(trades, t => t.sector || null).sort((a, b) => b.net - a.net);
      const reg = groupBy(trades, t => t.regime || null);
      const conv = groupBy(trades, t => (t.conviction ? `${t.conviction}/5` : null)).sort((a, b) => a.key.localeCompare(b.key));
      body.innerHTML = String(html`
        <div class="grid g2">${card('P&L by catalyst', '', 'r-cat')}${card('P&L by sector / theme', '', 'r-sec')}</div>
        <div class="grid g2 mt"><div class="card"><div class="card-head"><h2>Market regime</h2></div>${groupTable(reg, 'Regime')}</div><div class="card"><div class="card-head"><h2>Conviction</h2><span class="hint">does high conviction pay?</span></div>${groupTable(conv, 'Conviction', { sortBy: null })}</div></div>
        <div class="mt"></div>
        <div class="grid g2">${card('P&L by setup', '', 'r-su')}<div class="card"><div class="card-head"><h2>Setups</h2></div>${groupTable(su, 'Setup')}</div></div>
        <div class="grid g2 mt">${card(sy.length > 16 ? 'Best & worst symbols' : 'P&L by symbol', sy.length > 16 ? 'top 8 / bottom 8' : '', 'r-sy', 'tall')}<div class="card"><div class="card-head"><h2>Symbols</h2><span class="hint">${sy.length}</span></div><div style="max-height:320px;overflow:auto">${groupTable(sy, 'Symbol')}</div></div></div>
        <div class="grid g3 mt">
          <div class="card"><div class="card-head"><h2>Trades by asset class</h2></div><div class="chart short"><canvas id="r-ac"></canvas></div></div>
          <div class="card"><div class="card-head"><h2>Long vs short</h2></div>${groupTable(side, 'Side')}</div>
          <div class="card"><div class="card-head"><h2>By account</h2></div>${groupTable(acc, 'Account')}</div>
        </div>`);
      C.signBars(q('r-su'), { labels: su.map(g => g.key), values: su.map(g => g.net), horizontal: true, extraTooltip: tip(su) });
      C.signBars(q('r-sy'), { labels: syShown.map(g => g.key), values: syShown.map(g => g.net), horizontal: true, extraTooltip: tip(syShown) });
      if (cat.length) C.signBars(q('r-cat'), { labels: cat.map(g => g.key), values: cat.map(g => g.net), horizontal: true, extraTooltip: tip(cat) });
      if (sec.length) C.signBars(q('r-sec'), { labels: sec.map(g => g.key), values: sec.map(g => g.net), horizontal: true, extraTooltip: tip(sec) });
      C.doughnut(q('r-ac'), { labels: ac.map(g => g.key), values: ac.map(g => g.count), fmt: v => `${v} trades`, center: { value: String(s.n), label: 'trades' } });
    }

    if (tab === 'risk') {
      const h = rHistogram(closed);
      const withMM = closed.filter(t => t.maeR != null && t.mfeR != null);
      const roll = rolling(closed, Math.min(20, Math.max(5, Math.floor(closed.length / 5))));
      const planned = closed.filter(t => t.plannedR != null && t.r != null);
      const exitR = groupBy(trades, t => t.exitReason || null).sort((a, b) => b.net - a.net);
      body.innerHTML = String(html`
        <div class="stats">
          ${stat('Avg MAE', rmult(s.avgMaeR), { help: 'Maximum adverse excursion: how far price went against you, in R.' })}
          ${stat('Avg MFE', rmult(s.avgMfeR), { help: 'Maximum favourable excursion: the best open profit, in R.' })}
          ${stat('Exit efficiency', pct(s.avgCapture, 0), { sub: 'winning trades', help: 'Share of the best available move (MFE) you kept at exit, on winning trades.' })}
          ${stat('Trades with stop', `${s.rCount} / ${s.n}`, { sub: 'needed for R metrics' })}
          ${stat('Stops honoured', pct(closed.filter(t => t.r != null).length ? closed.filter(t => t.r != null && t.r >= -1.1).length / closed.filter(t => t.r != null).length : null, 0), { help: 'Trades that lost no more than 1.1R. Losses beyond that usually mean a moved or ignored stop.' })}
        </div>
        <div class="grid g2 mt">${card('R-multiple distribution', `${s.rCount} trades`, 'r-hist')}
          <div class="card"><div class="card-head"><h2>MAE vs MFE</h2><span class="hint">${withMM.length} trades with excursion data</span></div>${withMM.length ? html`<div class="chart"><canvas id="r-mm"></canvas></div>` : html`<p class="muted small">Record MAE and MFE prices on trades (Pro form) to see how far trades move against and for you. Use it to tighten stops and set targets.</p>`}</div></div>
        <div class="grid g2 mt">${card('Rolling expectancy', `${roll.length ? 'window ' + (closed.length - roll.length + 1) + ' trades' : 'needs more trades'}`, 'r-roll')}${card('Rolling win rate', '', 'r-rollwr')}</div>
        <div class="grid g2 mt">
          ${planned.length ? html`<div class="card"><div class="card-head"><h2>Planned vs realised R</h2><span class="hint">points below the line = gave back reward</span></div><div class="chart"><canvas id="r-plan"></canvas></div></div>` : ''}
          ${card('Position size vs result', 'notional at entry', 'r-size')}
        </div>
        <div class="grid g2 mt">${card('P&L by exit reason', 'how trades end', 'r-exit')}<div class="card"><div class="card-head"><h2>Exit reasons</h2></div>${groupTable(exitR, 'Exit reason')}</div></div>`);
      C.plainBars(q('r-hist'), { labels: h.labels, values: h.counts, colors: h.mids.map(m => (m >= 0 ? p.pos : p.neg)), label: 'Trades' });
      if (withMM.length) C.scatter(q('r-mm'), {
        groups: [{ label: 'Winners', color: p.pos, points: withMM.filter(t => t.net > 0).map(t => ({ x: t.maeR, y: t.mfeR, t })) }, { label: 'Losers', color: p.neg, points: withMM.filter(t => t.net <= 0).map(t => ({ x: t.maeR, y: t.mfeR, t })) }],
        xLabel: 'MAE (R)', yLabel: 'MFE (R)', fmtX: v => num(v, 1), fmtY: v => num(v, 1), tip: r => `${r.t.symbol}: MAE ${rmult(r.x)}, MFE ${rmult(r.y)}, result ${rmult(r.t.r)}`, refLines: [{ x: -1 }],
      });
      const rl = roll.map(r => fmtDate(r.date, { month: 'short', day: 'numeric' }));
      C.moneyLine(q('r-roll'), { labels: rl, series: [{ label: 'Expectancy / trade', data: roll.map(r => r.expectancy), color: p.accent }] });
      C.make(q('r-rollwr'), { type: 'line', data: { labels: rl, datasets: [{ label: 'Win rate', data: roll.map(r => r.winRate * 100), borderColor: p.series[2], tension: 0.15 }] }, options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` Win rate: ${num(c.parsed.y, 0)}%` } } }, scales: { x: C.plainAxis({ ticks: { maxTicksLimit: 8, maxRotation: 0 } }), y: { min: 0, max: 100, grid: { color: p.grid }, border: { display: false }, ticks: { callback: v => v + '%' } } } } });
      if (planned.length) C.scatter(q('r-plan'), { groups: [{ label: 'Trades', color: p.accent, points: planned.map(t => ({ x: t.plannedR, y: t.r, t })) }], xLabel: 'Planned R (target)', yLabel: 'Realised R', fmtX: v => num(v, 1), fmtY: v => num(v, 1), tip: r => `${r.t.symbol}: planned ${num(r.x, 1)}R, got ${rmult(r.y)}`, refLines: [{ diag: true }, { y: 0 }] });
      if (exitR.length) C.signBars(q('r-exit'), { labels: exitR.map(g => g.key), values: exitR.map(g => g.net), horizontal: true, extraTooltip: tip(exitR) });
      C.scatter(q('r-size'), { groups: [{ label: 'Winners', color: p.pos, points: closed.filter(t => t.net > 0 && t.notional).map(t => ({ x: t.notional, y: t.net, t })) }, { label: 'Losers', color: p.neg, points: closed.filter(t => t.net <= 0 && t.notional).map(t => ({ x: t.notional, y: t.net, t })) }], xLabel: 'Notional', yLabel: 'Net P&L', fmtX: v => money(v, { compact: true }), fmtY: v => money(v, { compact: true }), tip: r => `${r.t.symbol}: ${money(r.x, { compact: true })} → ${money(r.y, { sign: true })}`, refLines: [{ y: 0 }] });
    }

    if (tab === 'psych') {
      const mist = groupBy(trades, t => t.mistakes || []).sort((a, b) => a.net - b.net);
      const emo = groupBy(trades, t => t.emotions || []).sort((a, b) => b.net - a.net);
      const tg = groupBy(trades, t => t.tags || []).sort((a, b) => b.net - a.net);
      const gr = GRADES.map(g => groupBy(trades, t => t.grade || null).find(x => x.key === g)).filter(Boolean);
      const conf = groupBy(trades, t => (t.confidence ? `${t.confidence} ★` : null)).sort((a, b) => a.key.localeCompare(b.key));
      const plan = groupBy(trades, t => (t.followedPlan === true ? 'Followed plan' : t.followedPlan === false ? 'Broke plan' : null));
      const clean = groupBy(trades, t => ((t.mistakes || []).length ? 'With mistakes' : 'No mistakes'));
      const mistakeCost = mist.filter(m => m.net < 0).reduce((a, m) => a + m.net, 0);
      body.innerHTML = String(html`
        <div class="stats">
          ${stat('Plan adherence', pct(s.adherence, 0), { cls: s.adherence != null && s.adherence < 0.75 ? 'neg' : '', sub: 'below 75% → execution problem' })}
          ${stat('Trades with mistakes', pct(closed.length ? closed.filter(t => (t.mistakes || []).length).length / closed.length : null, 0))}
          ${stat('Net P&L of mistake trades', money(mistakeCost, { sign: true }), { cls: pnlClass(mistakeCost), help: 'Sum of net P&L of trades tagged with a losing mistake (a trade with two mistakes counts in both).' })}
          ${stat('Trades with a thesis', pct(closed.length ? closed.filter(t => (t.thesis || '').trim()).length / closed.length : null, 0), { sub: 'written before entry' })}
        </div>
        <div class="grid g2 mt">${card('Cost of mistakes', 'net P&L of trades with each mistake', 'r-mist')}${card('P&L by emotion', '', 'r-emo')}</div>
        <div class="grid g3 mt">
          <div class="card"><div class="card-head"><h2>Plan vs no plan</h2></div>${groupTable(plan, 'Discipline')}</div>
          <div class="card"><div class="card-head"><h2>Clean vs mistakes</h2></div>${groupTable(clean, 'Trades')}</div>
          ${card('Expectancy by grade', 'A = best process', 'r-grade', 'short')}
        </div>
        <div class="grid g2 mt">${card('P&L by tag / condition', '', 'r-tag')}<div class="card"><div class="card-head"><h2>By confidence</h2></div>${groupTable(conf, 'Confidence', { sortBy: null })}</div></div>
        <div class="grid g2 mt"><div class="card"><div class="card-head"><h2>Mistakes</h2></div>${groupTable(mist, 'Mistake', { sortBy: null })}</div><div class="card"><div class="card-head"><h2>Emotions</h2></div>${groupTable(emo, 'Emotion')}</div></div>`);
      C.signBars(q('r-mist'), { labels: mist.map(g => g.key), values: mist.map(g => g.net), horizontal: true, extraTooltip: tip(mist) });
      C.signBars(q('r-emo'), { labels: emo.map(g => g.key), values: emo.map(g => g.net), horizontal: true, extraTooltip: tip(emo) });
      C.signBars(q('r-grade'), { labels: gr.map(g => g.key), values: gr.map(g => g.expectancy), extraTooltip: tip(gr) });
      C.signBars(q('r-tag'), { labels: tg.map(g => g.key), values: tg.map(g => g.net), horizontal: true, extraTooltip: tip(tg) });
    }
  };
  filterBar(el.querySelector('#fb'), draw, { pro: true });
  draw();
}
