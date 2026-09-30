// Net worth calculations. Pure functions over the store.
import { all, getSettings } from '../store.js';
import { accountEquityAt } from '../trading/calc.js';
import { today, monthKey } from '../ui.js';

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

const sortedSnaps = () => [...all('nwSnapshots')].sort((a, b) => a.date.localeCompare(b.date));

// Value of one account on a date (carry-forward of the latest snapshot on/before the date)
export function valueAt(acct, date, snaps = sortedSnaps()) {
  if (acct.archivedAt && date >= acct.archivedAt) return 0;
  if (acct.linkedTradingAccountId) return accountEquityAt(acct.linkedTradingAccountId, date) ?? 0;
  let v = null;
  for (const s of snaps) { if (s.date > date) break; if (s.balances && acct.id in s.balances && s.balances[acct.id] !== null && s.balances[acct.id] !== '') v = +s.balances[acct.id]; }
  return v ?? 0;
}

export function pointAt(date, snaps = sortedSnaps()) {
  const accts = all('nwAccounts');
  const p = { date, assets: 0, liabilities: 0, liquid: 0, investable: 0, shortDebt: 0, byCat: {}, byAcct: {} };
  for (const a of accts) {
    const v = valueAt(a, date, snaps);
    p.byAcct[a.id] = v;
    p.byCat[a.category] = (p.byCat[a.category] || 0) + v;
    if (a.kind === 'liability') { p.liabilities += v; if (catInfo(a.category).shortTerm) p.shortDebt += v; }
    else { p.assets += v; if (isLiquid(a)) p.liquid += v; if (isInvestable(a)) p.investable += v; }
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
  if (all('nwAccounts').some(a => a.linkedTradingAccountId) && dates.length && dates.at(-1) < today()) dates.push(today());
  if (!dates.length) return [];
  return dates.map(d => pointAt(d, snaps));
}

// ---------- cash flow ----------
export function cashflowMonths() {
  return [...all('nwCashflow')].sort((a, b) => a.id.localeCompare(b.id)).map(c => ({ ...c, income: +c.income || 0, expenses: +c.expenses || 0, savings: (+c.income || 0) - (+c.expenses || 0), rate: +c.income ? ((+c.income || 0) - (+c.expenses || 0)) / +c.income : null }));
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
  const annualExpenses = +pl.annualExpenses || (t.avgExpenses ? t.avgExpenses * 12 : 0);
  const monthlyContribution = +pl.monthlyContribution || (t.avgSavings > 0 ? t.avgSavings : 0);
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
  const minPay = debts.reduce((s, a) => s + (+a.payment || 0), 0);
  return { total, wRate, minPay, debts };
}
