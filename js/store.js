// Local-first persistence. Everything lives in this browser's IndexedDB.
// Collections are loaded into memory at startup; writes go through to IDB.

const DB_NAME = 'ledgerline';
const DB_VERSION = 1;

export const COLLECTIONS = [
  'trades',        // trading: individual trades (with executions)
  'tAccounts',     // trading: brokerage / prop accounts
  'tTransfers',    // trading: deposits & withdrawals per account
  'setups',        // trading: playbook setups
  'days',          // trading: daily journal entries (keyed by date)
  'nwAccounts',    // net worth: assets & liabilities
  'nwSnapshots',   // net worth: dated balance snapshots
  'nwCashflow',    // net worth: monthly income / expenses
];
const BLOB_STORE = 'images';
const META_STORE = 'meta';

export const DEFAULT_SETTINGS = {
  theme: 'auto',                  // 'auto' follows the OS setting
  currency: 'USD',
  locale: undefined,
  pnlColors: 'greenred',
  priceApi: { finnhubKey: '', lastUpdate: null },
  lastBackupAt: null,          // or 'blueorange' (colour-vision friendly)
  mode: 'simple',                 // 'simple' | 'pro' — one switch for the whole app
  tagLists: {
    tags: ['A+ setup', 'Trend day', 'Range day', 'News', 'Gap', 'High volatility', 'Low volume', 'Earnings'],
    mistakes: ['Entered early', 'Chased entry', 'Moved stop', 'No stop', 'Oversized', 'Cut winner early', 'Held loser', 'Revenge trade', 'FOMO', 'Overtraded', 'Ignored plan', 'Averaged down'],
    emotions: ['Calm', 'Confident', 'Focused', 'Anxious', 'Fearful', 'Greedy', 'Frustrated', 'Impatient', 'Bored', 'Euphoric', 'Tired'],
  },
  habits: ['Exercise', 'Reading', 'Meditation', 'Reviewed open positions', 'Followed trading rules', 'No impulse spending'],
  dayTags: ['Travel', 'Sick', 'Family', 'Busy work day', 'Holiday', 'High stress'],
  tour: { done: false },
  plan: {
    annualExpenses: 0,            // 0 → derived from cash-flow history
    withdrawalRate: 4,
    expectedReturn: 6,            // nominal % / yr
    inflation: 2.5,
    currentAge: 30,
    retirementAge: 60,
    monthlyContribution: 0,       // 0 → derived from cash-flow history
    targetAllocation: {},         // category → %
    emergencyMonths: 6,
  },
};

let db = null;
const mem = {};
let settings = structuredClone(DEFAULT_SETTINGS);
const listeners = new Set();

function req(r) {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const c of [...COLLECTIONS, BLOB_STORE]) if (!d.objectStoreNames.contains(c)) d.createObjectStore(c, { keyPath: 'id' });
      if (!d.objectStoreNames.contains(META_STORE)) d.createObjectStore(META_STORE, { keyPath: 'key' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function merge(base, over) {
  if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null ? merge(base[k], over[k]) : over[k];
  }
  return out;
}

export async function init() {
  db = await open();
  const tx = db.transaction([...COLLECTIONS, META_STORE], 'readonly');
  await Promise.all(COLLECTIONS.map(async c => { mem[c] = await req(tx.objectStore(c).getAll()); }));
  const s = await req(tx.objectStore(META_STORE).get('settings'));
  const saved = s?.value || {};
  // migrate the old per-section switches to the single global one
  if (!saved.mode && (saved.tradingMode || saved.networthMode)) saved.mode = saved.tradingMode === 'pro' || saved.networthMode === 'pro' ? 'pro' : 'simple';
  delete saved.tradingMode; delete saved.networthMode;
  settings = merge(structuredClone(DEFAULT_SETTINGS), saved);
  // Ask the browser not to evict our data under storage pressure.
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch {}
}

export function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 16);
}

export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(what) { for (const fn of listeners) fn(what); }

export const all = c => mem[c];
export const get = (c, id) => mem[c].find(x => x.id === id);

export async function put(c, obj) {
  if (!obj.id) obj.id = uid();
  obj.updatedAt = new Date().toISOString();
  if (!obj.createdAt) obj.createdAt = obj.updatedAt;
  const i = mem[c].findIndex(x => x.id === obj.id);
  if (i >= 0) mem[c][i] = obj; else mem[c].push(obj);
  const tx = db.transaction(c, 'readwrite');
  tx.objectStore(c).put(obj);
  await txDone(tx);
  emit(c);
  return obj;
}

export async function putMany(c, objs) {
  const tx = db.transaction(c, 'readwrite');
  const st = tx.objectStore(c);
  const now = new Date().toISOString();
  for (const o of objs) {
    if (!o.id) o.id = uid();
    o.createdAt ||= now; o.updatedAt = now;
    const i = mem[c].findIndex(x => x.id === o.id);
    if (i >= 0) mem[c][i] = o; else mem[c].push(o);
    st.put(o);
  }
  await txDone(tx);
  emit(c);
}

export async function del(c, id) {
  mem[c] = mem[c].filter(x => x.id !== id);
  const tx = db.transaction(c, 'readwrite');
  tx.objectStore(c).delete(id);
  await txDone(tx);
  emit(c);
}

export async function delWhere(c, pred) {
  const gone = mem[c].filter(pred);
  if (!gone.length) return 0;
  mem[c] = mem[c].filter(x => !pred(x));
  const tx = db.transaction(c, 'readwrite');
  for (const g of gone) tx.objectStore(c).delete(g.id);
  await txDone(tx);
  emit(c);
  return gone.length;
}

function txDone(tx) {
  return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });
}

// ---------- settings ----------
export const getSettings = () => settings;
export async function saveSettings(patch) {
  settings = merge(settings, patch);
  const tx = db.transaction(META_STORE, 'readwrite');
  tx.objectStore(META_STORE).put({ key: 'settings', value: settings });
  await txDone(tx);
  emit('settings');
}

// ---------- images (screenshots) ----------
export async function putImage(blob) {
  const id = uid();
  const tx = db.transaction(BLOB_STORE, 'readwrite');
  tx.objectStore(BLOB_STORE).put({ id, blob, type: blob.type, createdAt: new Date().toISOString() });
  await txDone(tx);
  return id;
}
export async function getImage(id) {
  const tx = db.transaction(BLOB_STORE, 'readonly');
  const r = await req(tx.objectStore(BLOB_STORE).get(id));
  return r?.blob || null;
}
export async function delImage(id) {
  const tx = db.transaction(BLOB_STORE, 'readwrite');
  tx.objectStore(BLOB_STORE).delete(id);
  await txDone(tx);
}
async function allImages() {
  const tx = db.transaction(BLOB_STORE, 'readonly');
  return req(tx.objectStore(BLOB_STORE).getAll());
}

// ---------- backup ----------
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
const dataURLToBlob = async u => (await fetch(u)).blob();

export async function exportBackup({ includeImages = true } = {}) {
  const out = { app: 'ledgerline', version: 1, exportedAt: new Date().toISOString(), settings, data: {} };
  for (const c of COLLECTIONS) out.data[c] = mem[c];
  if (includeImages) {
    out.images = [];
    for (const im of await allImages()) out.images.push({ id: im.id, data: await blobToDataURL(im.blob) });
  }
  return out;
}

export async function importBackup(obj, { mode = 'replace' } = {}) {
  if (!obj || obj.app !== 'ledgerline' || !obj.data) throw new Error('This file is not a Ledgerline backup.');
  if (mode === 'replace') await clearAll({ keepSettings: true });
  for (const c of COLLECTIONS) if (Array.isArray(obj.data[c]) && obj.data[c].length) {
    const tx = db.transaction(c, 'readwrite');
    for (const o of obj.data[c]) {
      tx.objectStore(c).put(o);
      const i = mem[c].findIndex(x => x.id === o.id);
      if (i >= 0) mem[c][i] = o; else mem[c].push(o);
    }
    await txDone(tx);
  }
  if (Array.isArray(obj.images)) {
    for (const im of obj.images) {
      const blob = await dataURLToBlob(im.data);
      const tx = db.transaction(BLOB_STORE, 'readwrite');
      tx.objectStore(BLOB_STORE).put({ id: im.id, blob, type: blob.type });
      await txDone(tx);
    }
  }
  if (obj.settings && mode === 'replace') await saveSettings(obj.settings);
  emit('*');
}

export async function clearAll({ keepSettings = false } = {}) {
  const stores = [...COLLECTIONS, BLOB_STORE, ...(keepSettings ? [] : [META_STORE])];
  const tx = db.transaction(stores, 'readwrite');
  for (const s of stores) tx.objectStore(s).clear();
  await txDone(tx);
  for (const c of COLLECTIONS) mem[c] = [];
  if (!keepSettings) settings = structuredClone(DEFAULT_SETTINGS);
  emit('*');
}

export async function storageEstimate() {
  try { return await navigator.storage.estimate(); } catch { return null; }
}
export async function isPersisted() {
  try { return await navigator.storage.persisted(); } catch { return false; }
}
