// Generic CSV helpers: parsing (auto-detects , ; or tab, quotes, Excel BOM), dates and numbers as banks write them.
import { pad } from './ui.js';

export function parseCSV(text) {
  text = String(text || '').replace(/^\uFEFF/, '');   // Excel adds a byte-order mark
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

export const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCSV = rows => rows.map(r => r.map(csvCell).join(',')).join('\n');

// → 'YYYY-MM-DD' (fmt: 'auto' | 'dmy' | 'mdy')
function parseDT(s, fmt) {
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
export const parseDate = (s, fmt = 'auto') => parseDT(s, fmt)?.slice(0, 10) || null;
export const numv = s => {
  if (s == null) return null;
  let c = String(s).trim().replace(/[$€£¥\s\u00a0']/g, '');
  if (!c) return null;
  let neg = false;
  if (/^\(.*\)$/.test(c)) { neg = true; c = c.slice(1, -1); }
  const lc = c.lastIndexOf(','), ld = c.lastIndexOf('.');
  if (lc > -1 && ld > -1) c = lc > ld ? c.replace(/\./g, '').replace(',', '.') : c.replace(/,/g, '');   // both separators: the last one is the decimal
  else if (lc > -1) c = /^-?\d{1,3}(,\d{3})+$/.test(c) ? c.replace(/,/g, '') : c.replace(',', '.');  // 1,234 → thousands; 12,5 → decimal
  const v = parseFloat(c);
  return isFinite(v) ? (neg ? -v : v) : null;
};

export function guess(headers, aliases) {
  const h = headers.map(x => x.trim().toLowerCase());
  for (const a of aliases) { const i = h.indexOf(a); if (i >= 0) return i; }
  for (const a of aliases) { const i = h.findIndex(x => x.includes(a)); if (i >= 0) return i; }
  return -1;
}

