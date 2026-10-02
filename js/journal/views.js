// Daily journal: a personal performance log (mood, energy, sleep, habits, intentions,
// reflection) with an optional markets section and a check-in for open swing positions.
import * as store from '../store.js';
import { html, raw, money, pct, num, pnlClass, today, fmtDate, formData, toast, confirmDlg, dayKey, parseDay, toNum, stat, price, pad, chipPicker, wireChipAdd } from '../ui.js';
import * as C from '../charts.js';
import { computedTrades, GRADES } from '../trading/calc.js';
import { go, query, refresh } from '../main.js';

export const MOODS = ['😣', '😕', '😐', '🙂', '😄'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

export const habitList = () => store.getSettings().habits || [];
const entries = () => [...store.all('days')].sort((a, b) => a.id.localeCompare(b.id));
const dayPnl = (trades, k) => trades.filter(t => t.closed && t.day === k).reduce((s, t) => s + t.net, 0);

export function streaks() {
  const set = new Set(store.all('days').map(d => d.id));
  let cur = 0;
  const d = new Date();
  if (!set.has(dayKey(d))) d.setDate(d.getDate() - 1); // today not written yet doesn't break the streak
  while (set.has(dayKey(d))) { cur++; d.setDate(d.getDate() - 1); }
  let best = 0, run = 0, prev = null;
  for (const k of [...set].sort()) {
    run = prev && (parseDay(k) - parseDay(prev)) / 864e5 === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = k;
  }
  return { current: cur, best, total: set.size };
}

const scale = (name, v, labels = MOODS) => html`<div class="seg rate" role="radiogroup" aria-label="${name}">${labels.map((m, i) => html`<button type="button" data-rate="${name}" data-v="${i + 1}" class="${+v === i + 1 ? 'on' : ''}" aria-label="${i + 1} of 5">${m}</button>`)}<input type="hidden" name="${name}" value="${v || ''}"></div>`;
const NUMS = ['1', '2', '3', '4', '5'];

// ================= today / any day =================
export async function today_(el, _p, { mode }) { return todayView(el, mode); }
export { today_ as today };

async function todayView(el, mode) {
  const pro = mode === 'pro';
  const day = query().get('day') || today();
  const j = store.get('days', day) || { id: day };
  const trades = computedTrades();
  const closedToday = trades.filter(t => t.closed && t.day === day);
  const openNow = day === today() ? trades.filter(t => !t.closed && t.openQty > 0) : [];
  const net = closedToday.reduce((s, t) => s + t.net, 0);
  const st = streaks();
  const shift = n => { const d = parseDay(day); d.setDate(d.getDate() + n); return dayKey(d); };
  const habits = [...new Set([...habitList(), ...Object.keys(j.habits || {})])];
  const isToday = day === today();
  const hour = new Date().getHours();

  el.innerHTML = String(html`
    <div class="page-head"><div><h1>${isToday ? (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening') : fmtDate(day, { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
      <div class="sub">${fmtDate(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · ${st.current ? `${st.current}-day journaling streak 🔥` : 'Start a streak today'}</div></div>
      <div class="actions"><a class="btn" href="#/journal?day=${shift(-1)}" aria-label="Previous day">←</a><input type="date" id="jd" value="${day}" aria-label="Pick a day"><a class="btn" href="#/journal?day=${shift(1)}" aria-label="Next day">→</a>${!isToday ? html`<a class="btn" href="#/journal">Today</a>` : ''}</div></div>
    <div class="grid g-2-1">
      <form id="jf" class="stack" autocomplete="off">
        <fieldset><legend>Check-in</legend><div class="form-grid">
          <label class="field">Mood${scale('mood', j.mood)}</label>
          <label class="field">Energy${scale('energy', j.energy, NUMS)}</label>
          ${pro ? html`<label class="field">Focus${scale('focus', j.focus, NUMS)}</label>` : ''}
          <label class="field">Sleep (hours)<input name="sleep" type="number" step="0.5" min="0" max="24" value="${j.sleep ?? ''}"></label>
          <label class="field full">Intention — what matters most today?<textarea name="intention" rows="2">${j.intention || ''}</textarea></label>
        </div>
        ${habits.length ? html`<h3 class="mt">Habits</h3><div class="chips">${habits.map(h => html`<label class="chip"><input type="checkbox" name="habit:${h}" ${j.habits?.[h] ? raw('checked') : ''}><span>${h}</span></label>`)}</div>` : html`<p class="small muted mt">Add daily habits to track in Settings.</p>`}
        </fieldset>

        ${openNow.length ? html`<fieldset><legend>Open positions check-in</legend>
          <p class="small muted" style="margin-top:0">Two minutes per position: is the thesis intact? Move the stop? Notes are added to each trade's timeline.</p>
          <div class="stack" style="gap:10px">${openNow.map(t => html`<div class="pos-check"><div class="row"><b>${t.symbol}</b><span class="pill ${t.side}">${t.side.toUpperCase()}</span><span class="small muted">day ${Math.max(1, Math.ceil(t.daysHeld))} · entry ${price(t.avgEntry)} · stop ${price(t.curStop)}${t.mark != null ? ` · last ${price(t.mark)}` : ''}</span>${t.unreal != null ? html`<span class="small ${pnlClass(t.unreal)}">${money(t.unreal, { sign: true })}</span>` : ''}</div>
            <div class="form-grid" style="grid-template-columns:2fr 1fr 1fr"><input name="pn:${t.id}" placeholder="Note — thesis intact? anything changed?"><input name="ps:${t.id}" type="number" step="any" placeholder="New stop"><input name="pm:${t.id}" type="number" step="any" placeholder="Price now"></div></div>`)}</div>
        </fieldset>` : ''}

        ${pro ? html`<details class="fold" ${j.plan || j.bias || j.watchlist || j.news ? raw('open') : ''}><summary>Markets</summary><div class="form-grid mt">
          <label class="field">Market bias<select name="bias"><option value="">—</option>${['Bullish', 'Bearish', 'Neutral', 'Range', 'Risk-off'].map(b => html`<option ${j.bias === b ? raw('selected') : ''}>${b}</option>`)}</select></label>
          <label class="field full">Plan — setups I'm watching, what I'll avoid<textarea name="plan" rows="3">${j.plan || ''}</textarea></label>
          <label class="field span2">Watchlist & key levels<textarea name="watchlist" rows="3">${j.watchlist || ''}</textarea></label>
          <label class="field span2">News / catalysts<textarea name="news" rows="3">${j.news || ''}</textarea></label>
        </div></details>` : html`<fieldset><legend>Plan</legend><label class="field">Markets / trading plan <span class="hint">optional</span><textarea name="plan" rows="2">${j.plan || ''}</textarea></label></fieldset>`}

        <fieldset><legend>Reflection</legend><div class="form-grid">
          <label class="field">Day rating${scale('dayRating', j.dayRating, NUMS)}</label>
          ${pro ? html`<label class="field">Discipline${scale('discipline', j.discipline, NUMS)}</label>
          <label class="field">Day grade<select name="grade"><option value="">—</option>${GRADES.map(g => html`<option ${j.grade === g ? raw('selected') : ''}>${g}</option>`)}</select></label>` : ''}
          <label class="field full">How did the day go?<textarea name="recap" rows="3">${j.recap || ''}</textarea></label>
          ${pro ? html`<label class="field span2">What went well<textarea name="good" rows="3">${j.good || ''}</textarea></label>
          <label class="field span2">What to improve<textarea name="improve" rows="3">${j.improve || ''}</textarea></label>
          <label class="field full">Grateful for<textarea name="gratitude" rows="2">${j.gratitude || ''}</textarea></label>` : ''}
          <label class="field full">Lesson / rule for tomorrow<textarea name="lesson" rows="2">${j.lesson || ''}</textarea></label>
        </div>
        ${pro ? html`<h3 class="mt">Tags</h3>${chipPicker('tags', store.getSettings().dayTags || [], j.tags || [])}` : ''}
        </fieldset>
        <div class="form-actions">${store.get('days', day) ? html`<button type="button" class="btn danger" data-del>Delete entry</button>` : ''}<button class="btn primary">Save journal</button></div>
      </form>

      <div class="stack">
        <div class="card"><div class="card-head"><h2>This day</h2></div>
          <dl class="kv">
            <dt>Trades closed</dt><dd>${closedToday.length}</dd>
            <dt>Realised P&L</dt><dd class="${pnlClass(net)}">${closedToday.length ? money(net, { sign: true }) : '—'}</dd>
            <dt>Open positions</dt><dd>${trades.filter(t => !t.closed && t.openQty > 0).length}</dd>
            <dt>Journaling streak</dt><dd>${st.current} day${st.current === 1 ? '' : 's'} (best ${st.best})</dd>
          </dl>
          ${closedToday.length ? html`<div class="mt">${closedToday.map(t => html`<a class="row small" href="#/trading/trade/${t.id}" style="padding:4px 0"><b>${t.symbol}</b><span class="spacer"></span><span class="${pnlClass(t.net)}">${money(t.net, { sign: true })}</span></a>`)}</div>` : ''}
          <div class="row mt"><a class="btn sm" href="#/trading/new?day=${day}">+ Log a trade</a><a class="btn sm" href="#/networth/update">Update balances</a></div>
        </div>
        <div class="card"><div class="card-head"><h2>Recent entries</h2><a class="hint" href="#/journal/history">History →</a></div>
          ${entries().reverse().slice(0, 12).map(e => html`<a href="#/journal?day=${e.id}" class="row entry-row ${e.id === day ? 'on' : ''}"><span>${fmtDate(e.id, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span>${e.mood ? MOODS[e.mood - 1] : ''}</span><span class="spacer"></span><span class="small muted ellipsis">${(e.intention || e.recap || '').slice(0, 40)}</span></a>`)}
          ${!store.all('days').length ? html`<p class="muted small">No entries yet. A two-minute check-in every day builds the dataset that Insights turns into patterns.</p>` : ''}
        </div>
      </div>
    </div>`);

  wireChipAdd(el);
  el.querySelector('#jd').onchange = e => e.target.value && go('/journal?day=' + e.target.value);
  el.querySelectorAll('[data-rate]').forEach(b => b.onclick = () => {
    const name = b.dataset.rate, inp = el.querySelector(`input[name=${name}]`);
    const on = inp.value === b.dataset.v;
    inp.value = on ? '' : b.dataset.v;
    el.querySelectorAll(`[data-rate=${name}]`).forEach(x => x.classList.toggle('on', !on && x === b));
  });
  const form = el.querySelector('#jf');
  form.onsubmit = async e => {
    e.preventDefault();
    const f = formData(form);
    const obj = { ...j, id: day };
    for (const k of ['intention', 'plan', 'bias', 'watchlist', 'news', 'recap', 'good', 'improve', 'gratitude', 'lesson', 'grade']) if (k in f) obj[k] = f[k];
    for (const k of ['mood', 'energy', 'focus', 'sleep', 'dayRating', 'discipline']) if (k in f) obj[k] = toNum(f[k]);
    if ('tags' in f) obj.tags = f.tags;
    obj.habits = {};
    for (const h of habits) obj.habits[h] = !!f['habit:' + h];
    await store.put('days', obj);
    // position check-ins → trade timeline
    let n = 0;
    for (const t of openNow) {
      const note = (f['pn:' + t.id] || '').trim(), ns = toNum(f['ps:' + t.id]), pm = toNum(f['pm:' + t.id]);
      if (!note && ns == null && pm == null) continue;
      const raw0 = store.get('trades', t.id);
      const upd = { date: day, note, stop: ns, mark: pm };
      await store.put('trades', { ...raw0, updates: [...(raw0.updates || []), upd], ...(ns != null ? { currentStop: ns } : {}), ...(pm != null ? { mark: pm, markAt: new Date().toISOString(), markSource: 'manual' } : {}) });
      n++;
    }
    toast(`Journal saved${n ? ` · ${n} position update${n > 1 ? 's' : ''}` : ''}`);
    refresh();
  };
  el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmDlg('Delete journal entry?', `Delete the entry for ${fmtDate(day)}?`))) return;
    await store.del('days', day); toast('Entry deleted'); refresh();
  });
}

// ================= history =================
let cursor = null;
export async function history(el, _p, { mode }) {
  const pro = mode === 'pro';
  if (!cursor) cursor = today().slice(0, 7);
  el.innerHTML = String(html`
    <div class="page-head"><div><h1>Journal history</h1><div class="sub">Mood, entries and closed trades by day. Click a day to read or edit it.</div></div>
      <div class="actions cal-nav"><button class="btn" data-m="-1" aria-label="Previous month">←</button><span class="title" id="mt"></span><button class="btn" data-m="1" aria-label="Next month">→</button><button class="btn" data-m="0">This month</button></div></div>
    <div id="body"></div>`);
  const body = el.querySelector('#body');
  const trades = computedTrades();
  const draw = () => {
    const [y, m] = cursor.split('-').map(Number);
    el.querySelector('#mt').textContent = new Date(y, m - 1, 1).toLocaleDateString(store.getSettings().locale, { month: 'long', year: 'numeric' });
    const first = new Date(y, m - 1, 1);
    const start = new Date(y, m - 1, 1 - ((first.getDay() + 6) % 7));
    const cells = [];
    const monthEntries = store.all('days').filter(d => d.id.startsWith(cursor));
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      if (i >= 35 && d.getMonth() !== m - 1) break;
      const k = dayKey(d), j = store.get('days', k), p = dayPnl(trades, k), nT = trades.filter(t => t.closed && t.day === k).length;
      cells.push(html`<a class="cell ${d.getMonth() === m - 1 ? '' : 'out'} ${j || nT ? 'has' : ''} ${k === today() ? 'today' : ''}" href="#/journal?day=${k}">
        <span class="d">${d.getDate()}</span>${j ? html`<span class="jmood" title="Mood">${j.mood ? MOODS[j.mood - 1] : '✎'}</span>` : ''}
        ${nT ? html`<span class="v ${pnlClass(p)}"><span class="v-full">${money(p, { sign: true, compact: Math.abs(p) >= 10000 })}</span><span class="v-short">${money(p, { compact: true, decimals: 0 })}</span></span>` : ''}
        ${j?.intention ? html`<span class="n ellipsis">${j.intention}</span>` : ''}</a>`);
    }
    const moods = monthEntries.map(d => d.mood).filter(Boolean);
    body.innerHTML = String(html`
      <div class="stats">
        ${stat('Entries this month', monthEntries.length)}
        ${stat('Average mood', moods.length ? `${MOODS[Math.round(mean(moods)) - 1]} ${num(mean(moods), 1)}` : '—')}
        ${stat('Avg sleep', monthEntries.some(d => d.sleep) ? num(mean(monthEntries.map(d => +d.sleep).filter(Boolean)), 1) + ' h' : '—')}
        ${stat('Trades closed', trades.filter(t => t.closed && t.day?.startsWith(cursor)).length)}
        ${stat('Realised P&L', money(trades.filter(t => t.closed && t.day?.startsWith(cursor)).reduce((s, t) => s + t.net, 0), { sign: true }))}
      </div>
      <div class="card mt"><div class="cal cal7">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => html`<div class="dow">${d}</div>`)}${cells}</div></div>
      ${pro ? html`<div class="card mt"><div class="card-head"><h2>Consistency — last 12 months</h2><span class="hint">each square is a day you journaled</span></div><div class="yearmap" id="ym"></div></div>` : ''}
      <div class="card mt"><div class="card-head"><h2>Entries</h2><span class="hint">${monthEntries.length}</span></div>
        ${monthEntries.length ? html`<div class="stack" style="gap:0">${monthEntries.sort((a, b) => b.id.localeCompare(a.id)).map(e => html`<a class="entry" href="#/journal?day=${e.id}"><div class="row"><b>${fmtDate(e.id, { weekday: 'long', month: 'short', day: 'numeric' })}</b>${e.mood ? html`<span>${MOODS[e.mood - 1]}</span>` : ''}${e.dayRating ? html`<span class="tag">day ${e.dayRating}/5</span>` : ''}${(e.tags || []).map(t => html`<span class="tag accent">${t}</span>`)}</div>${e.intention ? html`<div class="small"><span class="muted">Intention:</span> ${e.intention}</div>` : ''}${e.recap ? html`<div class="small"><span class="muted">Recap:</span> ${e.recap}</div>` : ''}${e.lesson ? html`<div class="small"><span class="muted">Lesson:</span> ${e.lesson}</div>` : ''}</a>`)}</div>` : html`<p class="muted small">No entries this month.</p>`}
      </div>`);
    if (pro) {
      const set = new Set(store.all('days').map(d => d.id));
      const end = new Date(), st = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 364);
      st.setDate(st.getDate() - ((st.getDay() + 6) % 7));
      const out = [];
      for (let d = new Date(st); d <= end; d.setDate(d.getDate() + 1)) { const k = dayKey(d); const j = set.has(k) ? store.get('days', k) : null; out.push(`<span title="${fmtDate(k)}${j ? ' · journaled' : ''}" ${j ? `style="background:var(--accent);opacity:${0.35 + 0.13 * (j.mood || 3)}"` : ''}></span>`); }
      body.querySelector('#ym').innerHTML = out.join('');
    }
  };
  el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const dl = +b.dataset.m;
    if (!dl) cursor = today().slice(0, 7);
    else { const [y, m] = cursor.split('-').map(Number); const d = new Date(y, m - 1 + dl, 1); cursor = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
    draw();
  });
  draw();
}

// ================= insights =================
export async function insights(el, _p, { mode }) {
  const pro = mode === 'pro';
  const all = entries();
  el.innerHTML = String(html`<div class="page-head"><div><h1>Journal insights</h1><div class="sub">Patterns in how you feel, sleep and perform — and how that lines up with your trading.</div></div></div><div id="body"></div>`);
  const body = el.querySelector('#body');
  if (all.length < 3) { body.innerHTML = String(html`<div class="empty"><div class="empty-title">Not enough entries yet</div><p>Insights appear after a few journal entries. Write today's check-in to start.</p><a class="btn primary" href="#/journal">Open today's journal</a></div>`); return; }
  const trades = computedTrades();
  const st = streaks();
  const cut = k => { const d = new Date(); d.setDate(d.getDate() - k); return dayKey(d); };
  const last30 = all.filter(e => e.id >= cut(29)), last90 = all.filter(e => e.id >= cut(89));
  const avg = (list, k) => mean(list.map(e => +e[k]).filter(x => x > 0));
  const habits = [...new Set([...habitList(), ...all.flatMap(e => Object.keys(e.habits || {}))])];
  const habitRates = habits.map(h => { const rel = last30.filter(e => e.habits && h in e.habits); return { h, rate: rel.length ? rel.filter(e => e.habits[h]).length / rel.length : null, n: rel.length }; }).filter(x => x.rate != null);
  // trading vs state
  const withTrades = all.map(e => ({ e, pnl: dayPnl(trades, e.id), n: trades.filter(t => t.closed && t.day === e.id).length })).filter(x => x.n > 0);
  const hi = withTrades.filter(x => x.e.mood >= 4), lo = withTrades.filter(x => x.e.mood && x.e.mood <= 2);
  const sleepHi = withTrades.filter(x => +x.e.sleep >= 7), sleepLo = withTrades.filter(x => x.e.sleep && +x.e.sleep < 6.5);
  const avgP = l => (l.length ? l.reduce((s, x) => s + x.pnl, 0) / l.length : null);
  const byDow = [1, 2, 3, 4, 5, 6, 0].map(d => ({ d: DOW[d], mood: mean(all.filter(e => parseDay(e.id).getDay() === d && e.mood).map(e => e.mood)) }));

  body.innerHTML = String(html`
    <div class="stats big">
      ${stat('Current streak', `${st.current} day${st.current === 1 ? '' : 's'}`, { sub: `best ${st.best} · ${st.total} entries total` })}
      ${stat('Entries (30 days)', `${last30.length}/30`, { sub: pct(last30.length / 30, 0) + ' consistency' })}
      ${stat('Mood (30d)', avg(last30, 'mood') ? `${MOODS[Math.round(avg(last30, 'mood')) - 1]} ${num(avg(last30, 'mood'), 1)}` : '—', { sub: avg(last90, 'mood') ? `90d ${num(avg(last90, 'mood'), 1)}` : '' })}
      ${stat('Energy (30d)', num(avg(last30, 'energy'), 1), { sub: 'out of 5' })}
      ${stat('Sleep (30d)', avg(last30, 'sleep') ? num(avg(last30, 'sleep'), 1) + ' h' : '—', { sub: 'average per night' })}
    </div>
    <div class="grid g-2-1 mt">
      <div class="card"><div class="card-head"><h2>Mood & energy</h2><span class="hint">last 90 days, 7-day average</span></div><div class="chart"><canvas id="i-mood"></canvas></div></div>
      <div class="card"><div class="card-head"><h2>Habits</h2><span class="hint">completion, last 30 days</span></div>${habitRates.length ? html`<div class="chart"><canvas id="i-hab"></canvas></div>` : html`<p class="small muted">Tick habits in your daily check-in to see completion rates.</p>`}</div>
    </div>
    <div class="grid g2 mt">
      <div class="card"><div class="card-head"><h2>Sleep</h2><span class="hint">last 30 entries</span></div><div class="chart short"><canvas id="i-sleep"></canvas></div></div>
      <div class="card"><div class="card-head"><h2>Mood by weekday</h2></div><div class="chart short"><canvas id="i-dow"></canvas></div></div>
    </div>
    <div class="grid g2 mt">
      <div class="card"><div class="card-head"><h2>State vs trading results</h2><span class="hint">days with closed trades</span></div>
        ${withTrades.length >= 3 ? html`<table class="data compact"><thead><tr><th>Condition</th><th class="num">Days</th><th class="num">Avg day P&L</th></tr></thead><tbody>
          <tr><td>Good mood (4–5)</td><td class="num">${hi.length}</td><td class="num ${pnlClass(avgP(hi))}">${money(avgP(hi), { sign: true })}</td></tr>
          <tr><td>Low mood (1–2)</td><td class="num">${lo.length}</td><td class="num ${pnlClass(avgP(lo))}">${money(avgP(lo), { sign: true })}</td></tr>
          <tr><td>Slept 7h+</td><td class="num">${sleepHi.length}</td><td class="num ${pnlClass(avgP(sleepHi))}">${money(avgP(sleepHi), { sign: true })}</td></tr>
          <tr><td>Slept under 6.5h</td><td class="num">${sleepLo.length}</td><td class="num ${pnlClass(avgP(sleepLo))}">${money(avgP(sleepLo), { sign: true })}</td></tr>
        </tbody></table><p class="small muted mt">Small samples are noisy — treat this as a prompt for reflection, not a rule.</p>` : html`<p class="small muted">Journal on days you close trades to compare your state with results.</p>`}</div>
      ${pro && withTrades.length >= 3 ? html`<div class="card"><div class="card-head"><h2>Mood vs day P&L</h2></div><div class="chart"><canvas id="i-scatter"></canvas></div></div>`
        : html`<div class="card"><div class="card-head"><h2>Recurring lessons</h2></div>${!all.some(e => e.lesson) ? html`<p class="small muted">Write a lesson in your daily reflection and the latest ones collect here.</p>` : ''}${all.filter(e => e.lesson).slice(-6).reverse().map(e => html`<div class="small" style="padding:6px 0;border-bottom:1px solid var(--border)"><span class="muted">${fmtDate(e.id, { month: 'short', day: 'numeric' })}</span> — ${e.lesson}</div>`)}</div>`}
    </div>`);

  const p = C.palette();
  const series = last90;
  const ma = (k) => series.map((e, i) => { const w = series.slice(Math.max(0, i - 6), i + 1).map(x => +x[k]).filter(x => x > 0); return w.length ? mean(w) : null; });
  const labels = series.map(e => fmtDate(e.id, { month: 'short', day: 'numeric' }));
  C.make(body.querySelector('#i-mood'), {
    type: 'line',
    data: { labels, datasets: [{ label: 'Mood', data: ma('mood'), borderColor: p.series[0], tension: 0.3, spanGaps: true }, { label: 'Energy', data: ma('energy'), borderColor: p.series[1], tension: 0.3, spanGaps: true }] },
    options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${num(c.parsed.y, 1)}` } } }, scales: { x: C.plainAxis({ ticks: { maxTicksLimit: 8, maxRotation: 0 } }), y: { min: 1, max: 5, grid: { color: p.grid }, border: { display: false }, ticks: { stepSize: 1 } } } },
  });
  if (habitRates.length) C.plainBars(body.querySelector('#i-hab'), { labels: habitRates.map(x => x.h), values: habitRates.map(x => x.rate * 100), horizontal: true, fmt: v => num(v, 0) + '%', label: 'Done' });
  const sl = all.filter(e => +e.sleep > 0).slice(-30);
  C.plainBars(body.querySelector('#i-sleep'), { labels: sl.map(e => fmtDate(e.id, { month: 'short', day: 'numeric' })), values: sl.map(e => +e.sleep), fmt: v => num(v, 1) + ' h', colors: sl.map(e => (+e.sleep >= 7 ? p.series[1] : p.neutral)), label: 'Sleep' });
  C.plainBars(body.querySelector('#i-dow'), { labels: byDow.map(x => x.d), values: byDow.map(x => x.mood ?? 0), fmt: v => num(v, 1), label: 'Avg mood' });
  if (pro && withTrades.length >= 3) C.scatter(body.querySelector('#i-scatter'), { groups: [{ label: 'Days', color: p.accent, points: withTrades.filter(x => x.e.mood).map(x => ({ x: x.e.mood + (Math.random() - 0.5) * 0.25, y: x.pnl, d: x.e.id })) }], xLabel: 'Mood (1–5)', yLabel: 'Day P&L', fmtX: v => num(v, 0), fmtY: v => money(v, { compact: true }), tip: r => `${fmtDate(r.d)}: ${money(r.y, { sign: true })}`, refLines: [{ y: 0 }] });
}
