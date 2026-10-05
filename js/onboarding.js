// Starting estimates: rough monthly numbers a new user gives so every long-term figure (savings rate,
// emergency fund, FI planning, month-end projection, year-on-year change) works from day one.
// They're replaced by real averages automatically once there's a full month of transactions.
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
    ${field('income', 'Monthly income', 'take-home, after tax', e.income)}
    ${field('spending', 'Monthly spending', 'everything: rent, bills, food, fun…', e.spending)}
    ${field('saving', 'Saved or invested per month', 'blank = income − spending', e.saving)}
    ${field('budget', 'Monthly spending budget', 'optional — a limit to stay under', s.budgets?.total || '')}
    ${field('nwYearAgo', 'Net worth about a year ago', 'optional — for year-on-year growth', e.nwYearAgo)}
    ${compact ? '' : html`<div class="full form-sep"></div>`}
    ${field('currentAge', 'Your age', 'for FI planning', pl.currentAge ?? '', 'step="1" max="110"')}
    ${field('retirementAge', 'Age you\'d like to be financially free', 'optional', pl.retirementAge ?? '', 'step="1" max="110"')}
    ${field('emergencyMonths', 'Emergency fund target (months)', 'usually 3–6', pl.emergencyMonths ?? 6, 'step="1" max="36"')}
  </form>`;
}

export function wireEstimatesForm(root) {
  const f = root.querySelector('#estf');
  const sync = () => { f.saving.placeholder = +f.income.value && +f.spending.value ? String(Math.round(+f.income.value - +f.spending.value)) : ''; };
  f.income.addEventListener('input', sync); f.spending.addEventListener('input', sync); sync();
}

export async function saveEstimates(root) {
  const f = root.querySelector('#estf');
  const n = k => toNum(f[k].value);
  const cur = f.currency.value;
  const est = { currency: cur, income: n('income'), spending: n('spending'), saving: n('saving'), nwYearAgo: f.nwYearAgo.value === '' ? null : n('nwYearAgo'), setAt: new Date().toISOString() };
  if (est.saving == null && est.income != null && est.spending != null) est.saving = est.income - est.spending;
  const s = store.getSettings();
  const patch = { estimates: est, plan: {} };
  if (cur !== s.currency) patch.currency = cur;
  if (n('currentAge')) patch.plan.currentAge = n('currentAge');
  if (n('retirementAge')) patch.plan.retirementAge = n('retirementAge');
  if (n('emergencyMonths') != null) patch.plan.emergencyMonths = n('emergencyMonths');
  if (!s.plan?.currency) patch.plan.currency = cur;
  await store.saveSettings(patch);
  const budget = n('budget');
  if (budget != null) await store.saveSettings({ budgets: { ...(store.getSettings().budgets || {}), total: budget } });
  return est;
}

// Which numbers are still estimates — shown on the setup page and in Settings
export function estimateStatus() {
  const b = baseline();
  const e = store.getSettings().estimates;
  if (b.realMonths >= MIN_MONTHS && !b.estimated.income) return html`<p class="small" style="margin:0"><b class="pos">Using your real averages</b> — ${b.realMonths} complete month${b.realMonths === 1 ? '' : 's'} of transactions (${money(b.avgIncome)} income, ${money(b.avgExpenses)} spending per month). Your estimates are no longer used.</p>`;
  if (b.realMonths >= MIN_MONTHS) return html`<p class="small" style="margin:0"><b>Spending: real average</b> (${money(b.avgExpenses)} / month). <b>Income: your estimate</b>${estTag(true)} — log your income as transactions and it switches too.</p>`;
  return html`<p class="small" style="margin:0">${e ? html`<b>Using your estimates</b>${estTag(true)}` : html`<b>No estimates yet</b>`} — your real averages take over automatically after ${MIN_MONTHS === 1 ? 'one full calendar month' : `${MIN_MONTHS} full calendar months`} of logged transactions.</p>`;
}

// Full-page step in the first-launch flow (also reachable at #/setup)
export function estimatesView(el, { onDone, firstRun = false } = {}) {
  el.innerHTML = String(html`<div class="onboard">
    ${firstRun ? html`<div class="small muted">Step 2 of 3</div>` : ''}
    <h1>A few starting numbers</h1>
    <p class="muted">Ledgerline shows long-term figures — savings rate, emergency-fund months, financial-independence progress, month-end projections, year-on-year growth. They need about a month of history to be meaningful.
      Give rough estimates now and they're used as placeholders; once you've logged a <b>full calendar month</b> of transactions, your real averages replace them automatically. Anything based on an estimate is marked ${estTag(true)}.</p>
    <div class="card mt">${estimatesForm()}</div>
    <div class="note mt">${estimateStatus()}</div>
    <div class="row mt"><button class="btn ghost" data-skip>${firstRun ? 'Skip for now' : 'Cancel'}</button><span class="spacer"></span><button class="btn primary" data-save>${firstRun ? 'Save & continue to the tour' : 'Save estimates'}</button></div>
    <p class="small muted">Rough is fine — round numbers are perfect. You can change these any time in Settings → Starting estimates.</p></div>`);
  wireEstimatesForm(el);
  el.querySelector('[data-save]').onclick = async () => { await saveEstimates(el); toast('Starting estimates saved'); onDone?.(true); };
  el.querySelector('[data-skip]').onclick = () => onDone?.(false);
}
export { displayCcy };
