import * as store from '../store.js';
import { html, raw, modal, toast, download, readFileText, today, pad } from '../ui.js';
import { computedTrades, ASSET_CLASSES, FUTURES } from './calc.js';
import { setupName, accountName } from './common.js';

export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  const delim = (() => { const first = text.split(/\r?\n/)[0] || ''; const c = { ',': 0, ';': 0, '\t': 0 }; for (const ch of first) if (ch in c) c[ch]++; return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; })();
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function exportTradesCSV() {
  const ts = computedTrades().sort((a, b) => (a.openDate || '').localeCompare(b.openDate || ''));
  const cols = [
    ['account', t => accountName(t.accountId)], ['symbol', t => t.symbol], ['asset_class', t => t.assetClass], ['side', t => t.side], ['multiplier', t => t.mult],
    ['open_datetime', t => t.openDate], ['close_datetime', t => t.closeDate], ['qty', t => t.maxPos], ['avg_entry', t => t.avgEntry], ['avg_exit', t => t.avgExit],
    ['days_held', t => (t.daysHeld == null ? '' : +t.daysHeld.toFixed(2))], ['fees', t => t.fees], ['funding', t => t.funding || ''], ['gross_pnl', t => t.gross], ['net_pnl', t => t.net], ['stop', t => t.stop], ['target', t => t.target], ['risk', t => t.risk], ['r_multiple', t => t.r],
    ['mae', t => t.mae], ['mfe', t => t.mfe], ['setup', t => (t.setupId ? setupName(t.setupId) : '')], ['thesis', t => t.thesis], ['catalyst', t => t.catalyst], ['timeframe', t => t.timeframe], ['regime', t => t.regime], ['sector', t => t.sector], ['conviction', t => t.conviction], ['exit_reason', t => t.exitReason], ['current_stop', t => t.currentStop], ['grade', t => t.grade], ['followed_plan', t => t.followedPlan],
    ['tags', t => (t.tags || []).join(';')], ['mistakes', t => (t.mistakes || []).join(';')], ['emotions', t => (t.emotions || []).join(';')], ['review', t => t.review || t.notes], ['lessons', t => t.lessons],
  ];
  const out = [cols.map(c => c[0]).join(','), ...ts.map(t => cols.map(([, f]) => csvCell(f(t) ?? '')).join(','))].join('\n');
  download(`trades-${today()}.csv`, out, 'text/csv');
}

const FIELDS = [
  ['symbol', 'Symbol', true, ['symbol', 'ticker', 'instrument', 'contract', 'market']],
  ['side', 'Side (long/short, buy/sell)', false, ['side', 'direction', 'type', 'action', 'long/short', 'b/s']],
  ['open', 'Open date / datetime', true, ['open_datetime', 'open date', 'opened', 'entry date', 'entry time', 'open time', 'date', 'datetime', 'entry_date']],
  ['openTime', 'Open time (if separate)', false, ['open_time', 'entry_time', 'time']],
  ['close', 'Close date / datetime', false, ['close_datetime', 'close date', 'closed', 'exit date', 'exit time', 'close time', 'exit_date']],
  ['closeTime', 'Close time (if separate)', false, ['close_time', 'exit_time']],
  ['qty', 'Quantity', true, ['qty', 'quantity', 'size', 'shares', 'contracts', 'volume', 'lots', 'amount']],
  ['entry', 'Entry price', true, ['avg_entry', 'entry price', 'entry', 'open price', 'buy price', 'price in', 'entry_price']],
  ['exit', 'Exit price', false, ['avg_exit', 'exit price', 'exit', 'close price', 'sell price', 'price out', 'exit_price']],
  ['fees', 'Fees / commission', false, ['fees', 'fee', 'commission', 'commissions', 'costs']],
  ['stop', 'Stop loss', false, ['stop', 'stop loss', 'sl', 'stop_loss']],
  ['target', 'Target', false, ['target', 'take profit', 'tp']],
  ['asset', 'Asset class', false, ['asset_class', 'asset class', 'asset', 'instrument type', 'sec type']],
  ['multiplier', 'Multiplier / point value', false, ['multiplier', 'point value', 'contract size']],
  ['setup', 'Setup / strategy', false, ['setup', 'strategy', 'playbook']],
  ['account', 'Account', false, ['account', 'account name']],
  ['tags', 'Tags (; separated)', false, ['tags', 'tag']],
  ['mistakes', 'Mistakes (; separated)', false, ['mistakes']],
  ['notes', 'Notes', false, ['notes', 'note', 'comment', 'comments']],
];

function guess(headers, aliases) {
  const h = headers.map(x => x.trim().toLowerCase());
  for (const a of aliases) { const i = h.indexOf(a); if (i >= 0) return i; }
  for (const a of aliases) { const i = h.findIndex(x => x.includes(a)); if (i >= 0) return i; }
  return -1;
}

function parseDate(s, fmt) {
  s = (s || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?\s*(AM|PM)?/i);
  let y, mo, d, h = 0, mi = 0, ap;
  if (m) [, y, mo, d, h = 0, mi = 0, ap] = m;
  else {
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::\d{2})?)?\s*(AM|PM)?/i);
    if (!m) { const dt = new Date(s); return isNaN(dt) ? null : `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`; }
    let a, b;
    [, a, b, y, h = 0, mi = 0, ap] = m;
    if (y.length === 2) y = '20' + y;
    if (fmt === 'dmy' || (fmt === 'auto' && +a > 12)) { d = a; mo = b; } else { mo = a; d = b; }
  }
  h = +h;
  if (ap) { if (/pm/i.test(ap) && h < 12) h += 12; if (/am/i.test(ap) && h === 12) h = 0; }
  return `${y}-${pad(+mo)}-${pad(+d)}T${pad(h)}:${pad(+mi)}`;
}
const withTime = (dt, t) => { if (!dt || !t) return dt; const m = t.trim().match(/^(\d{1,2}):(\d{2})/); return m ? `${dt.slice(0, 10)}T${pad(+m[1])}:${m[2]}` : dt; };
const numv = s => { if (s == null) return null; const c = String(s).replace(/[$€£\s]/g, '').replace(/,(?=\d{3}\b)/g, ''); const v = parseFloat(c.replace(',', '.')); return isFinite(v) ? v : null; };

export async function importTradesCSVDialog() {
  const file = await new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.csv,text/csv,.txt'; i.onchange = () => res(i.files[0]); i.click(); });
  if (!file) return false;
  const rows = parseCSV(await readFileText(file));
  if (rows.length < 2) { toast('No data rows found in that file', 'error'); return false; }
  const headers = rows[0], data = rows.slice(1);
  const accts = store.all('tAccounts');
  const opt = (i, sel) => html`<option value="${i}" ${sel ? raw('selected') : ''}>${i < 0 ? '— not in file —' : headers[i]}</option>`;
  const res = await modal({
    title: `Import ${data.length} rows from ${file.name}`, wide: true,
    body: String(html`<p class="small muted">One row per round-trip trade. Map each field to a column from your file. Required fields are marked *.</p>
      <form id="mf" class="form-grid">${FIELDS.map(([k, l, req, al]) => { const g = guess(headers, al); return html`<label class="field">${l}${req ? ' *' : ''}<select name="${k}">${[-1, ...headers.map((_, i) => i)].map(i => opt(i, i === g))}</select></label>`; })}
        <label class="field">Date format<select name="_datefmt"><option value="auto">Auto-detect</option><option value="mdy">MM/DD/YYYY</option><option value="dmy">DD/MM/YYYY</option></select></label>
        <label class="field">Default account<select name="_account">${accts.map(a => html`<option value="${a.id}">${a.name}</option>`)}<option value="_new">New account "Imported"</option></select></label>
        <label class="field">Default asset class<select name="_asset">${ASSET_CLASSES.map(a => html`<option value="${a.id}">${a.label}</option>`)}</select></label>
      </form>
      <h3 class="mt">Preview</h3><div class="table-wrap" style="max-height:180px"><table class="data compact"><thead><tr>${headers.map(h => html`<th>${h}</th>`)}</tr></thead><tbody>${data.slice(0, 5).map(r => html`<tr>${r.map(c => html`<td>${c}</td>`)}</tr>`)}</tbody></table></div>`),
    actions: [{ label: 'Cancel' }, { label: 'Import trades', kind: 'primary', value: w => {
      const f = Object.fromEntries([...w.querySelectorAll('#mf select')].map(s => [s.name, s.value]));
      for (const [k, l, req] of FIELDS) if (req && f[k] === '-1') { toast(`Map a column for "${l}"`, 'error'); return false; }
      return f;
    } }],
  });
  if (!res || typeof res !== 'object') return false;

  let accountId = res._account;
  if (accountId === '_new' || !accountId) accountId = (await store.put('tAccounts', { name: 'Imported', type: 'margin', startingBalance: 0 })).id;
  const col = (r, k) => (res[k] === '-1' ? '' : (r[+res[k]] ?? '').trim());
  const setupByName = new Map(store.all('setups').map(s => [s.name.toLowerCase(), s.id]));
  const acctByName = new Map(store.all('tAccounts').map(a => [a.name.toLowerCase(), a.id]));
  const out = [];
  let skipped = 0;
  for (const r of data) {
    const symbol = col(r, 'symbol').toUpperCase();
    let qty = numv(col(r, 'qty'));
    const entry = numv(col(r, 'entry'));
    const open = withTime(parseDate(col(r, 'open'), res._datefmt), col(r, 'openTime'));
    if (!symbol || !qty || entry == null || !open) { skipped++; continue; }
    const sideRaw = col(r, 'side').toLowerCase();
    let side = /^(s|sh|short|sell|sld|sold)/.test(sideRaw) ? 'short' : 'long';
    if (!sideRaw && qty < 0) side = 'short';
    qty = Math.abs(qty);
    const exit = numv(col(r, 'exit'));
    const close = withTime(parseDate(col(r, 'close'), res._datefmt), col(r, 'closeTime')) || (exit != null ? open : null);
    const fees = Math.abs(numv(col(r, 'fees')) || 0);
    const assetRaw = col(r, 'asset').toLowerCase();
    const asset = ASSET_CLASSES.find(a => assetRaw && (assetRaw.startsWith(a.id) || a.label.toLowerCase().includes(assetRaw)))?.id || (/opt/.test(assetRaw) ? 'option' : /fut/.test(assetRaw) ? 'future' : /fx|forex|cash/.test(assetRaw) ? 'forex' : res._asset);
    let mult = numv(col(r, 'multiplier'));
    if (!mult) mult = asset === 'option' ? 100 : asset === 'future' ? FUTURES[symbol.replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '')] || 1 : 1;
    let setupId = '';
    const sn = col(r, 'setup');
    if (sn) {
      setupId = setupByName.get(sn.toLowerCase());
      if (!setupId) { const s = await store.put('setups', { name: sn, rules: [], active: true }); setupId = s.id; setupByName.set(sn.toLowerCase(), s.id); }
    }
    const an = col(r, 'account').toLowerCase();
    const openAct = side === 'short' ? 'sell' : 'buy', closeAct = side === 'short' ? 'buy' : 'sell';
    const executions = [{ id: store.uid(), action: openAct, datetime: open, qty, price: entry, fee: exit != null ? fees / 2 : fees }];
    if (exit != null) executions.push({ id: store.uid(), action: closeAct, datetime: close, qty, price: exit, fee: fees / 2 });
    const list = k => col(r, k).split(/[;|]/).map(x => x.trim()).filter(Boolean);
    out.push({
      accountId: (an && acctByName.get(an)) || accountId, symbol, assetClass: asset, side, multiplier: mult, executions,
      stop: numv(col(r, 'stop')), target: numv(col(r, 'target')), setupId, tags: list('tags'), mistakes: list('mistakes'), emotions: [], notes: col(r, 'notes'), images: [],
    });
  }
  if (out.length) await store.putMany('trades', out);
  toast(`Imported ${out.length} trades${skipped ? `, skipped ${skipped} incomplete rows` : ''}`, out.length ? 'info' : 'error');
  return out.length > 0;
}
