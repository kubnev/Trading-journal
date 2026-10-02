// Net worth calculations. Pure functions over the store.
import { all, getSettings } from '../store.js';
import { accountEquityAt } from '../trading/calc.js';
import { toDisplay, ccyOf } from '../fx.js';
import { today, monthKey, parseDay } from '../ui.js';

// liquid: can be turned into cash within days without major loss
// investable: counts toward financial-independence assets (excludes home, car, personal items)
export const ASSET_CATS = [
  { id: 'cash', label: 'Cash & checking', liquid: true, investable: false },
  { id: 'savings', label: 'Savings & money market', liquid: true, investable: false },
  { id: 'brokerage', label: 'Taxable investments', liquid: true, investable: true },
  { id: 'trading', label: 'Trading accounts', liquid: true, investable: true },
  { id: 'retirement', label: 'Retirement & pension', liquid: false, investable: true },
  { id: 'crypto', label: 'Crypto', liquid: true, investable: true },
  { id: 'realestate', label: 'Real estate', liquid: false, investable: false },
  { id: 'business', label: 'Business equity', liquid: false, investable: true },
  { id: 'vehicle', label: 'Vehicles', liquid: false, investable: false },
  { id: 'receivable', label: 'Money owed to you', liquid: false, investable: false },
  { id: 'otherasset', label: 'Other assets', liquid: false, investable: false },
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
export const catInfo = id => ASSET_CATS.find(c => c.id === id) || LIAB_CATS.find(c => c.id === id) || { id, label: id };
export const catLabel = id => catInfo(id).label;
export const isLiquid = a => (a.liquid === true || a.liquid === false ? a.liquid : !!catInfo(a.category).liquid);
export const isInvestable = a => (a.investable === true || a.investable === false ? a.investable : !!catInfo(a.category).investable);

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
  if (acct.linkedTradingAccountId) return accountEquityAt(acct.linkedTradingAccountId, date) ?? 0;
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
  const p = { date, assets: 0, liabilities: 0, liquid: 0, investable: 0, shortDebt: 0, byCat: {}, byAcct: {}, byAcctNative: {}, byCustody: {}, byPurpose: {}, byTier: {} };
  for (const a of accts) {
    const native = valueAt(a, date, snaps);
    const v = toDisplay(native, ccyOf(a), date);
    p.byAcctNative[a.id] = native;
    p.byAcct[a.id] = v;
    p.byCat[a.category] = (p.byCat[a.category] || 0) + v;
    if (a.kind === 'liability') { p.liabilities += v; if (catInfo(a.category).shortTerm) p.shortDebt += v; }
    else {
      p.assets += v; if (isLiquid(a)) p.liquid += v; if (isInvestable(a)) p.investable += v;
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
  if (all('nwAccounts').some(a => a.linkedTradingAccountId || +a.apy > 0) && dates.length && dates.at(-1) < today()) dates.push(today());
  if (!dates.length) return [];
  return dates.map(d => pointAt(d, snaps));
}

// ---------- cash flow ----------
export function cashflowMonths() {
  return [...all('nwCashflow')].sort((a, b) => a.id.localeCompare(b.id)).map(c => {
    const cur = ccyOf(c), d = c.id + '-15';
    const income = toDisplay(+c.income || 0, cur, d), expenses = toDisplay(+c.expenses || 0, cur, d);
    return { ...c, nativeIncome: +c.income || 0, nativeExpenses: +c.expenses || 0, income, expenses, savings: income - expenses, rate: income ? (income - expenses) / income : null };
  });
}

export function trailing(months, n = 12) {
  const m = months.slice(-n);
  const inc = m.reduce((a, x) => a + x.income, 0), exp = m.reduce((a, x) => a + x.expenses, 0);
  return { months: m.length, income: inc, expenses: exp, savings: inc - exp, rate: inc ? (inc - exp) / inc : null, avgExpenses: m.length ? exp / m.length : null, avgSavings: m.length ? (inc - exp) / m.length : null, avgIncome: m.length ? inc / m.length : null };
}

// ---------- financial independence ----------
export function planInputs() {
  const pl = getSettings().plan;
  const t = trailing(cashflowMonths());
  // plan amounts are stored in the currency they were typed in
  const annualExpenses = +pl.annualExpenses ? toDisplay(+pl.annualExpenses, pl.currency || 'USD') : (t.avgExpenses ? t.avgExpenses * 12 : 0);
  const monthlyContribution = +pl.monthlyContribution ? toDisplay(+pl.monthlyContribution, pl.currency || 'USD') : (t.avgSavings > 0 ? t.avgSavings : 0);
  const realReturn = (1 + (+pl.expectedReturn || 0) / 100) / (1 + (+pl.inflation || 0) / 100) - 1;
  return { ...pl, annualExpenses, monthlyContribution, realReturn, derivedExpenses: !+pl.annualExpenses, derivedContribution: !+pl.monthlyContribution, trailing: t };
}

export function fiMetrics(investable) {
  const p = planInputs();
  const fiNumber = p.annualExpenses && p.withdrawalRate ? p.annualExpenses / (p.withdrawalRate / 100) : null;
  const yearsToRet = Math.max(0, (+p.retirementAge || 0) - (+p.currentAge || 0));
  const coastNumber = fiNumber ? fiNumber / Math.pow(1 + p.realReturn, yearsToRet) : null;
  // months until investable assets reach the FI number (real terms)
  let months = null;
  if (fiNumber) {
    if (investable >= fiNumber) months = 0;
    else {
      const r = Math.pow(1 + p.realReturn, 1 / 12) - 1;
      let b = investable;
      for (let i = 1; i <= 1200; i++) { b = b * (1 + r) + p.monthlyContribution; if (b >= fiNumber) { months = i; break; } }
    }
  }
  return { ...p, fiNumber, progress: fiNumber ? investable / fiNumber : null, coastNumber, coastReached: coastNumber != null && investable >= coastNumber, yearsToFI: months == null ? null : months / 12, fiAge: months == null ? null : (+p.currentAge || 0) + months / 12, yearsToRet };
}

// Year-by-year projection of investable assets in today's money
export function projection(investable, years = 40) {
  const p = planInputs();
  const out = [];
  let b = investable;
  const r = Math.pow(1 + p.realReturn, 1 / 12) - 1;
  for (let y = 0; y <= years; y++) {
    out.push({ year: y, age: (+p.currentAge || 0) + y, value: b });
    for (let m = 0; m < 12; m++) b = b * (1 + r) + p.monthlyContribution;
  }
  return out;
}

// Split each period's change in net worth into savings (from cash-flow log) and market/other
export function changeDecomposition(series) {
  const cf = cashflowMonths();
  const out = [];
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1], b = series[i];
    const from = monthKey(a.date), to = monthKey(b.date);
    const inPeriod = cf.filter(c => c.id > from && c.id <= to);
    const savings = inPeriod.length ? inPeriod.reduce((s, c) => s + c.savings, 0) : null;
    const change = b.net - a.net;
    out.push({ date: b.date, change, savings, market: savings == null ? null : change - savings });
  }
  return out;
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
export function positions(point, { investableOnly = false } = {}) {
  const out = [];
  for (const a of all('nwAccounts')) {
    if (a.kind === 'liability' || a.archivedAt) continue;
    if (investableOnly && !isInvestable(a)) continue;
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
