// Interest: what each yield account earns, what your debts cost, and money sitting idle.
import { html, money, pct, num, stat, fmtDate, dayKey } from '../ui.js';
import * as C from '../charts.js';
import { interestOverview, typeLabel } from './calc.js';
import { ccyOf, moneyIn, sameMoney, displayCcy } from '../fx.js';

// ================= interest =================
export async function interest(el) {
  const io = interestOverview();
  const p = C.palette();
  el.innerHTML = String(html`<div class="page-head"><div><h1>Interest</h1><div class="sub">What your money earns, what your debts cost, and what sits idle. Set an APY on an account (Accounts → Edit) and its balance grows daily between your updates.</div></div>
    <div class="actions"><a class="btn" href="#/networth/accounts">Accounts</a><a class="btn primary" href="#/networth/update">Update balances</a></div></div>
    <div class="stats big">
      ${stat('Earning per month', money(io.earnMonth), { cls: io.earnMonth ? 'pos' : '', sub: `${money(io.earnYear)} / year · ${money(io.earnYear / 365, { decimals: 2 })} / day` })}
      ${stat('Blended APY', pct(io.blended, 2), { sub: `on ${money(io.earnValue)} earning interest` })}
      ${stat('Earned this year', money(io.ytd), { cls: io.ytd ? 'pos' : '', sub: `${money(io.total)} since you started tracking`, help: 'Estimate: between balance updates each recorded balance grows at the APY in force then. When you type a new balance, the estimate restarts from it.' })}
      ${stat('Debt interest', io.payMonth ? money(-io.payMonth) : '—', { cls: io.payMonth ? 'neg' : '', sub: io.payMonth ? `${money(io.payYear)} / year` : 'no debts with an APR', help: 'What your debts cost per month at their APR.' })}
    </div>
    ${io.earn.length ? html`<div class="card mt" style="padding:0"><div class="card-head" style="padding:14px 16px 0"><h2>Interest-bearing accounts</h2><span class="hint">estimates at the current APY</span></div>
      <div class="table-wrap" style="border:0"><table class="data"><thead><tr><th>Account</th><th class="num">Balance now</th><th class="num">APY</th><th class="num">Per day</th><th class="num">Per month</th><th class="num">Per year</th><th class="num">Since last update</th><th class="num">This year</th></tr></thead><tbody>
      ${io.earn.map(x => html`<tr><td><b>${x.a.name}</b><div class="small muted">${typeLabel(x.a)}${x.lastUpdate ? ` · updated ${fmtDate(x.lastUpdate, { month: 'short', day: 'numeric' })}` : ''}</div></td><td class="num">${moneyIn(x.native, ccyOf(x.a))}${!sameMoney(ccyOf(x.a), displayCcy()) ? html`<div class="dist">≈ ${money(x.value)}</div>` : ''}</td><td class="num">${num(x.apy, 2)}%</td><td class="num">${money(x.perDay, { decimals: 2 })}</td><td class="num pos">${money(x.perMonth)}</td><td class="num">${money(x.perYear)}</td><td class="num">${money(x.sinceUpdate)}</td><td class="num">${money(x.ytd)}</td></tr>`)}
      </tbody><tfoot><tr><td>Total</td><td class="num">${money(io.earnValue)}</td><td class="num">${pct(io.blended, 2)}</td><td class="num">${money(io.earnYear / 365, { decimals: 2 })}</td><td class="num">${money(io.earnMonth)}</td><td class="num">${money(io.earnYear)}</td><td class="num">${money(io.sinceUpdate)}</td><td class="num">${money(io.ytd)}</td></tr></tfoot></table></div></div>`
      : html`<div class="empty mt"><div class="empty-title">No interest-bearing accounts yet</div><p>Savings accounts, money-market funds, staking, bonds… Edit the account and set its <b>APY</b> — the app then shows what it earns per day, month and year, and grows the balance between your updates.</p><a class="btn primary" href="#/networth/accounts">Go to accounts</a></div>`}
    ${io.earn.length ? html`<div class="grid g2 mt">
      <div class="card"><div class="card-head"><h2>Next 12 months</h2><span class="hint">cumulative interest if balances and rates stay the same</span></div><div class="chart"><canvas id="i-proj"></canvas></div></div>
      <div class="card"><div class="card-head"><h2>Where the interest comes from</h2><span class="hint">per year</span></div><div class="chart"><canvas id="i-src"></canvas></div></div></div>` : ''}
    <div class="grid ${io.pay.length ? 'g2' : ''} mt">
      <div class="card"><div class="card-head"><h2>Not earning anything</h2><span class="hint">cash & savings with no APY</span></div>
        ${io.idle.length ? html`<dl class="kv">${io.idle.map(x => html`<dt>${x.a.name}</dt><dd>${money(x.value)}</dd>`)}</dl>
          ${io.blended ? html`<p class="small muted mt">At your blended ${pct(io.blended, 2)} APY, ${money(io.idleValue)} would earn about <b class="pos">${money(io.idleValue * io.blended / 12)}</b> a month. Keep what you need for spending close at hand; the rest could be earning.</p>` : ''}`
          : html`<p class="muted small">Nothing idle — every cash and savings account has an APY set.</p>`}</div>
      ${io.pay.length ? html`<div class="card"><div class="card-head"><h2>Debts</h2><span class="hint">interest you pay</span></div>
        ${html`<table class="data compact"><thead><tr><th>Debt</th><th class="num">Owed</th><th class="num">APR</th><th class="num">Per month</th></tr></thead><tbody>${io.pay.map(x => html`<tr><td>${x.a.name}</td><td class="num">${money(x.owed)}</td><td class="num">${num(x.rate, 2)}%</td><td class="num neg">${money(x.perMonth)}</td></tr>`)}</tbody></table>
          ${(() => { const top = [...io.pay].sort((x, y) => y.rate - x.rate)[0]; return io.blended != null && top.rate > io.blended * 100 ? html`<p class="small muted mt">${top.a.name} costs ${num(top.rate, 2)}% — more than your savings earn (${pct(io.blended, 2)}). Paying it down is a guaranteed ${num(top.rate, 2)}% return.</p>` : ''; })()}`}</div>` : ''}
    </div>`);
  if (!io.earn.length) return;
  const labels = [], cum = [];
  const now = new Date();
  for (let m = 1; m <= 12; m++) {
    labels.push(fmtDate(dayKey(new Date(now.getFullYear(), now.getMonth() + m, 1)), { month: 'short', year: '2-digit' }));
    cum.push(io.earn.reduce((s, x) => s + x.value * (Math.pow(1 + x.apy / 100, m / 12) - 1), 0));
  }
  C.moneyLine(el.querySelector('#i-proj'), { labels, zero: true, series: [{ label: 'Interest earned', data: cum, color: p.pos, fill: true }] });
  C.plainBars(el.querySelector('#i-src'), { labels: io.earn.map(x => `${x.a.name} (${num(x.apy, 2)}%)`), values: io.earn.map(x => x.perYear), horizontal: true, fmt: v => money(v, { compact: true }), label: 'Per year' });
}
