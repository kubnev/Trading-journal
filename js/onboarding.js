// Starting estimates: rough numbers a new user gives so the long-term figures (cash runway,
// month-end projection, year-on-year change) work from day one. Monthly spending is replaced by
// your real average automatically once there's a full calendar month of logged expenses.
import * as store from './store.js';
import { html, raw, toast, toNum, money, estTag } from './ui.js';
import { CURRENCIES, displayCcy } from './fx.js';
import { baseline, MIN_MONTHS } from './networth/calc.js';

const field = (name, label, hint, v, extra = '') => html`<label class="field">${label}${hint ? html` <span class="hint">${hint}</span>` : ''}<input name="${name}" type="number" step="any" min="0" inputmode="decimal" value="${v ?? ''}" ${raw(extra)}></label>`;

export function estimatesForm({ compact = false } = {}) {
  const s = store.getSettings(), e = s.estimates || {}, pl = s.plan || {};
  const ccy = e.currency || s.currency || 'USD';
  return html`<form id="estf" class="form-grid est-form" autocomplete="off">
    <label class="field">Main currency <span class="hint">totals are shown in it</span><select name="currency">${CURRENCIES.map(c => html`<option ${c === ccy ? raw('selected') : ''}>${c}</option>`)}</select></label>
    ${field('spending', 'Usual monthly spending', 'everything: rent, bills, food, fun…', e.spending)}
    ${field('budget', 'Monthly spending budget', 'optional — a limit to stay under', s.budgets?.total || '')}
    ${field('nwYearAgo', 'Net worth about a year ago', 'optional — for year-on-year growth', e.nwYearAgo)}
    ${field('emergencyMonths', 'Cash runway target (months)', 'cash & savings to keep, usually 3–6', pl.emergencyMonths ?? 6, 'step="1" max="36"')}
  </form>`;
}

export function wireEstimatesForm() {}

export async function saveEstimates(root) {
  const f = root.querySelector('#estf');
  const n = k => toNum(f[k].value);
  const cur = f.currency.value;
  const est = { currency: cur, spending: n('spending'), nwYearAgo: f.nwYearAgo.value === '' ? null : n('nwYearAgo'), setAt: new Date().toISOString() };
  const s = store.getSettings();
  const patch = { estimates: est, plan: {} };
  if (cur !== s.currency) patch.currency = cur;
  if (n('emergencyMonths') != null) patch.plan.emergencyMonths = n('emergencyMonths');
  await store.saveSettings(patch);
  const budget = n('budget');
  if (budget != null) await store.saveSettings({ budgets: { ...(store.getSettings().budgets || {}), total: budget } });
  return est;
}

// Which numbers are still estimates — shown on the setup page and in Settings
export function estimateStatus() {
  const b = baseline();
  const e = store.getSettings().estimates;
  if (b.realMonths >= MIN_MONTHS) return html`<p class="small" style="margin:0"><b class="pos">Using your real average</b> — ${b.realMonths} complete month${b.realMonths === 1 ? '' : 's'} of logged spending (${money(b.avgExpenses)} per month). Your spending estimate is no longer used.</p>`;
  return html`<p class="small" style="margin:0">${e?.spending ? html`<b>Using your estimate</b>${estTag(true)}` : html`<b>No spending estimate yet</b>`} — your real average takes over automatically after ${MIN_MONTHS === 1 ? 'one full calendar month' : `${MIN_MONTHS} full calendar months`} of logged expenses.</p>`;
}

// Full-page step in the first-launch flow (also reachable at #/setup)
export function estimatesView(el, { onDone, firstRun = false } = {}) {
  el.innerHTML = String(html`<div class="onboard">
    ${firstRun ? html`<div class="small muted">Step 2 of 3</div>` : ''}
    <h1>A few starting numbers</h1>
    <p class="muted">A few figures need history to mean anything — how many months your cash would last, the month-end spending projection, how your net worth changed over the past year.
      Give rough numbers now and they're used as placeholders; once you've logged a <b>full calendar month</b> of spending, your real average replaces the estimate automatically. Anything based on an estimate is marked ${estTag(true)}.</p>
    <div class="card mt">${estimatesForm()}</div>
    <div class="note mt">${estimateStatus()}</div>
    <div class="row mt"><button class="btn ghost" data-skip>${firstRun ? 'Skip for now' : 'Cancel'}</button><span class="spacer"></span><button class="btn primary" data-save>${firstRun ? 'Save & continue to the tour' : 'Save estimates'}</button></div>
    <p class="small muted">Rough is fine — round numbers are perfect. You can change these any time in Settings → Starting estimates.</p></div>`);
  wireEstimatesForm(el);
  el.querySelector('[data-save]').onclick = async () => { await saveEstimates(el); toast('Starting estimates saved'); onDone?.(true); };
  el.querySelector('[data-skip]').onclick = () => onDone?.(false);
}
export { displayCcy };
