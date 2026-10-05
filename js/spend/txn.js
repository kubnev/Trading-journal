// Add / edit a transaction. Simple: type, amount, category, date, note. Pro adds subcategory,
// merchant, payment method, account, need/want, tags, "exclude from stats" and "repeats".
import * as store from '../store.js';
import { html, raw, modal, toast, today, toNum } from '../ui.js';
import { ccySelect, displayCcy } from '../fx.js';
import { catsFor, catById, KINDS } from './categories.js';
import { FREQS, nextDate } from './calc.js';
import { simpleMode } from '../networth/calc.js';

const lastCcy = () => { try { return localStorage.getItem('tj.lastCcy') || displayCcy(); } catch { return displayCcy(); } };
const chips = (type, sel) => html`${catsFor(type).map(c => html`<label class="cat-chip"><input type="radio" name="category" value="${c.id}" ${c.id === sel ? raw('checked') : ''}><span>${c.emoji || '•'} ${c.name}</span></label>`)}`;
const subOpts = (catId, sel) => html`<option value="">—</option>${[...new Set([...(catById(catId).subs || []), ...(sel ? [sel] : [])])].map(s => html`<option ${s === sel ? raw('selected') : ''}>${s}</option>`)}`;

// returns the saved transaction, 'deleted', or null
export async function txnModal(t = {}, { date } = {}) {
  const pro = !simpleMode();
  const editing = !!t.id;
  let type = t.type || 'expense';
  const merchants = [...new Set(store.all('txns').map(x => (x.merchant || '').trim()).filter(Boolean))].slice(0, 200);
  const accts = store.all('nwAccounts').filter(a => !a.archivedAt);
  const methods = store.getSettings().payMethods || [];
  const res = await modal({
    title: editing ? 'Edit transaction' : 'Add transaction', wide: true,
    body: String(html`<form id="txf" class="form-grid" autocomplete="off">
      <div class="field full"><div class="seg type-seg" role="radiogroup"><button type="button" data-type="expense" class="${type !== 'income' ? 'on' : ''}">Expense</button><button type="button" data-type="income" class="${type === 'income' ? 'on' : ''}">Income</button></div><input type="hidden" name="type" value="${type}"></div>
      <label class="field">Amount<input name="amount" type="number" step="any" min="0" inputmode="decimal" required value="${t.amount ?? ''}" class="amount-input" placeholder="0.00"></label>
      <label class="field">Currency${raw(ccySelect('currency', t.currency || lastCcy()))}</label>
      <label class="field">Date<input name="date" type="date" required value="${t.date || date || today()}"></label>
      <div class="field full">Category<div class="cat-chips" id="cats">${chips(type, t.category)}</div></div>
      ${pro ? html`<label class="field">Subcategory<select name="sub">${subOpts(t.category, t.sub)}</select></label>` : ''}
      <label class="field ${pro ? '' : 'span2'}">Note <span class="hint">what was it?</span><input name="note" value="${t.note || ''}" maxlength="120" placeholder="e.g. Lunch with Alex"></label>
      ${pro ? html`<label class="field">Merchant / payee<input name="merchant" value="${t.merchant || ''}" list="merchants" maxlength="60"><datalist id="merchants">${merchants.map(m => html`<option>${m}</option>`)}</datalist></label>
        <label class="field">Payment method<select name="method"><option value="">—</option>${[...new Set([...methods, ...(t.method ? [t.method] : [])])].map(m => html`<option ${m === t.method ? raw('selected') : ''}>${m}</option>`)}</select></label>
        <label class="field">Paid from / to account<select name="accountId"><option value="">—</option>${accts.map(a => html`<option value="${a.id}" ${a.id === t.accountId ? raw('selected') : ''}>${a.name}</option>`)}</select></label>
        <label class="field kindf">Need or want<select name="kind"><option value="">Auto</option>${Object.entries(KINDS).map(([k, l]) => html`<option value="${k}" ${t.kind === k ? raw('selected') : ''}>${l}</option>`)}</select></label>
        <label class="field">Tags <span class="hint">comma separated</span><input name="tags" value="${(t.tags || []).join(', ')}" maxlength="120" placeholder="holiday, work"></label>
        ${!editing ? html`<label class="field">Repeats<select name="repeat"><option value="">No</option>${Object.entries(FREQS).map(([k, l]) => html`<option value="${k}">${l}</option>`)}</select></label>` : ''}
        <label class="check full"><input type="checkbox" name="exclude" ${t.exclude ? raw('checked') : ''}> Leave out of totals and budgets (e.g. a reimbursed work expense)</label>` : ''}
    </form>`),
    onMount: w => {
      const f = w.querySelector('#txf');
      const setType = ty => {
        type = ty; f.type.value = ty;
        w.querySelectorAll('[data-type]').forEach(b => b.classList.toggle('on', b.dataset.type === ty));
        const cur = f.querySelector('[name=category]:checked')?.value;
        w.querySelector('#cats').innerHTML = String(chips(ty, catsFor(ty).some(c => c.id === cur) ? cur : ''));
        const kf = w.querySelector('.kindf'); if (kf) kf.hidden = ty === 'income';
        if (f.sub) f.sub.innerHTML = String(subOpts(f.querySelector('[name=category]:checked')?.value, ''));
      };
      w.querySelectorAll('[data-type]').forEach(b => b.onclick = () => setType(b.dataset.type));
      w.querySelector('#cats').addEventListener('change', () => { if (f.sub) f.sub.innerHTML = String(subOpts(f.querySelector('[name=category]:checked')?.value, '')); });
      const kf = w.querySelector('.kindf'); if (kf) kf.hidden = type === 'income';
      setTimeout(() => f.amount.focus());
    },
    actions: [
      ...(editing ? [{ label: 'Delete', kind: 'danger ghost', value: () => 'delete' }] : []),
      { label: 'Cancel' },
      ...(!editing ? [{ label: 'Save & add another', value: w => read(w, true) }] : []),
      { label: 'Save', kind: 'primary', value: w => read(w, false) },
    ],
  });
  if (res === 'delete') { await store.del('txns', t.id); toast('Transaction deleted'); return 'deleted'; }
  if (!res || typeof res !== 'object') return null;
  const { again, repeat, ...d } = res;
  const obj = { ...t, ...d };
  const saved = await store.put('txns', obj);
  try { localStorage.setItem('tj.lastCcy', obj.currency); } catch {}
  if (repeat) {
    const r = await store.put('recurring', { name: obj.note || obj.merchant || catById(obj.category).name, type: obj.type, amount: obj.amount, currency: obj.currency, category: obj.category, sub: obj.sub || '', merchant: obj.merchant || '', method: obj.method || '', freq: repeat, day: +obj.date.slice(8, 10), auto: true, next: nextDate({ freq: repeat, day: +obj.date.slice(8, 10) }, obj.date) });
    await store.put('txns', { ...saved, recurringId: r.id });
  }
  toast(editing ? 'Transaction updated' : `${obj.type === 'income' ? 'Income' : 'Expense'} saved`);
  if (again) return txnModal({ type: obj.type, currency: obj.currency, category: obj.category }, { date: obj.date });
  return saved;
}

function read(w, again) {
  const f = w.querySelector('#txf');
  const amount = toNum(f.amount.value);
  if (!(amount > 0)) { toast('Enter an amount above zero', 'error'); f.amount.focus(); return false; }
  const category = f.querySelector('[name=category]:checked')?.value;
  if (!category) { toast('Pick a category', 'error'); return false; }
  if (!f.date.value) { toast('Pick a date', 'error'); return false; }
  const o = { type: f.type.value === 'income' ? 'income' : 'expense', amount, currency: f.currency.value, date: f.date.value, category, note: f.note.value.trim() };
  if (f.merchant) Object.assign(o, {
    sub: f.sub.value, merchant: f.merchant.value.trim(), method: f.method.value, accountId: f.accountId.value,
    kind: o.type === 'income' ? '' : f.kind.value, tags: f.tags.value.split(',').map(x => x.trim()).filter(Boolean).slice(0, 10),
    exclude: f.exclude.checked, repeat: f.repeat?.value || '',
  });
  return { ...o, again };
}
