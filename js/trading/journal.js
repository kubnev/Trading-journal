import * as store from '../store.js';
import { html, raw, money, pct, pnlClass, today, fmtDate, formData, toast, confirmDlg, dayKey, parseDay, toNum } from '../ui.js';
import { computedTrades, stats, GRADES } from './calc.js';
import { tradeRow, wireRowLinks } from './common.js';
import { go, query } from '../main.js';

const MOODS = ['😣', '😕', '😐', '🙂', '😄'];

export async function journal(el, _p, { mode }) {
  const pro = mode === 'pro';
  const day = query().get('day') || today();
  const j = store.get('days', day) || { id: day };
  const trades = computedTrades().filter(t => t.day === day);
  const s = stats(trades);
  const entries = [...store.all('days')].sort((a, b) => b.id.localeCompare(a.id));
  const shift = n => { const d = parseDay(day); d.setDate(d.getDate() + n); return dayKey(d); };
  const moodPick = (name, v) => html`<div class="seg" role="radiogroup" aria-label="${name}">${MOODS.map((m, i) => html`<button type="button" data-rate="${name}" data-v="${i + 1}" class="${+v === i + 1 ? 'on' : ''}" aria-label="${i + 1} of 5">${m}</button>`)}<input type="hidden" name="${name}" value="${v || ''}"></div>`;

  el.innerHTML = String(html`
    <div class="page-head"><div><h1>Daily journal</h1><div class="sub">${fmtDate(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div></div>
      <div class="actions"><a class="btn" href="#/trading/journal?day=${shift(-1)}">← Prev day</a><input type="date" id="jd" value="${day}" aria-label="Pick a day"><a class="btn" href="#/trading/journal?day=${shift(1)}">Next day →</a></div></div>
    <div class="grid g-2-1">
      <form id="jf" class="stack">
        <fieldset><legend>Pre-market</legend><div class="form-grid">
          <label class="field">Mood / readiness${moodPick('mood', j.mood)}</label>
          ${pro ? html`<label class="field">Sleep (hours)<input name="sleep" type="number" step="0.5" min="0" max="24" value="${j.sleep ?? ''}"></label>
          <label class="field">Market bias<select name="bias"><option value="">—</option>${['Bullish', 'Bearish', 'Neutral', 'Range', 'Volatile'].map(b => html`<option ${j.bias === b ? raw('selected') : ''}>${b}</option>`)}</select></label>
          <label class="field">Max loss today<input name="maxLoss" type="number" step="any" min="0" value="${j.maxLoss ?? ''}" placeholder="stop trading at…"></label>` : ''}
          <label class="field full">Game plan — what am I looking for, what will I avoid?<textarea name="plan" rows="4">${j.plan || ''}</textarea></label>
          ${pro ? html`<label class="field span2">Watchlist & key levels<textarea name="watchlist" rows="3">${j.watchlist || ''}</textarea></label>
          <label class="field span2">News / catalysts<textarea name="news" rows="3">${j.news || ''}</textarea></label>` : ''}
        </div></fieldset>
        <fieldset><legend>Post-market</legend><div class="form-grid">
          <label class="field full">Recap — what happened?<textarea name="recap" rows="4">${j.recap || ''}</textarea></label>
          ${pro ? html`<label class="field span2">What went well<textarea name="good" rows="3">${j.good || ''}</textarea></label>
          <label class="field span2">What to improve<textarea name="improve" rows="3">${j.improve || ''}</textarea></label>` : ''}
          <label class="field full">Lesson / rule for tomorrow<textarea name="lesson" rows="2">${j.lesson || ''}</textarea></label>
          ${pro ? html`<label class="field">Discipline (1–5)${moodPick('discipline', j.discipline)}</label>
          <label class="field">Day grade<select name="grade"><option value="">—</option>${GRADES.map(g => html`<option ${j.grade === g ? raw('selected') : ''}>${g}</option>`)}</select></label>
          <label class="field">Followed daily rules?<select name="rulesOk"><option value="">—</option><option value="yes" ${j.rulesOk === true ? raw('selected') : ''}>Yes</option><option value="no" ${j.rulesOk === false ? raw('selected') : ''}>No</option></select></label>` : ''}
        </div></fieldset>
        <div class="form-actions">${store.get('days', day) ? html`<button type="button" class="btn danger" data-del>Delete entry</button>` : ''}<button class="btn primary">Save journal</button></div>
      </form>
      <div class="stack">
        <div class="card"><div class="card-head"><h2>Day results</h2><a class="btn sm" href="#/trading/new?day=${day}">+ Trade</a></div>
          <div class="stats" style="grid-template-columns:1fr 1fr">
            <div><div class="stat-label">Net P&L</div><div class="stat-value ${pnlClass(s.net)}">${money(s.net, { sign: true })}</div></div>
            <div><div class="stat-label">Trades · win rate</div><div class="stat-value">${s.n} · ${pct(s.winRate, 0)}</div></div>
          </div>
          ${j.maxLoss && s.net < -j.maxLoss ? html`<div class="callout bad mt"><span class="ic">!</span><div>Max daily loss of ${money(j.maxLoss)} exceeded.</div></div>` : ''}
        </div>
        ${trades.length ? html`<div class="card" style="padding:0"><div class="table-wrap" style="border:0"><table class="data compact"><thead><tr><th>Time</th><th>Symbol</th><th>Side</th><th class="num">Qty</th><th class="num">Entry</th><th class="num">Exit</th><th class="num">Net</th><th class="num">R</th></tr></thead><tbody>${trades.map(t => tradeRow(t, { pro: false }))}</tbody></table></div></div>` : ''}
        <div class="card"><div class="card-head"><h2>Recent entries</h2><span class="hint">${entries.length}</span></div>
          ${entries.length ? html`<div class="stack" style="gap:4px;max-height:420px;overflow:auto">${entries.slice(0, 60).map(e => {
            const dn = computedTrades().filter(t => t.day === e.id && t.closed).reduce((a, t) => a + t.net, 0);
            return html`<a href="#/trading/journal?day=${e.id}" class="row" style="padding:6px 8px;border-radius:6px;${e.id === day ? 'background:var(--accent-soft)' : ''}"><span>${fmtDate(e.id, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span>${e.mood ? MOODS[e.mood - 1] : ''}</span><span class="spacer"></span><span class="${pnlClass(dn)} small">${dn ? money(dn, { sign: true }) : ''}</span></a>`;
          })}</div>` : html`<p class="muted small">No entries yet. A short pre-market plan and post-market recap every day is the habit that separates a journal from a spreadsheet.</p>`}
        </div>
      </div>
    </div>`);
  wireRowLinks(el);
  el.querySelector('#jd').onchange = e => e.target.value && go('/trading/journal?day=' + e.target.value);
  el.querySelectorAll('[data-rate]').forEach(b => b.onclick = () => {
    const name = b.dataset.rate;
    const inp = el.querySelector(`input[name=${name}]`);
    const on = inp.value === b.dataset.v;
    inp.value = on ? '' : b.dataset.v;
    el.querySelectorAll(`[data-rate=${name}]`).forEach(x => x.classList.toggle('on', !on && x === b));
  });
  const form = el.querySelector('#jf');
  form.onsubmit = async e => {
    e.preventDefault();
    const f = formData(form);
    const obj = { ...j, ...f, id: day, mood: toNum(f.mood), sleep: toNum(f.sleep), maxLoss: toNum(f.maxLoss), discipline: toNum(f.discipline) };
    if ('rulesOk' in f) obj.rulesOk = f.rulesOk === 'yes' ? true : f.rulesOk === 'no' ? false : null;
    await store.put('days', obj);
    toast('Journal saved');
    go('/trading/journal?day=' + day + '&s=' + Date.now());
  };
  el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirmDlg('Delete journal entry?', `Delete the journal entry for ${fmtDate(day)}?`))) return;
    await store.del('days', day); toast('Entry deleted'); go('/trading/journal?day=' + day + '&s=' + Date.now());
  });
}
