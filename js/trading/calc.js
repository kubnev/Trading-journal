// Pure trading calculations. No DOM here.
import { all } from '../store.js';
import { dayKey, monthKey } from '../ui.js';

export const ASSET_CLASSES = [
  { id: 'stock', label: 'Stock / ETF', mult: 1 },
  { id: 'option', label: 'Option', mult: 100 },
  { id: 'future', label: 'Future', mult: 1 },
  { id: 'forex', label: 'Forex', mult: 1 },
  { id: 'crypto', label: 'Crypto', mult: 1 },
  { id: 'cfd', label: 'CFD', mult: 1 },
];
export const assetLabel = id => ASSET_CLASSES.find(a => a.id === id)?.label || id || '—';

// Common futures point values ($ per 1.00 point move per contract)
export const FUTURES = {
  ES: 50, MES: 5, NQ: 20, MNQ: 2, YM: 5, MYM: 0.5, RTY: 50, M2K: 5,
  CL: 1000, MCL: 100, GC: 100, MGC: 10, SI: 5000, NG: 10000, ZB: 1000, ZN: 1000, '6E': 125000, '6J': 12500000, BTC: 5, MBT: 0.1,
};

export const GRADES = ['A', 'B', 'C', 'D', 'F'];
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EPS = 1e-9;

// Derive everything about a single trade from its executions.
// Opening side: long → buys, short → sells. Realised P&L uses average cost.
export function computeTrade(t) {
  const dir = t.side === 'short' ? -1 : 1;
  const mult = +t.multiplier || 1;
  const ex = [...(t.executions || [])].filter(e => +e.qty > 0 && e.price !== '' && e.price != null).sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
  const openAct = dir === 1 ? 'buy' : 'sell';
  let entryQty = 0, entryCost = 0, exitQty = 0, exitVal = 0, fees = 0, realized = 0, pos = 0, avgCost = 0, maxPos = 0;
  for (const e of ex) {
    const q = +e.qty, p = +e.price;
    fees += +e.fee || 0;
    if (e.action === openAct) {
      avgCost = (avgCost * pos + p * q) / (pos + q);
      pos += q; entryQty += q; entryCost += p * q;
      maxPos = Math.max(maxPos, pos);
    } else {
      const cq = Math.min(q, pos);
      realized += (p - avgCost) * cq * dir * mult;
      pos -= cq; exitQty += cq; exitVal += p * cq;
    }
  }
  const avgEntry = entryQty ? entryCost / entryQty : null;
  const avgExit = exitQty ? exitVal / exitQty : null;
  const closed = entryQty > 0 && pos <= EPS;
  const openDate = ex[0]?.datetime || t.date || null;
  const closeDate = closed ? ex[ex.length - 1]?.datetime : null;
  const funding = +t.funding || 0;            // swap / borrow / perp funding paid (+) or received (−)
  fees += funding;
  const gross = realized;
  const net = gross - fees;
  const stop = t.stop === '' || t.stop == null ? null : +t.stop;
  const target = t.target === '' || t.target == null ? null : +t.target;
  const perUnitRisk = stop != null && avgEntry != null ? Math.abs(avgEntry - stop) : null;
  const risk = +t.riskOverride > 0 ? +t.riskOverride : perUnitRisk ? perUnitRisk * (maxPos || entryQty) * mult : null;
  const r = closed && risk ? net / risk : null;
  const plannedR = perUnitRisk && target != null ? Math.abs(target - avgEntry) / perUnitRisk : null;
  const mae = t.mae === '' || t.mae == null ? null : +t.mae;
  const mfe = t.mfe === '' || t.mfe == null ? null : +t.mfe;
  const maeR = mae != null && perUnitRisk ? ((mae - avgEntry) * dir) / perUnitRisk : null;   // ≤ 0 normally
  const mfeR = mfe != null && perUnitRisk ? ((mfe - avgEntry) * dir) / perUnitRisk : null;   // ≥ 0 normally
  const maeUsd = mae != null && avgEntry != null ? (mae - avgEntry) * dir * (maxPos || entryQty) * mult : null;
  const mfeUsd = mfe != null && avgEntry != null ? (mfe - avgEntry) * dir * (maxPos || entryQty) * mult : null;
  // Exit efficiency: share of the best available move actually captured
  const capture = closed && mfe != null && avgExit != null && (mfe - avgEntry) * dir > EPS ? ((avgExit - avgEntry) * dir) / ((mfe - avgEntry) * dir) : null;
  const holdMs = closed && openDate && closeDate ? new Date(closeDate) - new Date(openDate) : null;
  const notional = avgEntry != null ? avgEntry * (maxPos || entryQty) * mult : null;
  const retPct = closed && notional ? net / notional : null;
  const outcome = !closed ? 'open' : net > EPS ? 'win' : net < -EPS ? 'loss' : 'be';
  const daysHeld = openDate ? ((closed ? new Date(closeDate) : new Date()) - new Date(openDate)) / 864e5 : null;
  // Open position: mark-to-market against the last known price
  const curStop = t.currentStop === '' || t.currentStop == null ? stop : +t.currentStop;
  const mark = !closed && t.mark != null && t.mark !== '' ? +t.mark : null;
  const unreal = mark != null && avgEntry != null ? (mark - avgCost) * dir * pos * mult : null;
  const unrealR = unreal != null && risk ? unreal / risk : null;
  // risk still on the table: what you'd give back if the current stop is hit (from mark, else from entry)
  const ref = mark ?? avgCost;
  const openRisk = !closed && curStop != null && pos > 0 ? Math.max(0, (ref - curStop) * dir * pos * mult) : null;
  const lockedIn = !closed && curStop != null && pos > 0 ? (curStop - avgCost) * dir * pos * mult : null;   // >0 = stop is in profit
  const exposure = !closed && pos > 0 ? (mark ?? avgCost) * pos * mult : null;
  return {
    ...t, dir, mult, avgEntry, avgExit, entryQty, exitQty, maxPos, openQty: pos, fees, gross, net, closed, openDate, closeDate,
    day: closeDate ? dayKey(closeDate) : openDate ? dayKey(openDate) : null,
    risk, r, plannedR, maeR, mfeR, maeUsd, mfeUsd, capture, holdMs, notional, retPct, outcome,
    daysHeld, curStop, mark, unreal, unrealR, openRisk, lockedIn, exposure, funding,
  };
}

// ---------- filtering ----------
export const DEFAULT_FILTER = { range: 'all', from: '', to: '', account: '', setup: '', side: '', asset: '', tag: '', symbol: '' };

export function rangeBounds(f) {
  const now = new Date();
  const d = n => dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
  switch (f.range) {
    case '7d': return [d(6), null];
    case '30d': return [d(29), null];
    case '90d': return [d(89), null];
    case 'mtd': return [dayKey(new Date(now.getFullYear(), now.getMonth(), 1)), null];
    case 'ytd': return [`${now.getFullYear()}-01-01`, null];
    case '1y': return [d(364), null];
    case 'custom': return [f.from || null, f.to || null];
    default: return [null, null];
  }
}

export function filterTrades(trades, f = DEFAULT_FILTER) {
  const [from, to] = rangeBounds(f);
  const sym = (f.symbol || '').trim().toUpperCase();
  return trades.filter(t =>
    (!from || (t.day && t.day >= from)) && (!to || (t.day && t.day <= to)) &&
    (!f.account || t.accountId === f.account) && (!f.setup || (f.setup === '_none' ? !t.setupId : t.setupId === f.setup)) &&
    (!f.side || t.side === f.side) && (!f.asset || t.assetClass === f.asset) &&
    (!f.tag || [...(t.tags || []), ...(t.mistakes || []), ...(t.emotions || [])].includes(f.tag)) &&
    (!sym || (t.symbol || '').toUpperCase().includes(sym)));
}

export const computedTrades = () => all('trades').map(computeTrade);
export const closedSorted = ts => ts.filter(t => t.closed).sort((a, b) => (a.closeDate || '').localeCompare(b.closeDate || ''));

// ---------- statistics ----------
const sum = a => a.reduce((s, x) => s + x, 0);
const mean = a => (a.length ? sum(a) / a.length : null);
function std(a) { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(sum(a.map(x => (x - m) ** 2)) / (a.length - 1)); }

export function dailySeries(closed) {
  const m = new Map();
  for (const t of closed) {
    const k = t.day;
    const d = m.get(k) || { day: k, net: 0, gross: 0, fees: 0, count: 0, wins: 0, losses: 0 };
    d.net += t.net; d.gross += t.gross; d.fees += t.fees; d.count++;
    if (t.outcome === 'win') d.wins++; else if (t.outcome === 'loss') d.losses++;
    m.set(k, d);
  }
  return [...m.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function drawdownSeries(values) {
  // values: cumulative P&L sequence. Returns drawdown ($, ≤0) at each point and max DD.
  let peak = 0, maxDD = 0, maxDDAt = -1, peakAtMax = 0;
  const dd = values.map((v, i) => {
    if (v > peak) peak = v;
    const d = v - peak;
    if (d < maxDD) { maxDD = d; maxDDAt = i; peakAtMax = peak; }
    return d;
  });
  return { dd, maxDD, maxDDAt, peakAtMax };
}

export function startingCapital(accountId) {
  const accts = all('tAccounts').filter(a => !accountId || a.id === accountId);
  return sum(accts.map(a => +a.startingBalance || 0)) + sum(all('tTransfers').filter(x => !accountId || x.accountId === accountId).map(x => (x.type === 'withdrawal' ? -1 : 1) * (+x.amount || 0)));
}

export function stats(trades, { capital = 0 } = {}) {
  const closed = closedSorted(trades);
  const n = closed.length;
  const wins = closed.filter(t => t.outcome === 'win');
  const losses = closed.filter(t => t.outcome === 'loss');
  const bes = closed.filter(t => t.outcome === 'be');
  const grossProfit = sum(wins.map(t => t.net));
  const grossLoss = -sum(losses.map(t => t.net));
  const net = sum(closed.map(t => t.net));
  const fees = sum(closed.map(t => t.fees));
  const winRate = n ? wins.length / n : null;
  const avgWin = wins.length ? grossProfit / wins.length : null;
  const avgLoss = losses.length ? grossLoss / losses.length : null;
  const payoff = avgWin != null && avgLoss ? avgWin / avgLoss : null;
  const profitFactor = grossLoss > EPS ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null;
  const expectancy = n ? net / n : null;
  const rs = closed.map(t => t.r).filter(r => r != null && isFinite(r));
  const avgR = mean(rs);
  const sdR = std(rs);
  const sqn = rs.length >= 2 && sdR ? (Math.sqrt(Math.min(rs.length, 100)) * avgR) / sdR : null;
  const winRs = rs.filter(r => r > 0), lossRs = rs.filter(r => r < 0);

  // streaks
  let cw = 0, cl = 0, maxW = 0, maxL = 0;
  for (const t of closed) {
    if (t.outcome === 'win') { cw++; cl = 0; maxW = Math.max(maxW, cw); }
    else if (t.outcome === 'loss') { cl++; cw = 0; maxL = Math.max(maxL, cl); }
  }
  const last = closed[closed.length - 1];
  let curStreak = 0;
  if (last && last.outcome !== 'be') { for (let i = closed.length - 1; i >= 0 && closed[i].outcome === last.outcome; i--) curStreak++; if (last.outcome === 'loss') curStreak = -curStreak; }

  // equity / drawdown by trade
  let cum = 0;
  const equity = closed.map(t => (cum += t.net));
  const { dd, maxDD } = drawdownSeries(equity);
  // % drawdown relative to account equity (needs starting capital)
  let maxDDPct = null;
  if (capital > 0) {
    let peak = capital, m = 0;
    for (const v of equity) { const e = capital + v; if (e > peak) peak = e; m = Math.min(m, (e - peak) / peak); }
    maxDDPct = m;
  }

  // daily
  const days = dailySeries(closed);
  const dn = days.map(d => d.net);
  const greenDays = days.filter(d => d.net > EPS).length;
  const redDays = days.filter(d => d.net < -EPS).length;
  const dMean = mean(dn), dSd = std(dn);
  const downside = dn.length > 1 ? Math.sqrt(sum(dn.map(x => Math.min(0, x) ** 2)) / (dn.length - 1)) : null;
  // P&L-based Sharpe/Sortino on daily results, annualised by √252 (risk-free ignored)
  const sharpe = dSd ? (dMean / dSd) * Math.sqrt(252) : null;
  const sortino = downside ? (dMean / downside) * Math.sqrt(252) : null;

  const holdW = mean(wins.map(t => t.holdMs).filter(x => x != null));
  const daysW = mean(wins.map(t => t.daysHeld).filter(x => x != null)), daysL = mean(losses.map(t => t.daysHeld).filter(x => x != null)), daysAll = mean(closed.map(t => t.daysHeld).filter(x => x != null));
  const holdL = mean(losses.map(t => t.holdMs).filter(x => x != null));
  const planned = closed.filter(t => t.followedPlan === true || t.followedPlan === false);
  const adherence = planned.length ? planned.filter(t => t.followedPlan === true).length / planned.length : null;
  const kelly = winRate != null && payoff ? winRate - (1 - winRate) / payoff : null;
  // exit efficiency only makes sense on winners (losers never captured any of the MFE)
  const captures = wins.map(t => t.capture).filter(x => x != null).map(x => Math.max(0, Math.min(1.5, x)));

  return {
    n, wins: wins.length, losses: losses.length, bes: bes.length, open: trades.filter(t => !t.closed).length,
    net, grossProfit, grossLoss, fees, winRate, avgWin, avgLoss, payoff, profitFactor, expectancy,
    avgR, sdR, sqn, rCount: rs.length, avgWinR: mean(winRs), avgLossR: mean(lossRs), totalR: sum(rs),
    largestWin: wins.length ? Math.max(...wins.map(t => t.net)) : null,
    largestLoss: losses.length ? Math.min(...losses.map(t => t.net)) : null,
    maxConsecWins: maxW, maxConsecLosses: maxL, curStreak,
    equity, dd, maxDD, maxDDPct, recovery: maxDD < -EPS ? net / -maxDD : null,
    days, tradingDays: days.length, greenDays, redDays, dayWinRate: days.length ? greenDays / days.length : null,
    avgDay: dMean, bestDay: dn.length ? Math.max(...dn) : null, worstDay: dn.length ? Math.min(...dn) : null,
    sharpe, sortino, holdW, holdL, daysW, daysL, daysAll, adherence, kelly, avgCapture: mean(captures),
    avgMaeR: mean(closed.map(t => t.maeR).filter(x => x != null)), avgMfeR: mean(closed.map(t => t.mfeR).filter(x => x != null)),
    tradesPerDay: days.length ? n / days.length : null,
  };
}

// Group closed trades by a key (keyFn may return an array for multi-valued keys like tags)
export function groupBy(trades, keyFn) {
  const m = new Map();
  for (const t of trades.filter(t => t.closed)) {
    let ks = keyFn(t);
    if (!Array.isArray(ks)) ks = [ks];
    for (const k of ks) { if (k == null || k === '') continue; (m.get(k) || m.set(k, []).get(k)).push(t); }
  }
  return [...m.entries()].map(([key, ts]) => {
    const w = ts.filter(t => t.outcome === 'win').length;
    const gp = sum(ts.filter(t => t.net > 0).map(t => t.net)), gl = -sum(ts.filter(t => t.net < 0).map(t => t.net));
    const rs = ts.map(t => t.r).filter(r => r != null);
    return { key, count: ts.length, wins: w, winRate: w / ts.length, net: sum(ts.map(t => t.net)), expectancy: sum(ts.map(t => t.net)) / ts.length, pf: gl > EPS ? gp / gl : gp > 0 ? Infinity : null, avgR: mean(rs), trades: ts };
  });
}

export function holdBucket(ms) {
  if (ms == null) return null;
  const d = ms / 864e5;
  if (d < 1) return '< 1 day';
  if (d < 3) return '1–2 days';
  if (d < 6) return '3–5 days';
  if (d < 11) return '6–10 days';
  if (d < 21) return '11–20 days';
  if (d < 61) return '21–60 days';
  return '> 60 days';
}
export const HOLD_ORDER = ['< 1 day', '1–2 days', '3–5 days', '6–10 days', '11–20 days', '21–60 days', '> 60 days'];

export const TIMEFRAMES = ['4h', 'Daily', 'Weekly', 'Monthly'];
export const REGIMES = ['Uptrend', 'Downtrend', 'Range', 'Volatile / news'];
export const EXIT_REASONS = ['Target hit', 'Stopped out', 'Trailing stop', 'Thesis invalidated', 'Time stop', 'Took profit early', 'Risk off / market', 'Discretionary'];
export const CATALYSTS = ['Technical breakout', 'Pullback to support', 'Earnings', 'News / event', 'Macro data', 'Sector rotation', 'Token unlock / listing', 'Mean reversion', 'None'];

// Open-book summary for the positions page
export function openBook(trades, capital) {
  const open = trades.filter(t => !t.closed && t.openQty > 0);
  const sum = (k) => open.reduce((s, t) => s + (t[k] || 0), 0);
  const heat = sum('openRisk'), exposure = sum('exposure'), unreal = sum('unreal');
  return { open, heat, exposure, unreal, heatPct: capital > 0 ? heat / capital : null, exposurePct: capital > 0 ? exposure / capital : null, priced: open.filter(t => t.mark != null).length };
}

export function rHistogram(trades) {
  const edges = [-Infinity, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3, 4, Infinity];
  const labels = ['< −2R', '−2 to −1.5', '−1.5 to −1', '−1 to −0.5', '−0.5 to 0', '0 to 0.5', '0.5 to 1', '1 to 1.5', '1.5 to 2', '2 to 3', '3 to 4', '> 4R'];
  const counts = labels.map(() => 0);
  for (const t of trades) if (t.r != null) { const i = edges.findIndex((e, j) => t.r >= e && t.r < edges[j + 1]); if (i >= 0) counts[i]++; }
  return { labels, counts, mids: edges.slice(0, -1).map((e, i) => (isFinite(e) ? e : edges[i + 1] - 1)) };
}

// Rolling window metrics over closed trades
export function rolling(closed, win = 20) {
  const out = [];
  for (let i = win - 1; i < closed.length; i++) {
    const w = closed.slice(i - win + 1, i + 1);
    const rs = w.map(t => t.r).filter(r => r != null);
    out.push({ i, date: closed[i].closeDate, winRate: w.filter(t => t.outcome === 'win').length / w.length, expectancy: sum(w.map(t => t.net)) / w.length, avgR: mean(rs) });
  }
  return out;
}

export function monthlyTable(closed) {
  const m = new Map();
  for (const t of closed) { const k = monthKey(t.closeDate); m.set(k, (m.get(k) || 0) + t.net); }
  const years = [...new Set([...m.keys()].map(k => k.slice(0, 4)))].sort().reverse();
  return years.map(y => ({ year: y, months: Array.from({ length: 12 }, (_, i) => m.get(`${y}-${String(i + 1).padStart(2, '0')}`) ?? null), total: sum([...m.entries()].filter(([k]) => k.startsWith(y)).map(([, v]) => v)) }));
}

// Account equity at a given day (used by the net worth section when an account is linked)
export function accountEquityAt(accountId, day) {
  const a = all('tAccounts').find(x => x.id === accountId);
  if (!a) return null;
  let v = +a.startingBalance || 0;
  for (const x of all('tTransfers')) if (x.accountId === accountId && x.date <= day) v += (x.type === 'withdrawal' ? -1 : 1) * (+x.amount || 0);
  for (const t of computedTrades()) if (t.accountId === accountId && t.closed && t.day <= day) v += t.net;
  return v;
}
