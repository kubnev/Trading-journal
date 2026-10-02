// Realistic sample data: a swing trader (~8–10 trades a month), a daily journal,
// and a net-worth history with yields, crypto across custodians and purpose buckets.
// Every record is flagged `demo: true` so it can be removed without touching real entries.
import * as store from './store.js';
import { dayKey, monthKey } from './ui.js';
import { holdingsTotal } from './networth/prices.js';

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const COLS = ['trades', 'tAccounts', 'tTransfers', 'setups', 'days', 'nwAccounts', 'nwSnapshots', 'nwCashflow'];

export const hasDemo = () => COLS.some(c => store.all(c).some(x => x.demo));
export async function removeDemo() { for (const c of COLS) await store.delWhere(c, x => x.demo); }

export async function loadDemo() {
  if (hasDemo()) await removeDemo();
  const R = rng(20261002);
  const pick = a => a[Math.floor(R() * a.length)];
  const between = (a, b) => a + R() * (b - a);
  const normal = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const id = () => store.uid();
  const now = new Date();
  const dt = d => `${dayKey(d)}T${d.getHours() < 10 ? '0' : ''}${d.getHours()}:00`;
  const sets = store.getSettings().tagLists;

  // ---------------- trading (swing) ----------------
  const acct = { id: id(), demo: true, name: 'Demo — IBKR swing', broker: 'Interactive Brokers', type: 'margin', startingBalance: 40000, startDate: dayKey(new Date(now.getFullYear() - 1, now.getMonth(), 1)) };
  const cex = { id: id(), demo: true, name: 'Demo — Bybit', broker: 'Bybit', type: 'crypto', startingBalance: 12000 };
  const xfers = [{ id: id(), demo: true, accountId: acct.id, type: 'deposit', date: dayKey(new Date(now.getFullYear(), now.getMonth() - 6, 3)), amount: 10000, note: 'Added capital' }];
  const S = (name, tf, winP, winR, lossR, hold, extra) => ({ id: id(), demo: true, active: true, name, timeframe: tf, winP, winR, lossR, hold, ...extra });
  const setups = [
    S('Base breakout', 'Daily', 0.45, [1.5, 4.5], [-1.05, -0.5], [4, 25], { description: 'Breakout from a 3–8 week base on rising volume in a leading stock.', conditions: 'Market in uptrend, stock RS line at highs.', entry: 'Close above the pivot on 1.5× average volume.', stopRule: 'Below the low of the breakout day or 7% max.', exit: 'Sell 1/3 at 3R, trail the rest under the 21-day EMA.', rules: ['Market above 50-day MA', 'Base 3+ weeks, depth < 30%', 'Volume ≥ 1.5× average on breakout', 'Risk ≤ 1% of capital', 'No earnings within 7 days'] }),
    S('Pullback to 21 EMA', 'Daily', 0.55, [1, 2.8], [-1, -0.4], [3, 12], { description: 'Buy the first orderly pullback to the 21 EMA in a strong trend.', conditions: 'Stock up 20%+ in 2 months, tight pullback on lower volume.', entry: 'Reclaim of the prior day high near the 21 EMA.', stopRule: 'Below the pullback low.', exit: 'Prior high, then trail.', rules: ['Strong prior trend', 'Pullback on declining volume', 'Holds 21 EMA on a closing basis', 'Risk ≤ 1% of capital'] }),
    S('Weekly trend continuation', 'Weekly', 0.42, [2, 6], [-1, -0.5], [15, 60], { description: 'Position-size swing in a multi-month weekly uptrend.', conditions: 'Weekly higher highs and higher lows, above the 10-week MA.', entry: 'Weekly close above a flag.', stopRule: 'Below the flag low on a weekly close.', exit: 'Weekly close under the 10-week MA.', rules: ['Weekly uptrend intact', 'Sector leading', 'Position ≤ 15% of capital'] }),
    S('Crypto range reclaim', '4h', 0.5, [1.2, 3.5], [-1.05, -0.5], [2, 10], { description: 'Reclaim of a range low after a sweep on BTC/ETH/majors.', conditions: 'Clear multi-day range, funding not extreme.', entry: '4h close back inside the range.', stopRule: 'Below the sweep low.', exit: 'Range midpoint, then range high.', rules: ['Range ≥ 5 days', 'Sweep + reclaim on 4h close', 'Funding neutral', 'Risk ≤ 0.75%'] }),
  ];
  const stocks = { NVDA: [128, 'Semis'], AMD: [158, 'Semis'], AVGO: [172, 'Semis'], META: [560, 'Internet'], AMZN: [188, 'Internet'], PLTR: [36, 'Software'], CRWD: [310, 'Software'], NOW: [910, 'Software'], LLY: [880, 'Healthcare'], XOM: [118, 'Energy'], CAT: [360, 'Industrials'], SPY: [565, 'Index'], QQQ: [485, 'Index'], GLD: [245, 'Commodities'] };
  const coins = { BTC: [68000, 'L1'], ETH: [3200, 'L1'], SOL: [150, 'L1'], LINK: [14, 'Oracles'], AVAX: [28, 'L1'] };
  const PLANS = ['Market above the 50-day — focus on breakouts in leaders, max 3 new positions this week.', 'CPI Wednesday — no new entries before the print.', 'Semis extended; looking for pullbacks rather than chasing.', 'Choppy tape. Sit on hands unless an A+ setup appears.', 'BTC holding the range low — watching for a reclaim.', 'Earnings season: no holding through reports unless sized down.'];
  const RECAPS = ['Quiet day. Reviewed positions, trailed stops on winners.', 'Stuck to the plan; skipped two mediocre setups.', 'Got impatient and entered early — need to wait for the close.', 'Good energy, productive day, journaled everything.', 'Distracted by the screen — checked prices too often.', 'Solid day: one clean entry, everything else was patience.'];
  const LESSONS = ['Wait for the daily close before acting.', 'Size down when the market is choppy.', 'Let winners work — trail, don\'t target.', 'No new trades on low-sleep days.', 'Write the thesis BEFORE entering.', 'Losers that don\'t work in 5 days rarely do.'];
  const INTENTS = ['Deep work on the project, gym, no screen time after 9pm.', 'Review watchlist and update stops. Keep it light.', 'Finish the report, walk at lunch, read 30 minutes.', 'Patience with trades; focus on work.', 'Plan the week, update balances, call family.'];

  const trades = [];
  const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    if (R() > 0.42) continue; // ~9 trade ideas a month
    const isCrypto = R() < 0.3;
    const setup = isCrypto ? setups[3] : pick(setups.slice(0, 3));
    let symbol, base, sector;
    if (isCrypto) { symbol = pick(Object.keys(coins)); [base, sector] = coins[symbol]; } else { symbol = pick(Object.keys(stocks)); [base, sector] = stocks[symbol]; }
    base *= 1 + normal() * 0.08;
    const side = isCrypto ? (R() < 0.35 ? 'short' : 'long') : R() < 0.1 ? 'short' : 'long';
    const dir = side === 'short' ? -1 : 1;
    const open = new Date(d.getFullYear(), d.getMonth(), d.getDate(), isCrypto ? 8 + Math.floor(R() * 12) : 15, 0);
    const stopDist = base * between(isCrypto ? 0.03 : 0.035, isCrypto ? 0.08 : 0.08);
    const capital = isCrypto ? 12000 : 45000;
    const riskUsd = capital * between(0.005, 0.01);
    const qty = isCrypto ? +(riskUsd / stopDist).toFixed(base > 1000 ? 4 : 2) : Math.max(1, Math.round(riskUsd / stopDist));
    const mistakes = R() < 0.22 ? [pick(sets.mistakes)] : [];
    const win = R() < setup.winP - (mistakes.length ? 0.12 : 0);
    let r = win ? between(...setup.winR) : between(...setup.lossR);
    if (!win && mistakes.some(m => /Moved stop|No stop|Held loser|Averaged/.test(m))) r -= between(0.3, 1);
    const holdDays = win ? between(...setup.hold) : between(1, setup.hold[1] * 0.6);
    let close = new Date(open.getTime() + holdDays * 864e5);
    const stillOpen = close > now;
    if (close.getDay() === 6) close = new Date(close.getTime() - 864e5);
    if (close.getDay() === 0 && !isCrypto) close = new Date(close.getTime() - 2 * 864e5);
    if (close <= open) close = new Date(open.getTime() + 864e5);
    const entry = +base.toFixed(base > 100 ? 2 : 4);
    const stop = +(entry - dir * stopDist).toFixed(base > 100 ? 2 : 4);
    const target = +(entry + dir * setup.winR[1] * 0.8 * stopDist).toFixed(base > 100 ? 2 : 4);
    const fee = isCrypto ? +(qty * entry * 0.0005).toFixed(2) : Math.max(1, +(qty * 0.005).toFixed(2));
    const openAct = side === 'short' ? 'sell' : 'buy', closeAct = side === 'short' ? 'buy' : 'sell';
    const executions = [{ id: id(), action: openAct, datetime: dt(open), qty, price: entry, fee }];
    const updates = [];
    let currentStop = null, mark = null;
    if (!stillOpen) {
      const scale = win && r > 2 && R() < 0.5 && qty >= 2;
      if (scale) {
        const half = isCrypto ? +(qty / 2).toFixed(4) : Math.floor(qty / 2);
        const mid = new Date(open.getTime() + holdDays * 0.45 * 864e5);
        executions.push({ id: id(), action: closeAct, datetime: dt(mid), qty: half, price: +(entry + dir * 2.5 * stopDist).toFixed(4), fee });
        executions.push({ id: id(), action: closeAct, datetime: dt(close), qty: +(qty - half).toFixed(4), price: +(entry + dir * ((r * qty - 2.5 * half) / (qty - half)) * stopDist).toFixed(4), fee });
        updates.push({ date: dayKey(mid), note: 'Took 1/2 off at 2.5R, stop to breakeven.', stop: entry });
      } else executions.push({ id: id(), action: closeAct, datetime: dt(close), qty, price: +(entry + dir * r * stopDist).toFixed(4), fee });
    } else {
      // still running: trailed stop + a recent mark
      const progress = between(-0.6, 2.2);
      currentStop = progress > 1 ? entry : null;
      const upd = d0 => dayKey(new Date(Math.max(open.getTime(), d0)));
      if (progress > 1) updates.push({ date: upd(now.getTime() - between(1, 4) * 864e5), note: 'Working. Moved stop to breakeven.', stop: entry });
      updates.push({ date: upd(now.getTime() - 864e5), note: pick(['Thesis intact, holding.', 'Volume drying up on the pullback — good.', 'Watching the 21 EMA.']) });
      mark = +(entry + dir * progress * stopDist).toFixed(4);
    }
    const exitReason = stillOpen ? '' : win ? (r > setup.winR[1] * 0.75 ? 'Target hit' : pick(['Trailing stop', 'Took profit early', 'Time stop'])) : r < -0.9 ? 'Stopped out' : pick(['Thesis invalidated', 'Time stop', 'Risk off / market']);
    const followedPlan = mistakes.length ? R() < 0.2 : R() < 0.92;
    trades.push({
      id: id(), demo: true, accountId: isCrypto ? cex.id : acct.id, symbol, assetClass: isCrypto ? 'crypto' : 'stock', side, multiplier: 1, executions,
      stop, target, currentStop, setupId: setup.id, timeframe: setup.timeframe, sector, regime: pick(['Uptrend', 'Uptrend', 'Range', 'Volatile / news']),
      catalyst: isCrypto ? pick(['Technical breakout', 'Mean reversion', 'Token unlock / listing', 'Macro data']) : pick(['Technical breakout', 'Pullback to support', 'Earnings', 'Sector rotation', 'News / event']),
      conviction: Math.max(1, Math.min(5, Math.round(3 + normal()))), plannedDays: Math.round((setup.hold[0] + setup.hold[1]) / 2),
      thesis: `${setup.name} in ${symbol}. ${pick(['Leader in a strong group, tight structure.', 'Clean base, volume dried up before the move.', 'Reclaimed key level with conviction.', 'Relative strength vs the index all month.'])} Invalid below ${stop}.`,
      funding: isCrypto && !stillOpen ? +(normal() * 4).toFixed(2) : null,
      mae: stillOpen ? null : +(entry - dir * (win ? between(0.1, 0.8) : between(0.9, 1.05)) * stopDist).toFixed(4),
      mfe: stillOpen ? null : +(entry + dir * (Math.max(r, 0) + between(0.1, 1.2)) * stopDist).toFixed(4),
      ...(stillOpen ? { mark, markAt: now.toISOString(), markSource: 'demo' } : {}),
      exitReason, grade: followedPlan ? (R() < 0.5 ? 'A' : 'B') : pick(['C', 'D']), followedPlan,
      checklist: Object.fromEntries(setup.rules.map((_, j) => [j, followedPlan ? R() < 0.92 : R() < 0.5])),
      tags: R() < 0.3 ? [pick(sets.tags)] : [], mistakes, emotions: [pick(mistakes.length ? ['Impatient', 'Anxious', 'Greedy', 'Frustrated'] : ['Calm', 'Focused', 'Confident'])],
      updates, review: stillOpen ? '' : win ? 'Played out as planned.' : pick(['Setup failed quickly — the stop did its job.', 'Entered before confirmation.', 'Market turned risk-off.']), lessons: mistakes.length ? pick(LESSONS) : '', images: [],
    });
  }
  // keep only a few positions open
  let opens = trades.filter(t => t.mark != null);
  for (const t of opens.slice(0, Math.max(0, opens.length - 4))) trades.splice(trades.indexOf(t), 1);

  // ---------------- daily journal ----------------
  const days = [];
  const habits = store.getSettings().habits || [];
  for (let d = new Date(now.getFullYear(), now.getMonth() - 5, now.getDate()); d < now; d.setDate(d.getDate() + 1)) {
    if (R() > 0.78) continue;
    const sleep = +Math.max(4.5, Math.min(9, 7 + normal() * 0.9)).toFixed(1);
    const mood = Math.max(1, Math.min(5, Math.round(3.2 + (sleep - 7) * 0.5 + normal() * 0.8)));
    days.push({
      id: dayKey(d), demo: true, mood, energy: Math.max(1, Math.min(5, Math.round(mood + normal() * 0.7))), focus: Math.max(1, Math.min(5, Math.round(3 + normal()))), sleep,
      intention: pick(INTENTS), plan: R() < 0.6 ? pick(PLANS) : '', bias: pick(['Bullish', 'Neutral', 'Range', 'Bearish']),
      dayRating: Math.max(1, Math.min(5, Math.round(mood + normal() * 0.6))), discipline: Math.max(1, Math.min(5, Math.round(3.6 + normal() * 0.9))),
      recap: pick(RECAPS), lesson: R() < 0.5 ? pick(LESSONS) : '', gratitude: R() < 0.4 ? pick(['Health', 'Family dinner', 'A good book', 'Quiet morning']) : '',
      habits: Object.fromEntries(habits.map((h, i) => [h, R() < [0.6, 0.5, 0.35, 0.85, 0.8, 0.7][i % 6]])), tags: R() < 0.12 ? [pick(store.getSettings().dayTags || ['Travel'])] : [],
    });
  }

  await store.putMany('tAccounts', [acct, cex]);
  await store.putMany('tTransfers', xfers);
  await store.putMany('setups', setups.map(({ winP, winR, lossR, hold, ...s }) => s));
  await store.putMany('trades', trades);
  await store.putMany('days', days.filter(d => !store.get('days', d.id)));

  // ---------------- net worth ----------------
  const A = (name, kind, category, extra = {}) => ({ id: id(), demo: true, name, kind, category, ...extra });
  const nw = {
    checking: A('Checking', 'asset', 'cash', { institution: 'Revolut', custody: 'bank', purpose: 'Spending' }),
    hysa: A('High-yield savings', 'asset', 'savings', { institution: 'Trade Republic', custody: 'bank', purpose: 'Emergency fund', apy: 3.75 }),
    mmf: A('Money-market fund', 'asset', 'savings', { institution: 'IBKR', custody: 'broker', purpose: 'Short-term goals', apy: 4.6, liquid: true }),
    etf: A('ETF portfolio', 'asset', 'brokerage', { institution: 'IBKR', custody: 'broker', purpose: 'Long-term investing' }),
    pension: A('Pension fund', 'asset', 'retirement', { institution: 'Pension', custody: 'broker', purpose: 'Retirement' }),
    cexAcc: A('Binance spot', 'asset', 'crypto', { institution: 'Binance', custody: 'cex', purpose: 'Crypto', tracksHoldings: true, holdings: [
      { id: id(), type: 'crypto', symbol: 'SOL', qty: 18, price: 150, cost: 2100, priceSource: 'demo', priceAt: now.toISOString() },
      { id: id(), type: 'crypto', symbol: 'LINK', qty: 140, price: 14, cost: 1650, priceSource: 'demo', priceAt: now.toISOString() },
      { id: id(), type: 'crypto', symbol: 'USDC', qty: 2500, price: 1, cost: 2500, priceSource: 'demo', priceAt: now.toISOString() },
    ] }),
    cold: A('Cold wallet (BTC)', 'asset', 'crypto', { institution: 'Hardware wallet', custody: 'self', purpose: 'Long-term investing', tracksHoldings: true, holdings: [
      { id: id(), type: 'crypto', symbol: 'BTC', qty: 0.12, price: 68000, cost: 4200, priceSource: 'demo', priceAt: now.toISOString() },
    ] }),
    defi: A('Staked ETH (Lido)', 'asset', 'crypto', { institution: 'Lido', custody: 'dex', purpose: 'Crypto', apy: 3.1 }),
    trading: A('Swing trading capital', 'asset', 'trading', { institution: 'IBKR', custody: 'broker', purpose: 'Trading capital', linkedTradingAccountId: acct.id }),
    bybit: A('Bybit trading capital', 'asset', 'trading', { institution: 'Bybit', custody: 'cex', purpose: 'Trading capital', linkedTradingAccountId: cex.id }),
    home: A('Apartment', 'asset', 'realestate', { purpose: 'Home & property' }),
    car: A('Car', 'asset', 'vehicle'),
    mortgage: A('Mortgage', 'liability', 'mortgage', { institution: 'Bank', rate: 3.4, payment: 820 }),
    cc: A('Credit card', 'liability', 'credit', { institution: 'Amex', rate: 21 }),
  };
  const M = 30;
  const snaps = [], cash = [];
  let v = { checking: 3800, hysa: 9000, mmf: 4000, etf: 26000, pension: 18000, defi: 4200, home: 185000, car: 19000, mortgage: 142000, cc: 900 };
  for (let i = M; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mk = monthKey(d);
    const mkt = 0.007 + normal() * 0.035;
    const income = Math.round(5600 + normal() * 200 + (d.getMonth() === 11 ? 5000 : 0) + (i < 12 ? 400 : 0));
    const expenses = Math.round(3300 + normal() * 380 + (d.getMonth() === 7 ? 1800 : 0));
    const saved = income - expenses;
    if (i < M) {
      v.etf = v.etf * (1 + mkt) + saved * 0.4;
      v.pension = v.pension * (1 + mkt * 0.8) + 350;
      v.hysa = v.hysa * (1 + 0.0375 / 12) + saved * 0.2;
      v.mmf = v.mmf * (1 + 0.046 / 12) + saved * 0.1;
      v.defi = Math.max(800, v.defi * (1 + 0.01 + normal() * 0.11));
      v.checking = Math.max(1500, 3800 + normal() * 700);
      v.home *= 1 + 0.003 + normal() * 0.004;
      v.car *= 0.99;
      v.mortgage = v.mortgage * (1 + 0.034 / 12) - 820 * 0.6;
      v.cc = Math.max(200, 900 + normal() * 400);
      cash.push({ id: mk, demo: true, income, expenses, note: d.getMonth() === 11 ? 'Year-end bonus' : d.getMonth() === 7 ? 'Holiday' : '' });
    }
    const balances = {};
    for (const [k, a] of Object.entries(nw)) if (k in v) balances[a.id] = Math.round(v[k] * 100) / 100;
    // crypto holdings accounts: rough history that ends at today's holdings value
    const f = Math.max(0.35, 1 - i * 0.022 + normal() * 0.08);
    balances[nw.cexAcc.id] = Math.round(holdingsTotal(nw.cexAcc) * (i ? f : 1));
    balances[nw.cold.id] = Math.round(holdingsTotal(nw.cold) * (i ? Math.max(0.4, 1 - i * 0.02 + normal() * 0.07) : 1));
    snaps.push({ id: id(), demo: true, date: dayKey(d), balances });
  }
  await store.putMany('nwAccounts', Object.values(nw));
  await store.putMany('nwSnapshots', snaps.filter(s => !store.all('nwSnapshots').some(x => x.date === s.date)));
  await store.putMany('nwCashflow', cash.filter(c => !store.get('nwCashflow', c.id)));
  const pl = store.getSettings().plan;
  if (!Object.keys(pl.targetAllocation || {}).length) {
    await store.saveSettings({ plan: { currentAge: 31, retirementAge: 50, targetAllocation: { cash: 3, savings: 10, brokerage: 25, trading: 12, retirement: 10, crypto: 10, realestate: 28, vehicle: 2 } } });
  }
}
