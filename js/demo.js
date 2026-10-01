// Realistic sample data for both sections. Every record is flagged `demo: true`
// so it can be removed without touching the user's own entries.
import * as store from './store.js';
import { dayKey, localDT, monthKey } from './ui.js';
import { holdingsTotal } from './networth/prices.js';

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const COLS = ['trades', 'tAccounts', 'tTransfers', 'setups', 'days', 'nwAccounts', 'nwSnapshots', 'nwCashflow'];

export const hasDemo = () => COLS.some(c => store.all(c).some(x => x.demo));
export async function removeDemo() { for (const c of COLS) await store.delWhere(c, x => x.demo); }

export async function loadDemo() {
  if (hasDemo()) await removeDemo();
  const R = rng(20260930);
  const pick = a => a[Math.floor(R() * a.length)];
  const between = (a, b) => a + R() * (b - a);
  const normal = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const id = () => store.uid();
  const now = new Date();

  // ---------------- trading ----------------
  const acct = { id: id(), demo: true, name: 'Demo — Margin', broker: 'Interactive Brokers', type: 'margin', startingBalance: 50000, startDate: dayKey(new Date(now.getFullYear(), now.getMonth() - 7, 1)) };
  const prop = { id: id(), demo: true, name: 'Demo — Prop 100K', broker: 'Funded futures', type: 'prop', startingBalance: 0 };
  const xfers = [{ id: id(), demo: true, accountId: acct.id, type: 'deposit', date: dayKey(new Date(now.getFullYear(), now.getMonth() - 4, 3)), amount: 10000, note: 'Added capital' },
    { id: id(), demo: true, accountId: prop.id, type: 'withdrawal', date: dayKey(new Date(now.getFullYear(), now.getMonth() - 1, 15)), amount: 1500, note: 'First payout' }];
  const S = (name, tf, winP, winR, lossR, extra) => ({ id: id(), demo: true, active: true, name, timeframe: tf, winP, winR, lossR, ...extra });
  const setups = [
    S('Opening range breakout', '5m', 0.5, [1.2, 3.2], [-1.05, -0.4], { description: 'Break of the first 15-minute range on a stock in play with relative volume > 2.', conditions: 'Gap > 2% with a catalyst, RVOL > 2, market not chopping.', entry: 'Buy/sell the first 5m close outside the 15m range.', stopRule: 'Other side of the 5m trigger candle or mid-range.', exit: 'Scale 1/2 at 2R, trail rest under 9 EMA.', rules: ['Stock in play (catalyst + RVOL > 2)', 'Clean range, not wider than ATR', 'Market direction agrees', 'Risk ≤ 0.5% of account', 'Stop placed immediately'] }),
    S('VWAP pullback', '2m', 0.57, [0.8, 2.2], [-1.0, -0.3], { description: 'Trend-day pullback to VWAP that holds, then continuation.', conditions: 'Clear trend from the open, higher lows above VWAP.', entry: 'First higher low after a VWAP touch.', stopRule: 'Below the pullback low.', exit: 'Prior high of day, then trail.', rules: ['Trend day confirmed', 'Pullback on lighter volume', 'Hold of VWAP on a closing basis', 'Risk ≤ 0.5% of account'] }),
    S('Gap fade', '5m', 0.4, [0.8, 2], [-1.2, -0.5], { description: 'Fading overextended gaps without news into the prior close.', conditions: 'Gap > 3% without catalyst; weak premarket volume.', entry: 'First lower high after 9:45.', stopRule: 'High of day.', exit: 'Prior day close.', rules: ['No real catalyst', 'Extended from daily ATR', 'Lower high formed', 'Wait until 9:45'] }),
    S('Daily trend continuation', 'Daily', 0.44, [1.5, 5], [-1.0, -0.4], { description: 'Swing entries on flags in strong daily uptrends.', conditions: 'Price above rising 20/50 SMA, sector strength.', entry: 'Break of a 3–10 day flag high.', stopRule: 'Below flag low.', exit: 'Close below 10 EMA.', rules: ['Above rising 50 SMA', 'Tight flag (< 1.5 ATR)', 'No earnings within 5 days', 'Relative strength vs SPY'] }),
    S('NQ liquidity sweep', '1m', 0.48, [1, 3], [-1, -0.6], { description: 'Futures reversal after a sweep of overnight high/low.', conditions: 'Clear overnight range, open within it.', entry: 'Reclaim of the swept level on 1m.', stopRule: 'Beyond the sweep extreme.', exit: 'Opposite side of overnight range.', rules: ['Sweep of ONH/ONL', 'Reclaim candle closes back inside', 'Not within 5 min of red news'] }),
  ];
  const stocks = { AAPL: 225, NVDA: 128, TSLA: 245, AMD: 158, META: 560, MSFT: 430, AMZN: 188, SMCI: 42, PLTR: 36, COIN: 215, SPY: 565, QQQ: 485 };
  const futures = { MNQ: [19800, 2], NQ: [19800, 20], MES: [5700, 5] };
  const sets = store.getSettings().tagLists;
  const trades = [], days = [];
  const start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  const DAY_PLANS = ['Focus on A+ ORB only. Max 3 trades. Stop after 2 losers.', 'CPI at 8:30 — wait for the first 15 minutes to settle. Only trade with the trend.', 'Chop yesterday. Sit on hands unless a clear trend day develops.', 'NVDA and SMCI in play after earnings. Watching premarket highs.', 'Market gapping up into resistance. Be patient with longs; gap-fade candidates on watch.', 'Friday — size down after 11:00.'];
  const RECAPS = ['Followed the plan, took the A setup and managed it well. Left some on the table on the runner.', 'Overtraded in the midday chop. Two trades I should never have taken.', 'Great patience. Waited for the pullback and got paid.', 'Chased the first move and got stopped. Recovered by sticking to VWAP pullbacks afterwards.', 'Red day but all trades were within the rules — acceptable loss.', 'Revenge trade after the first stop. Need a hard rule: 10-minute break after a loss.'];
  const LESSONS = ['No trades between 11:30 and 13:30.', 'Wait for the 5m close, not the wick.', 'Size down after two losers.', 'Let runners work — trail, don\'t target.', 'Take the partial at 2R every time.'];

  for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    if (R() < 0.12) continue; // days off
    const k = dayKey(d);
    const n = Math.max(1, Math.round(between(0.6, 4.4)));
    const tilt = R() < 0.15; // bad day: more mistakes
    for (let i = 0; i < n; i++) {
      const isFut = R() < 0.22;
      const setup = isFut ? setups[4] : pick(setups.slice(0, 4));
      const swing = setup.timeframe === 'Daily';
      const side = setup.name === 'Gap fade' ? 'short' : R() < (isFut ? 0.5 : 0.28) ? 'short' : 'long';
      const dir = side === 'short' ? -1 : 1;
      let symbol, base, mult = 1, asset = 'stock';
      if (isFut) { symbol = pick(Object.keys(futures)); [base, mult] = futures[symbol]; asset = 'future'; }
      else { symbol = pick(Object.keys(stocks)); base = stocks[symbol]; }
      base *= 1 + normal() * 0.06;
      const hour = Math.min(15, 9 + Math.floor(Math.abs(normal()) * 1.8) + (R() < 0.15 ? 3 : 0));
      const minute = hour === 9 ? 30 + Math.floor(R() * 30) : Math.floor(R() * 60);
      const open = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
      const stopDist = isFut ? between(8, 30) : base * between(0.004, swing ? 0.04 : 0.012);
      const riskUsd = isFut ? between(150, 450) : between(150, 350);
      let qty = Math.max(1, Math.round(riskUsd / (stopDist * mult)));
      const mistakes = [];
      if (R() < (tilt ? 0.6 : 0.18)) mistakes.push(pick(sets.mistakes));
      if (tilt && R() < 0.3) mistakes.push(pick(sets.mistakes));
      const mistakePenalty = mistakes.length ? 0.14 : 0;
      const win = R() < setup.winP - mistakePenalty + (hour >= 12 && hour < 14 ? -0.08 : 0);
      let r = win ? between(...setup.winR) : between(...setup.lossR);
      if (!win && mistakes.some(m => /Moved stop|No stop|Held loser|Averaged/.test(m))) r -= between(0.3, 1.2);
      if (R() < 0.05) r = between(-0.05, 0.05);
      const entry = base;
      const exit = entry + dir * r * stopDist;
      const stop = entry - dir * stopDist;
      const holdMin = swing ? between(60 * 24, 60 * 24 * 9) : Math.max(1, Math.abs(normal()) * (win ? 22 : 35) + 2);
      let close = new Date(open.getTime() + holdMin * 60000);
      if (close.getDay() === 6 || close.getDay() === 0) close = new Date(close.getTime() - (close.getDay() === 6 ? 1 : 2) * 86400000);
      if (close <= open) close = new Date(open.getTime() + 3600000);
      if (close > now) close = new Date(Math.max(open.getTime() + 60000, now.getTime() - 3600000));
      const fee = isFut ? qty * 1.24 : Math.max(1, qty * 0.005);
      const scale = !isFut && win && r > 1.5 && R() < 0.55;
      const openAct = side === 'short' ? 'sell' : 'buy', closeAct = side === 'short' ? 'buy' : 'sell';
      if (scale && qty < 2) qty = 2;
      const executions = [{ id: id(), action: openAct, datetime: localDT(open), qty, price: +entry.toFixed(2), fee: +(fee / 2).toFixed(2) }];
      if (scale) {
        const half = Math.floor(qty / 2);
        const p1 = entry + dir * 2 * stopDist * 0.98;
        const p2 = entry + dir * ((r * qty - 2 * half) / (qty - half)) * stopDist;
        executions.push({ id: id(), action: closeAct, datetime: localDT(new Date(open.getTime() + holdMin * 30000)), qty: half, price: +p1.toFixed(2), fee: +(fee / 4).toFixed(2) });
        executions.push({ id: id(), action: closeAct, datetime: localDT(close), qty: qty - half, price: +p2.toFixed(2), fee: +(fee / 4).toFixed(2) });
      } else executions.push({ id: id(), action: closeAct, datetime: localDT(close), qty, price: +exit.toFixed(2), fee: +(fee / 2).toFixed(2) });
      const maeR = win ? -between(0, 0.85) : Math.min(r, -between(0.8, 1.05));
      const mfeR = Math.max(r, 0) + between(0.05, win ? 1.8 : 0.9);
      const emotions = [pick(mistakes.length ? ['Anxious', 'Frustrated', 'Impatient', 'Greedy', 'Fearful', 'Tired'] : ['Calm', 'Focused', 'Confident', 'Calm', 'Bored'])];
      const followedPlan = mistakes.length ? R() < 0.15 : R() < 0.94;
      const grade = followedPlan ? (R() < 0.55 ? 'A' : 'B') : mistakes.length > 1 ? pick(['D', 'F']) : pick(['C', 'D']);
      const checklist = Object.fromEntries(setup.rules.map((_, j) => [j, followedPlan ? R() < 0.92 : R() < 0.55]));
      const tags = [];
      if (R() < 0.3) tags.push(pick(sets.tags));
      if (followedPlan && win && R() < 0.3) tags.push('A+ setup');
      trades.push({
        id: id(), demo: true, accountId: isFut ? prop.id : acct.id, symbol, assetClass: asset, side, multiplier: mult, executions,
        stop: +stop.toFixed(2), target: +(entry + dir * setup.winR[1] * 0.8 * stopDist).toFixed(2), setupId: setup.id,
        mae: +(entry + dir * maeR * stopDist).toFixed(2), mfe: +(entry + dir * mfeR * stopDist).toFixed(2),
        timeframe: setup.timeframe, grade, confidence: Math.max(1, Math.min(5, Math.round(3 + normal() + (followedPlan ? 0.5 : -0.5)))), followedPlan, checklist,
        tags: [...new Set(tags)], mistakes: [...new Set(mistakes)], emotions,
        notes: win ? `${setup.name} on ${symbol}. ${pick(['Clean trigger, held well.', 'Volume confirmed the move.', 'Took partial into strength.', 'Patient entry, good R.'])}` : `${setup.name} on ${symbol}. ${pick(['Failed quickly.', 'Market turned against it.', 'Entry was early.', 'Stopped out at the level.'])}`,
        lessons: mistakes.length ? pick(LESSONS) : '', images: [],
      });
    }
    if (R() < 0.72) days.push({ id: k, demo: true, mood: Math.max(1, Math.min(5, Math.round(3.4 + normal() * 0.9 - (tilt ? 1 : 0)))), sleep: +(between(5.5, 8.5)).toFixed(1), bias: pick(['Bullish', 'Bearish', 'Neutral', 'Range']), plan: pick(DAY_PLANS), maxLoss: 1000, recap: tilt ? pick(RECAPS.filter(x => /Overtraded|Revenge|Chased/.test(x))) : pick(RECAPS), lesson: pick(LESSONS), discipline: tilt ? pick([1, 2, 3]) : pick([3, 4, 4, 5]), grade: tilt ? pick(['C', 'D']) : pick(['A', 'B', 'B']), rulesOk: !tilt });
  }

  await store.putMany('tAccounts', [acct, prop]);
  await store.putMany('tTransfers', xfers);
  await store.putMany('setups', setups.map(({ winP, winR, lossR, ...s }) => s));
  await store.putMany('trades', trades);
  await store.putMany('days', days.filter(d => !store.get('days', d.id)));

  // ---------------- net worth ----------------
  const A = (name, kind, category, extra = {}) => ({ id: id(), demo: true, name, kind, category, ...extra });
  const nw = {
    checking: A('Checking', 'asset', 'cash', { institution: 'Chase' }),
    hysa: A('High-yield savings', 'asset', 'savings', { institution: 'Ally' }),
    brokerage: A('Index funds', 'asset', 'brokerage', { institution: 'Vanguard' }),
    k401: A('401(k)', 'asset', 'retirement', { institution: 'Fidelity' }),
    ira: A('Roth IRA', 'asset', 'retirement', { institution: 'Fidelity' }),
    crypto: A('Crypto', 'asset', 'crypto', { institution: 'Coinbase', tracksHoldings: true, holdings: [
      { id: id(), type: 'crypto', symbol: 'BTC', qty: 0.05, price: 98000, cost: 2900, priceSource: 'demo', priceAt: now.toISOString() },
      { id: id(), type: 'crypto', symbol: 'ETH', qty: 0.8, price: 3400, cost: 2100, priceSource: 'demo', priceAt: now.toISOString() },
      { id: id(), type: 'crypto', symbol: 'SOL', qty: 6, price: 160, cost: 1150, priceSource: 'demo', priceAt: now.toISOString() },
    ] }),
    trading: A('Trading account', 'asset', 'trading', { linkedTradingAccountId: acct.id }),
    home: A('Home', 'asset', 'realestate'),
    car: A('Car', 'asset', 'vehicle'),
    mortgage: A('Mortgage', 'liability', 'mortgage', { institution: 'Wells Fargo', rate: 3.25, payment: 1650 }),
    auto: A('Auto loan', 'liability', 'auto', { rate: 6.4, payment: 520 }),
    cc: A('Credit card', 'liability', 'credit', { institution: 'Amex', rate: 24.9 }),
  };
  const M = 30;
  const snaps = [], cash = [];
  let v = { checking: 5200, hysa: 14000, brokerage: 48000, k401: 71000, ira: 22000, crypto: 6500, home: 395000, car: 31000, mortgage: 318000, auto: 24000, cc: 1800 };
  for (let i = M; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mk = monthKey(d);
    const mkt = 0.007 + normal() * 0.035;
    const income = Math.round(8600 + normal() * 250 + (d.getMonth() === 11 ? 9000 : 0) + (i < 12 ? 600 : 0));
    const expenses = Math.round(5200 + normal() * 600 + (d.getMonth() === 6 ? 2500 : 0));
    const saved = income - expenses;
    if (i < M) {
      v.brokerage = v.brokerage * (1 + mkt) + saved * 0.45;
      v.k401 = v.k401 * (1 + mkt) + 1350;
      v.ira = v.ira * (1 + mkt * 1.05) + (d.getMonth() < 6 ? 580 : 0);
      v.crypto = Math.max(500, v.crypto * (1 + 0.01 + normal() * 0.14) + 150);
      v.hysa = v.hysa * 1.0036 + saved * 0.25;
      v.checking = Math.max(2500, 5200 + normal() * 1200);
      v.home *= 1 + 0.0028 + normal() * 0.004;
      v.car *= 0.989;
      v.mortgage = v.mortgage * (1 + 0.0325 / 12) - 1650 * 0.55;
      v.auto = Math.max(0, v.auto * (1 + 0.064 / 12) - 520);
      v.cc = Math.max(300, 1800 + normal() * 700);
      cash.push({ id: mk, demo: true, income, expenses, note: d.getMonth() === 11 ? 'Year-end bonus' : d.getMonth() === 6 ? 'Vacation' : '' });
    }
    const balances = {};
    for (const [k, a] of Object.entries(nw)) if (k !== 'trading' && !(k === 'auto' && v.auto <= 0 && i < 3)) balances[a.id] = Math.round(v[k] * 100) / 100;
    snaps.push({ id: id(), demo: true, date: dayKey(d), balances });
  }
  snaps.at(-1).balances[nw.crypto.id] = Math.round(holdingsTotal(nw.crypto) * 100) / 100; // latest = holdings value
  await store.putMany('nwAccounts', Object.values(nw));
  await store.putMany('nwSnapshots', snaps.filter(s => !store.all('nwSnapshots').some(x => x.date === s.date)));
  await store.putMany('nwCashflow', cash.filter(c => !store.get('nwCashflow', c.id)));
  const pl = store.getSettings().plan;
  if (!Object.keys(pl.targetAllocation || {}).length) {
    await store.saveSettings({ plan: { currentAge: 34, retirementAge: 55, targetAllocation: { cash: 3, savings: 7, brokerage: 22, trading: 8, retirement: 25, crypto: 3, realestate: 30, vehicle: 2 } } });
  }
}
