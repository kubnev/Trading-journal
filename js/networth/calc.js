// Net worth calculations. Pure functions over the store.
import { all, getSettings } from '../store.js';
import { toDisplay, ccyOf } from '../fx.js';
import { today, monthKey, parseDay } from '../ui.js';

// liquid: can be turned into cash within days without major loss
export const ASSET_CATS = [
  { id: 'cash', label: 'Cash & checking', liquid: true },
  { id: 'savings', label: 'Savings & money market', liquid: true },
  { id: 'brokerage', label: 'Taxable investments', liquid: true },
  { id: 'trading', label: 'Trading accounts', liquid: true },
  { id: 'retirement', label: 'Retirement & pension', liquid: false },
  { id: 'crypto', label: 'Crypto', liquid: true },
  { id: 'realestate', label: 'Real estate', liquid: false },
  { id: 'business', label: 'Business equity', liquid: false },
  { id: 'vehicle', label: 'Vehicles', liquid: false },
  { id: 'receivable', label: 'Money owed to you', liquid: false },
  { id: 'otherasset', label: 'Other assets', liquid: false },
];
export const LIAB_CATS = [
  { id: 'mortgage', label: 'Mortgage', shortTerm: false },
  { id: 'auto', label: 'Auto loan', shortTerm: false },
  { id: 'student', label: 'Student loan', shortTerm: false },
  { id: 'credit', label: 'Credit card', shortTerm: true },
  { id: 'personal', label: 'Personal loan', shortTerm: false },
  { id: 'margin', label: 'Margin / securities loan', shortTerm: true },
  { id: 'tax', label: 'Taxes owed', shortTerm: true },
  { id: 'otherdebt', label: 'Other debt', shortTerm: false },
];
// Simple input mode: five kinds of asset + debt. Every detailed category belongs to exactly one,
// so switching modes never loses information (the detailed category is kept underneath).
export const GROUPS = [
  { id: 'cash', label: 'Cash', hint: 'Money you spend day to day — current account, card balance, wallet. Food, rent, going out.', cat: 'cash' },
  { id: 'savings', label: 'Savings', hint: 'Money you put aside — savings accounts, deposits, money-market funds.', cat: 'savings' },
  { id: 'trading', label: 'Trading capital', hint: 'Working capital in your trading accounts (broker, exchange).', cat: 'trading' },
  { id: 'investments', label: 'Investments', hint: 'Long-term holdings you don’t actively trade — ETFs, stocks, crypto you hold, pension.', cat: 'brokerage' },
  { id: 'assets', label: 'Assets', hint: 'Things you own outright — home, car, watches, collectibles, trading cards.', cat: 'otherasset' },
];
export const DEBT = { id: 'debt', label: 'Debt', hint: 'Anything you owe — loans, credit card balance, money borrowed from someone.', cat: 'otherdebt' };
const CAT_GROUP = { cash: 'cash', savings: 'savings', trading: 'trading', brokerage: 'investments', retirement: 'investments', crypto: 'investments', business: 'investments', realestate: 'assets', vehicle: 'assets', receivable: 'assets', otherasset: 'assets' };
export const groupOf = a => (a.kind === 'liability' ? 'debt' : CAT_GROUP[a.category] || 'assets');
export const groupInfo = id => GROUPS.find(g => g.id === id) || DEBT;
export const simpleMode = () => getSettings().mode !== 'pro';
// The breakdown used by charts and tables: simple types in Simple mode, detailed categories in Pro
export const assetCats = () => (simpleMode() ? GROUPS : ASSET_CATS);
export const liabCats = () => (simpleMode() ? [DEBT] : LIAB_CATS);
export const catKey = a => (simpleMode() ? groupOf(a) : a.category);
export const typeLabel = a => (simpleMode() ? groupInfo(groupOf(a)).label : catLabel(a.category));

export const catInfo = id => ASSET_CATS.find(c => c.id === id) || LIAB_CATS.find(c => c.id === id) || { id, label: id };
export const catLabel = id => catInfo(id).label;
export const isLiquid = a => (a.liquid === true || a.liquid === false ? a.liquid : !!catInfo(a.category).liquid);

// Where the money sits — counterparty / custody risk
export const CUSTODY = [
  { id: 'bank', label: 'Bank' },
  { id: 'broker', label: 'Broker / fund platform' },
  { id: 'cex', label: 'Crypto exchange (CEX)' },
  { id: 'dex', label: 'DeFi / DEX protocol' },
  { id: 'self', label: 'Self-custody wallet' },
  { id: 'physical', label: 'Physical / property' },
  { id: 'other', label: 'Other' },
];
const CUSTODY_DEFAULT = { cash: 'bank', savings: 'bank', brokerage: 'broker', trading: 'broker', retirement: 'broker', crypto: 'cex', realestate: 'physical', vehicle: 'physical', business: 'other', receivable: 'other', otherasset: 'other' };
export const custodyOf = a => a.custody || CUSTODY_DEFAULT[a.category] || 'other';
export const custodyLabel = id => CUSTODY.find(c => c.id === id)?.label || id;

// What the money is for — user-defined buckets with sensible defaults
export const PURPOSES = ['Emergency fund', 'Spending', 'Long-term investing', 'Retirement', 'Trading capital', 'Crypto', 'Short-term goals', 'Home & property', 'Personal assets', 'Business'];
const PURPOSE_DEFAULT = { cash: 'Spending', savings: 'Emergency fund', brokerage: 'Long-term investing', trading: 'Trading capital', retirement: 'Retirement', crypto: 'Crypto', realestate: 'Home & property', vehicle: 'Personal assets', business: 'Business', receivable: 'Short-term goals', otherasset: 'Personal assets' };
export const purposeOf = a => (a.purpose || '').trim() || PURPOSE_DEFAULT[a.category] || 'Other';

// Liquidity tiers (how fast you could get to the money)
export const TIERS = ['Cash — instant', 'Liquid investments — days', 'Locked / retirement', 'Illiquid — months+'];
export function tierOf(a) {
  if (['cash', 'savings'].includes(a.category)) return TIERS[0];
  if (a.category === 'retirement') return TIERS[2];
  return isLiquid(a) ? TIERS[1] : TIERS[3];
}

const sortedSnaps = () => [...all('nwSnapshots')].sort((a, b) => a.date.localeCompare(b.date));

// Value of one account on a date (carry-forward of the latest snapshot on/before the date)
export function valueAt(acct, date, snaps = sortedSnaps()) {
  if (acct.archivedAt && date >= acct.archivedAt) return 0;
  let v = null, from = null;
  for (const s of snaps) { if (s.date > date) break; if (s.balances && acct.id in s.balances && s.balances[acct.id] !== null && s.balances[acct.id] !== '') { v = +s.balances[acct.id]; from = s.date; } }
  // Fixed-yield accounts (savings, money-market funds, staking) grow daily from the last recorded balance
  if (v != null && +acct.apy > 0 && acct.kind !== 'liability' && from < date) v = grow(v, +acct.apy, (parseDay(date) - parseDay(from)) / 864e5);
  return v ?? 0;
}
// APY is the effective annual yield, so growth over d days is (1 + APY)^(d/365)
export const grow = (v, apy, days) => v * Math.pow(1 + apy / 100, days / 365);

// Value right now, to the second — for the live earnings ticker
export function liveValue(acct, now = new Date()) {
  const snaps = sortedSnaps();
  let v = null, from = null;
  for (const s of snaps) if (s.balances && acct.id in s.balances && s.balances[acct.id] !== '' && s.balances[acct.id] != null && s.date <= today()) { v = +s.balances[acct.id]; from = s.date; }
  if (v == null) return 0;
  return +acct.apy > 0 ? grow(v, +acct.apy, (now - parseDay(from)) / 864e5) : v;
}
export function yieldSummary(now = new Date()) {
  const accts = all('nwAccounts').filter(a => +a.apy > 0 && a.kind !== 'liability' && !a.archivedAt);
  let perYear = 0, value = 0;
  for (const a of accts) { const v = toDisplay(liveValue(a, now), ccyOf(a)); value += v; perYear += v * (a.apy / 100); }
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const earnedToday = accts.reduce((s, a) => s + toDisplay(liveValue(a, now) - liveValue(a, midnight), ccyOf(a)), 0);
  return { accts, value, perYear, perDay: perYear / 365, perMonth: perYear / 12, perSecond: perYear / 365 / 86400, earnedToday, blendedApy: value ? perYear / value : null };
}

export function pointAt(date, snaps = sortedSnaps()) {
  const accts = all('nwAccounts');
  // byAcctNative: in each account's own currency; everything else in the display currency
  const p = { date, assets: 0, liabilities: 0, liquid: 0, shortDebt: 0, byCat: {}, byAcct: {}, byAcctNative: {}, byCustody: {}, byPurpose: {}, byTier: {} };
  for (const a of accts) {
    const native = valueAt(a, date, snaps);
    const v = toDisplay(native, ccyOf(a), date);
    p.byAcctNative[a.id] = native;
    p.byAcct[a.id] = v;
    const k = catKey(a);
    p.byCat[k] = (p.byCat[k] || 0) + v;
    if (a.kind === 'liability') { p.liabilities += v; if (catInfo(a.category).shortTerm) p.shortDebt += v; }
    else {
      p.assets += v; if (isLiquid(a)) p.liquid += v;
      const c = custodyOf(a), pu = purposeOf(a), t = tierOf(a);
      p.byCustody[c] = (p.byCustody[c] || 0) + v; p.byPurpose[pu] = (p.byPurpose[pu] || 0) + v; p.byTier[t] = (p.byTier[t] || 0) + v;
    }
  }
  p.net = p.assets - p.liabilities;
  p.liquidNet = p.liquid - p.liabilities;
  return p;
}

// One point per snapshot date (plus today if linked accounts move on their own)
export function nwSeries() {
  const snaps = sortedSnaps();
  const dates = [...new Set(snaps.map(s => s.date))];
  if (!all('nwAccounts').length) return [];
  if (all('nwAccounts').some(a => +a.apy > 0) && dates.length && dates.at(-1) < today()) dates.push(today());
  if (!dates.length) return [];
  return dates.map(d => pointAt(d, snaps));
}

// ---------- spending baseline ----------
// Monthly spending from the Spending section (display currency)
export function spendMonths() {
  const m = new Map();
  for (const t of all('txns')) {
    if (t.exclude || !t.date || t.type === 'income') continue;
    const k = t.date.slice(0, 7);
    m.set(k, (m.get(k) || 0) + toDisplay(+t.amount || 0, ccyOf(t), t.date));
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([id, expenses]) => ({ id, expenses }));
}

// ---------- starting estimates ----------
// Your usual monthly spending: the average over complete calendar months after the month you
// started logging (the first, usually partial, month and the month in progress are left out).
// Until there's MIN_MONTHS of that, your starting estimate is used instead.
export const MIN_MONTHS = 1;
export const estimates = () => getSettings().estimates || {};
const estMoney = k => { const e = estimates(); return +e[k] > 0 ? toDisplay(+e[k], e.currency || 'USD') : null; };
export function baseline(n = 12) {
  const cur = today().slice(0, 7), months = spendMonths(), first = months[0]?.id;
  const m = months.filter(x => x.id < cur && x.id > first).slice(-n);
  const real = m.length >= MIN_MONTHS;
  const est = real ? null : estMoney('spending');
  const avgExpenses = real ? m.reduce((a, x) => a + x.expenses, 0) / m.length : est;
  return { realMonths: m.length, avgExpenses, estimated: { spending: est != null }, isEstimate: est != null };
}
// net worth about a year ago: real snapshot history first, otherwise the estimate
export function yearAgoEstimate() { const e = estimates(), v = e.nwYearAgo; return v === '' || v == null || !isFinite(+v) ? null : toDisplay(+v, e.currency || 'USD'); }

// change in net worth between consecutive balance updates
export function changes(series) {
  const out = [];
  for (let i = 1; i < series.length; i++) out.push({ date: series[i].date, change: series[i].net - series[i - 1].net });
  return out;
}

// ---------- interest ----------
// APY in force on a date. Each APY change is kept in apyHistory ({ from, apy }), so earlier
// periods are credited at the rate that applied then.
export function apyAt(a, date) {
  const h = [...(a.apyHistory || [])].sort((x, y) => x.from.localeCompare(y.from));
  if (!h.length) return +a.apy || 0;
  const e = h.filter(x => x.from <= date).at(-1) || h[0];
  return +e.apy || 0;
}
const daysBetween = (a, b) => (parseDay(b) - parseDay(a)) / 864e5;
// Interest an account has earned (estimate): between balance updates the recorded balance grows at
// the APY in force; a new update starts again from what you typed. In the account's own currency.
export function interestEarned(a, { to = today(), yearStart = `${to.slice(0, 4)}-01-01` } = {}) {
  const pts = sortedSnaps().filter(s => s.date <= to && s.balances && a.id in s.balances && s.balances[a.id] !== '' && s.balances[a.id] != null).map(s => ({ date: s.date, v: +s.balances[a.id] }));
  let total = 0, ytd = 0, sinceUpdate = 0;
  pts.forEach((p, i) => {
    const end = i + 1 < pts.length ? pts[i + 1].date : to;
    const r = apyAt(a, p.date);
    if (!(r > 0) || end <= p.date) return;
    const earned = grow(p.v, r, daysBetween(p.date, end)) - p.v;
    total += earned;
    if (end > yearStart) { const from = p.date > yearStart ? p.date : yearStart; ytd += grow(p.v, r, daysBetween(p.date, end)) - grow(p.v, r, daysBetween(p.date, from)); }
    if (i === pts.length - 1) sinceUpdate = earned;
  });
  return { total, ytd, sinceUpdate, lastUpdate: pts.at(-1)?.date || null, since: pts[0]?.date || null };
}
// Interest you earn (yield accounts) and pay (debts with an APR), in the display currency
export function interestOverview() {
  const accts = all('nwAccounts').filter(a => !a.archivedAt);
  const earn = accts.filter(a => a.kind !== 'liability' && +a.apy > 0).map(a => {
    const native = liveValue(a), value = toDisplay(native, ccyOf(a)), apy = +a.apy;
    const e = interestEarned(a);
    return { a, native, value, apy, perYear: value * apy / 100, perMonth: value * apy / 1200, perDay: value * apy / 36500,
      sinceUpdate: toDisplay(e.sinceUpdate, ccyOf(a)), ytd: toDisplay(e.ytd, ccyOf(a)), total: toDisplay(e.total, ccyOf(a)), lastUpdate: e.lastUpdate, since: e.since };
  }).sort((x, y) => y.perYear - x.perYear);
  const now = pointAt(today());
  const pay = accts.filter(a => a.kind === 'liability' && +a.rate > 0).map(a => {
    const owed = now.byAcct[a.id] || 0, rate = +a.rate;
    return { a, owed, rate, perYear: owed * rate / 100, perMonth: owed * rate / 1200 };
  }).filter(x => x.owed > 0).sort((x, y) => y.perYear - x.perYear);
  // money not earning anything: liquid assets with no APY (cash, savings, idle exchange balances)
  const idle = accts.filter(a => a.kind !== 'liability' && !(+a.apy > 0) && ['cash', 'savings'].includes(a.category)).map(a => ({ a, value: now.byAcct[a.id] || 0 })).filter(x => x.value > 0).sort((x, y) => y.value - x.value);
  const sum = (l, k) => l.reduce((s, x) => s + x[k], 0);
  const earnValue = sum(earn, 'value');
  return { earn, pay, idle, earnValue, earnYear: sum(earn, 'perYear'), earnMonth: sum(earn, 'perMonth'), payYear: sum(pay, 'perYear'), payMonth: sum(pay, 'perMonth'),
    ytd: sum(earn, 'ytd'), total: sum(earn, 'total'), sinceUpdate: sum(earn, 'sinceUpdate'), blended: earnValue ? sum(earn, 'perYear') / earnValue : null, idleValue: sum(idle, 'value') };
}

export function debtMetrics(point) {
  const debts = all('nwAccounts').filter(a => a.kind === 'liability' && !a.archivedAt);
  const total = debts.reduce((s, a) => s + (point.byAcct[a.id] || 0), 0);
  const withRate = debts.filter(a => +a.rate > 0);
  const wRate = total ? withRate.reduce((s, a) => s + (point.byAcct[a.id] || 0) * +a.rate, 0) / total : null;
  const minPay = debts.reduce((s, a) => s + toDisplay(+a.payment || 0, ccyOf(a)), 0);
  return { total, wRate, minPay, debts };
}

// Individual positions for concentration analysis: holdings are split out, other accounts count as one
export function positions(point) {
  const out = [];
  for (const a of all('nwAccounts')) {
    if (a.kind === 'liability' || a.archivedAt) continue;
    const v = point.byAcct[a.id] || 0;
    if (v <= 0) continue;
    if (a.tracksHoldings && (a.holdings || []).length) {
      const tot = (a.holdings || []).reduce((s, h) => s + (+h.qty || 0) * (+h.price || 0), 0) || 1;
      for (const h of a.holdings) { const hv = ((+h.qty || 0) * (+h.price || 0)) / tot * v; if (hv > 0) out.push({ label: `${h.symbol} (${a.name})`, symbol: h.symbol, value: hv, account: a.name }); }
    } else out.push({ label: a.name, value: v, account: a.name });
  }
  // merge the same symbol held in several places
  const m = new Map();
  for (const p of out) { const k = p.symbol || p.label; const e = m.get(k) || { label: p.symbol || p.label, value: 0, where: [] }; e.value += p.value; e.where.push(p.account); m.set(k, e); }
  return [...m.values()].sort((a, b) => b.value - a.value);
}
// Herfindahl–Hirschman index over position weights; 1/HHI = "effective number of positions"
export function concentration(list) {
  const tot = list.reduce((s, p) => s + p.value, 0);
  if (!tot) return { hhi: null, effective: null, top1: null, top5: null };
  const w = list.map(p => p.value / tot);
  const hhi = w.reduce((s, x) => s + x * x, 0);
  return { hhi, effective: 1 / hhi, top1: w[0], top5: w.slice(0, 5).reduce((a, b) => a + b, 0) };
}
