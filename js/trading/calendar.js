import * as store from '../store.js';
import { html, raw, money, pct, pnlClass, dayKey, today, fmtDate, stat, pad } from '../ui.js';
import * as C from '../charts.js';
import { stats, dailySeries } from './calc.js';
import { filterBar, filtered, tradeRow, wireRowLinks } from './common.js';

let cursor = null; // 'YYYY-MM'

export async function calendar(el, _p, { mode }) {
  const pro = mode === 'pro';
  if (!cursor) {
    const { trades } = filtered();
    const last = trades.filter(t => t.closed).map(t => t.day).sort().at(-1);
    cursor = (last || today()).slice(0, 7);
  }
  el.innerHTML = String(html`
    <div class="page-head"><div><h1>Calendar</h1><div class="sub">Daily results at a glance. Click a day to see its trades and journal.</div></div>
      <div class="actions cal-nav"><button class="btn" data-m="-1" aria-label="Previous month">←</button><span class="title" id="mt"></span><button class="btn" data-m="1" aria-label="Next month">→</button><button class="btn" data-m="0">Today</button></div></div>
    <div id="fb"></div><div id="body"></div>`);
  const body = el.querySelector('#body');

  const draw = () => {
    C.destroyAll();
    const { trades } = filtered();
    const [y, m] = cursor.split('-').map(Number);
    el.querySelector('#mt').textContent = new Date(y, m - 1, 1).toLocaleDateString(store.getSettings().locale, { month: 'long', year: 'numeric' });
    const monthTrades = trades.filter(t => t.day && t.day.startsWith(cursor));
    const s = stats(monthTrades);
    const byDay = new Map(dailySeries(monthTrades.filter(t => t.closed)).map(d => [d.day, d]));
    const journalDays = new Set(store.all('days').map(d => d.id));
    const first = new Date(y, m - 1, 1);
    const start = new Date(y, m - 1, 1 - ((first.getDay() + 6) % 7)); // Monday-first
    const cells = [];
    let week = [];
    const maxAbs = Math.max(1, ...[...byDay.values()].map(d => Math.abs(d.net)));
    const posC = getComputedStyle(document.documentElement).getPropertyValue(store.getSettings().pnlColors === 'blueorange' ? '--cvd-pos' : '--pnl-pos').trim();
    const negC = getComputedStyle(document.documentElement).getPropertyValue(store.getSettings().pnlColors === 'blueorange' ? '--cvd-neg' : '--pnl-neg').trim();
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const k = dayKey(d);
      const info = byDay.get(k);
      const inMonth = d.getMonth() === m - 1;
      const intensity = info ? 0.12 + 0.38 * Math.min(1, Math.abs(info.net) / maxAbs) : 0;
      const bg = info ? C.alpha(info.net >= 0 ? posC : negC, intensity) : '';
      cells.push(html`<div class="cell ${inMonth ? '' : 'out'} ${info ? 'has' : ''} ${k === today() ? 'today' : ''}" data-day="${k}" ${bg ? raw(`style="background:${bg}"`) : ''} ${info || journalDays.has(k) ? raw(`tabindex="0" role="button" aria-label="${fmtDate(k)}"`) : ''}>
        <span class="d">${d.getDate()}</span>${journalDays.has(k) ? raw('<span class="jn" title="Journal entry"></span>') : ''}
        ${info ? html`<span class="v ${pnlClass(info.net)}"><span class="v-full">${money(info.net, { sign: true, compact: Math.abs(info.net) >= 10000 })}</span><span class="v-short">${money(info.net, { compact: true, decimals: 0 })}</span></span><span class="n">${info.count} trade${info.count > 1 ? 's' : ''} · ${pct(info.count ? info.wins / info.count : 0, 0)}</span>` : ''}
      </div>`);
      if (info && inMonth) week.push(info);
      if (i % 7 === 6) {
        const wn = week.reduce((a, x) => a + x.net, 0), wc = week.reduce((a, x) => a + x.count, 0);
        cells.push(html`<div class="cell week"><span class="d">Week ${Math.floor(i / 7) + 1}</span>${wc ? html`<span class="v ${pnlClass(wn)}">${money(wn, { sign: true, compact: Math.abs(wn) >= 10000 })}</span><span class="n">${wc} trades · ${week.length} days</span>` : ''}</div>`);
        week = [];
        if (d.getMonth() !== m - 1 && i >= 34) break;
      }
    }

    body.innerHTML = String(html`
      <div class="stats">
        ${stat('Month P&L', money(s.net, { sign: true }), { cls: pnlClass(s.net) })}
        ${stat('Trading days', s.tradingDays, { sub: `${s.greenDays} green · ${s.redDays} red` })}
        ${stat('Trades', s.n, { sub: `win rate ${pct(s.winRate, 0)}` })}
        ${stat('Best day', money(s.bestDay, { sign: true }), { cls: pnlClass(s.bestDay) })}
        ${stat('Worst day', money(s.worstDay, { sign: true }), { cls: pnlClass(s.worstDay) })}
        ${stat('Avg day', money(s.avgDay, { sign: true }), { cls: pnlClass(s.avgDay) })}
      </div>
      <div class="card mt"><div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => html`<div class="dow">${d}</div>`)}<div class="dow wk">Week</div>${cells}</div></div>
      ${pro ? html`<div class="card mt"><div class="card-head"><h2>Last 12 months</h2><span class="hint">each square is a day; colour = P&L</span></div><div class="yearmap" id="ym"></div></div>` : ''}
      <div id="daypanel" class="mt"></div>`);

    if (pro) {
      const all = new Map(dailySeries(trades.filter(t => t.closed)).map(d => [d.day, d]));
      const end = new Date(), st = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 364);
      st.setDate(st.getDate() - ((st.getDay() + 6) % 7));
      const mx = Math.max(1, ...[...all.values()].map(d => Math.abs(d.net)));
      const ym = [];
      for (let d = new Date(st); d <= end; d.setDate(d.getDate() + 1)) {
        const k = dayKey(d), info = all.get(k);
        ym.push(`<span title="${fmtDate(k)}${info ? ': ' + money(info.net, { sign: true }) : ''}"${info ? ` style="background:${C.alpha(info.net >= 0 ? posC : negC, 0.25 + 0.75 * Math.min(1, Math.abs(info.net) / mx))}"` : ''}></span>`);
      }
      body.querySelector('#ym').innerHTML = ym.join('');
    }

    const openDay = k => {
      const dt = trades.filter(t => t.day === k);
      const j = store.get('days', k);
      const panel = body.querySelector('#daypanel');
      const net = dt.filter(t => t.closed).reduce((a, t) => a + t.net, 0);
      panel.innerHTML = String(html`<div class="card"><div class="card-head"><h2>${fmtDate(k, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h2>
        <div class="row"><span class="${pnlClass(net)}"><b>${money(net, { sign: true })}</b></span><a class="btn sm" href="#/trading/journal?day=${k}">${j ? 'Open journal' : 'Write journal'}</a><a class="btn sm" href="#/trading/new?day=${k}">+ Trade</a></div></div>
        ${j?.recap ? html`<p class="md small">${j.recap}</p>` : ''}
        ${dt.length ? html`<div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Symbol</th><th>Side</th>${pro ? raw('<th>Setup</th>') : ''}<th class="num">Qty</th><th class="num">Entry</th><th class="num">Exit</th><th class="num">Net P&L</th><th class="num">R</th>${pro ? raw('<th>Grade</th><th>Mistakes</th>') : ''}</tr></thead><tbody>${dt.map(t => tradeRow(t, { pro }))}</tbody></table></div>` : html`<p class="muted small">No trades this day.</p>`}
      </div>`);
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    body.querySelectorAll('.cell[data-day][tabindex]').forEach(c => { c.onclick = () => openDay(c.dataset.day); c.onkeydown = e => { if (e.key === 'Enter') openDay(c.dataset.day); }; });
    wireRowLinks(body);
  };

  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const dlt = +b.dataset.m;
    if (!dlt) cursor = today().slice(0, 7);
    else { const [y, m] = cursor.split('-').map(Number); const d = new Date(y, m - 1 + dlt, 1); cursor = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
    draw();
  });
  filterBar(el.querySelector('#fb'), draw, { pro });
  draw();
}
