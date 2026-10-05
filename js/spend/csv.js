// Import transactions from a bank / card export, and export everything as CSV.
// Banks usually give one signed amount column (negative = money out) or separate debit/credit columns.
// Known merchants/descriptions are auto-categorised from your earlier transactions; duplicates are skipped.
import * as store from '../store.js';
import { html, raw, modal, toast, download, readFileText, today } from '../ui.js';
import { CURRENCIES, displayCcy } from '../fx.js';
import { parseCSV, parseDate, numv, guess, toCSV } from '../csv.js';
import { expenseCats, incomeCats, catById } from './categories.js';

const FIELDS = [
  ['date', 'Date', true, ['date', 'transaction date', 'booking date', 'value date', 'posted', 'completed date', 'started date', 'datum']],
  ['amount', 'Amount (signed, or all spending)', false, ['amount', 'sum', 'value', 'betrag', 'importe', 'montant']],
  ['debit', 'Money out (if separate)', false, ['debit', 'withdrawal', 'paid out', 'money out', 'outflow']],
  ['credit', 'Money in (if separate)', false, ['credit', 'deposit', 'paid in', 'money in', 'inflow']],
  ['desc', 'Description / payee', false, ['description', 'payee', 'merchant', 'name', 'details', 'reference', 'narrative', 'memo', 'counterparty']],
  ['category', 'Category', false, ['category', 'type']],
  ['currency', 'Currency', false, ['currency', 'ccy']],
  ['note', 'Note', false, ['note', 'notes', 'comment']],
];

export function exportTxnsCSV() {
  const rows = [...store.all('txns')].sort((a, b) => a.date.localeCompare(b.date));
  const head = ['date', 'type', 'amount', 'currency', 'category', 'subcategory', 'note', 'merchant', 'payment_method', 'need_or_want', 'tags', 'excluded', 'recurring'];
  const body = rows.map(t => [t.date, t.type || 'expense', t.amount, t.currency || displayCcy(), catById(t.category).name, t.sub || '', t.note || '', t.merchant || '', t.method || '', t.kind || '', (t.tags || []).join(';'), t.exclude ? 'yes' : '', t.recurringId ? 'yes' : '']);
  download(`transactions-${today()}.csv`, toCSV([head, ...body]), 'text/csv');
}

export async function importTxnsDialog() {
  const file = await new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.csv,text/csv,.txt'; i.onchange = () => res(i.files[0]); i.click(); });
  if (!file) return false;
  const rows = parseCSV(await readFileText(file));
  if (rows.length < 2) { toast('No data rows found in that file', 'error'); return false; }
  const headers = rows[0], data = rows.slice(1);
  const opt = (i, sel) => html`<option value="${i}" ${sel ? raw('selected') : ''}>${i < 0 ? '— not in file —' : headers[i]}</option>`;
  const res = await modal({
    title: `Import ${data.length} rows from ${file.name}`, wide: true,
    body: String(html`<p class="small muted">Map the columns from your bank's export. You need a date and either one amount column or separate money-out / money-in columns.</p>
      <form id="mf" class="form-grid">${FIELDS.map(([k, l, req, al]) => { const g = guess(headers, al); return html`<label class="field">${l}${req ? ' *' : ''}<select name="${k}">${[-1, ...headers.map((_, i) => i)].map(i => opt(i, i === g))}</select></label>`; })}
        <label class="field">Amount sign<select name="_sign"><option value="bank">Negative = expense, positive = income (most banks)</option><option value="spend">All amounts are expenses</option><option value="inverse">Positive = expense, negative = income</option></select></label>
        <label class="field">Date format<select name="_datefmt"><option value="auto">Auto-detect</option><option value="dmy">DD/MM/YYYY</option><option value="mdy">MM/DD/YYYY</option></select></label>
        <label class="field">Currency (if not in file)<select name="_ccy">${CURRENCIES.map(c => html`<option ${c === displayCcy() ? raw('selected') : ''}>${c}</option>`)}</select></label>
        <label class="field">Unknown categories go to<select name="_cat">${expenseCats().map(c => html`<option value="${c.id}" ${c.id === 'other' ? raw('selected') : ''}>${c.emoji} ${c.name}</option>`)}</select></label>
      </form>
      <h3 class="mt">Preview</h3><div class="table-wrap" style="max-height:180px"><table class="data compact"><thead><tr>${headers.map(h => html`<th>${h}</th>`)}</tr></thead><tbody>${data.slice(0, 5).map(r => html`<tr>${r.map(c => html`<td>${c}</td>`)}</tr>`)}</tbody></table></div>`),
    actions: [{ label: 'Cancel' }, { label: 'Import', kind: 'primary', value: w => {
      const f = Object.fromEntries([...w.querySelectorAll('#mf select')].map(s => [s.name, s.value]));
      if (f.date === '-1') { toast('Map the date column', 'error'); return false; }
      if (f.amount === '-1' && f.debit === '-1' && f.credit === '-1') { toast('Map an amount column (or money out / money in)', 'error'); return false; }
      return f;
    } }],
  });
  if (!res || typeof res !== 'object') return false;

  const col = (r, k) => (res[k] === '-1' ? '' : (r[+res[k]] ?? '').trim());
  const byName = new Map([...expenseCats(), ...incomeCats()].map(c => [c.name.toLowerCase(), c.id]));
  // learn from your own history: description/merchant → category
  const learned = new Map();
  for (const t of store.all('txns')) for (const k of [t.merchant, t.note]) if (k) learned.set(k.trim().toLowerCase(), t.category);
  const seen = new Set(store.all('txns').map(t => `${t.date}|${(+t.amount).toFixed(2)}|${(t.note || '').toLowerCase()}`));
  const out = []; let skipped = 0, dupes = 0;
  for (const r of data) {
    const date = parseDate(col(r, 'date'), res._datefmt);
    let v = null;
    if (res.amount !== '-1') v = numv(col(r, 'amount'));
    else { const d = numv(col(r, 'debit')), c = numv(col(r, 'credit')); v = d ? -Math.abs(d) : c ? Math.abs(c) : null; }
    if (!date || v == null || v === 0) { skipped++; continue; }
    const type = res._sign === 'spend' ? 'expense' : res._sign === 'inverse' ? (v > 0 ? 'expense' : 'income') : (v < 0 ? 'expense' : 'income');
    const desc = col(r, 'desc'), catRaw = col(r, 'category').toLowerCase();
    const ccy = col(r, 'currency').toUpperCase();
    let category = byName.get(catRaw) || learned.get(desc.toLowerCase());
    if (!category || (type === 'income') !== !!catById(category).income) category = type === 'income' ? 'other-income' : res._cat;
    const note = col(r, 'note') || desc;
    const key = `${date}|${Math.abs(v).toFixed(2)}|${note.toLowerCase()}`;
    if (seen.has(key)) { dupes++; continue; }
    seen.add(key);
    out.push({ type, date, amount: Math.abs(v), currency: CURRENCIES.includes(ccy) ? ccy : res._ccy, category, note: note.slice(0, 120), merchant: desc.slice(0, 60), imported: file.name.slice(0, 60) });
  }
  if (out.length) await store.putMany('txns', out);
  toast(`Imported ${out.length} transaction${out.length === 1 ? '' : 's'}${dupes ? ` · ${dupes} already there` : ''}${skipped ? ` · ${skipped} rows without a date or amount skipped` : ''}`, out.length ? 'info' : 'error');
  return out.length > 0;
}
