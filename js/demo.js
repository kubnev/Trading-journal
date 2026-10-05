// Realistic sample data: six months of everyday spending, income, bills and budgets, plus a
// 30-month net-worth history with yields, crypto across custodians and trading capital.
// Every record is flagged `demo: true` so it can be removed without touching real entries.
import * as store from './store.js';
import { dayKey, monthKey, pad } from './ui.js';
import { holdingsTotal } from './networth/prices.js';
import { nextDate } from './spend/calc.js';

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const COLS = ['nwAccounts', 'nwSnapshots', 'txns', 'recurring'];

export const hasDemo = () => COLS.some(c => store.all(c).some(x => x.demo));
export async function removeDemo() {
  for (const c of COLS) await store.delWhere(c, x => x.demo);
  if (store.getSettings().demoBudgets) { await store.saveSettings({ budgets: null }); await store.saveSettings({ budgets: { total: 0, byCat: {} }, demoBudgets: false }); }
}

export async function loadDemo() {
  if (hasDemo()) await removeDemo();
  const R = rng(20261002);
  const pick = a => a[Math.floor(R() * a.length)];
  const between = (a, b) => a + R() * (b - a);
  const normal = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const id = () => store.uid();
  const now = new Date();
  const todayK = dayKey(now);
  const r2 = x => Math.round(x * 100) / 100;

  // ---------------- spending: bills & subscriptions ----------------
  const RC = (name, amount, category, day, extra = {}) => ({ id: id(), demo: true, name, amount, currency: 'EUR', category, freq: 'monthly', day, auto: true, ...extra });
  const bills = [
    RC('Rent', 950, 'housing', 1, { sub: 'Rent', method: 'Bank transfer' }),
    RC('Electricity & heating', 85, 'bills', 6, { sub: 'Electricity', method: 'Bank transfer' }),
    RC('Internet', 32, 'bills', 12, { sub: 'Internet', method: 'Debit card' }),
    RC('Phone', 18, 'bills', 15, { sub: 'Phone', method: 'Debit card' }),
    RC('Gym', 39, 'health', 3, { sub: 'Gym & sport', method: 'Debit card' }),
    RC('Netflix', 15.99, 'subscriptions', 9, { sub: 'Streaming', method: 'Credit card' }),
    RC('Spotify', 10.99, 'subscriptions', 21, { sub: 'Streaming', method: 'Credit card' }),
    RC('iCloud', 2.99, 'subscriptions', 17, { sub: 'Software & apps', method: 'Apple / Google Pay' }),
    RC('TradingView', 179, 'subscriptions', 14, { sub: 'Software & apps', method: 'Credit card', freq: 'yearly' }),
    RC('Car insurance', 210, 'transport', 20, { sub: 'Car insurance', method: 'Bank transfer', freq: 'quarterly' }),
    RC('Salary', 3400, 'salary', 25, { type: 'income', method: 'Bank transfer' }),
  ];
  const txns = [];
  const T = (date, type, amount, category, note, extra = {}) => txns.push({ id: id(), demo: true, date, type, amount: r2(amount), currency: 'EUR', category, note, ...extra });
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  // past occurrences of each bill, then point it at its next date
  for (const b of bills) {
    let d = dayKey(new Date(start.getFullYear(), start.getMonth() + (b.freq === 'yearly' ? -3 : 0), Math.min(b.day, 28)));
    let guard = 0;
    while (d <= todayK && guard++ < 50) { if (d >= dayKey(start)) T(d, b.type || 'expense', b.amount, b.category, b.name, { sub: b.sub, method: b.method, recurringId: b.id, merchant: b.name }); d = nextDate(b, d); }
    b.next = d;
  }
  // everyday spending
  const GRO = ['Lidl', 'Kaufland', 'Billa', 'Fantastico', 'Farmers market'], EAT = ['Wolt', 'Happy Bar & Grill', 'Sushi place', 'Pizza Lab', 'Street food'], CAF = ['Starbucks', 'Costa', 'Corner café'];
  const SHOP = [['Zara', 'Clothes & shoes'], ['Amazon', 'Electronics'], ['IKEA', 'Home & furniture'], ['Card shop', 'Collectibles & hobbies'], ['H&M', 'Clothes & shoes']];
  const METH = ['Debit card', 'Debit card', 'Apple / Google Pay', 'Credit card', 'Cash'];
  for (let d = new Date(start); dayKey(d) <= todayK; d.setDate(d.getDate() + 1)) {
    const k = dayKey(d), dow = d.getDay(), weekend = dow === 0 || dow === 6;
    if (R() < 0.13) continue;                                        // a no-spend day
    if (R() < (weekend ? 0.55 : 0.3)) { const g = pick(GRO); T(k, 'expense', between(14, weekend ? 95 : 45), 'groceries', g === 'Farmers market' ? 'Fruit & veg' : 'Groceries', { merchant: g, sub: g === 'Farmers market' ? 'Market & bakery' : 'Supermarket', method: pick(METH) }); }
    if (R() < 0.45) { const c = pick(CAF); T(k, 'expense', between(2.8, 5.5), 'dining', 'Coffee', { merchant: c, sub: 'Cafés & coffee', method: 'Apple / Google Pay' }); }
    if (R() < (weekend ? 0.5 : 0.18)) { const e = pick(EAT); T(k, 'expense', between(12, weekend ? 70 : 28), 'dining', e === 'Wolt' ? 'Delivery' : 'Dinner out', { merchant: e, sub: e === 'Wolt' ? 'Takeaway & delivery' : 'Restaurants', method: pick(METH) }); }
    if (R() < 0.12) T(k, 'expense', between(45, 75), 'transport', 'Fuel', { merchant: pick(['Shell', 'OMV', 'Lukoil']), sub: 'Fuel', method: 'Debit card' });
    if (R() < 0.1) T(k, 'expense', between(6, 18), 'transport', 'Taxi', { merchant: 'Uber', sub: 'Taxi & rideshare', method: 'Credit card' });
    if (R() < 0.06) { const [m, sub] = pick(SHOP); T(k, 'expense', between(25, 160), 'shopping', sub, { merchant: m, sub, method: pick(METH), kind: sub === 'Collectibles & hobbies' ? 'want' : undefined }); }
    if (R() < 0.05) T(k, 'expense', between(12, 60), 'fun', pick(['Cinema', 'Concert tickets', 'Bowling', 'Steam game']), { sub: pick(['Events & concerts', 'Games', 'Activities']), method: pick(METH) });
    if (R() < 0.03) T(k, 'expense', between(8, 45), 'health', 'Pharmacy', { merchant: 'Sopharmacy', sub: 'Pharmacy', method: 'Debit card' });
    if (R() < 0.025) T(k, 'expense', between(15, 40), 'personal', 'Haircut', { sub: 'Haircut & beauty', method: 'Cash' });
    if (R() < 0.02) T(k, 'expense', between(20, 80), 'gifts', 'Gift', { sub: 'Gifts', method: pick(METH) });
  }
  // one trip, a side gig and a couple of trading withdrawals
  const mk = n => monthKey(new Date(now.getFullYear(), now.getMonth() - n, 1));
  T(`${mk(3)}-08`, 'expense', 240, 'travel', 'Flights to Lisbon', { merchant: 'Ryanair', sub: 'Flights', method: 'Credit card', tags: ['holiday'] });
  T(`${mk(3)}-10`, 'expense', 380, 'travel', 'Apartment, 4 nights', { merchant: 'Airbnb', sub: 'Accommodation', method: 'Credit card', tags: ['holiday'] });
  T(`${mk(3)}-12`, 'expense', 165, 'travel', 'Food & tours', { sub: 'Activities & food', method: 'Cash', tags: ['holiday'] });
  T(`${mk(4)}-18`, 'income', 650, 'side', 'Website for a friend', { method: 'Bank transfer' });
  T(`${mk(2)}-28`, 'income', 1200, 'trading-income', 'Withdrawal from trading account', { method: 'Bank transfer' });
  T(`${mk(1)}-09`, 'income', 14.2, 'investment-income', 'Savings interest', { method: 'Bank transfer' });
  T(`${mk(2)}-15`, 'expense', 120, 'education', 'Online course', { sub: 'Courses', method: 'Credit card' });
  T(`${mk(1)}-22`, 'expense', 60, 'fees', 'Parking fine', { sub: 'Fines', method: 'Debit card' });
  await store.putMany('recurring', bills);
  await store.putMany('txns', txns);
  if (!(store.getSettings().budgets?.total) && !Object.keys(store.getSettings().budgets?.byCat || {}).length) {
    await store.saveSettings({ budgets: { total: 2300, byCat: { groceries: 350, dining: 250, transport: 200, shopping: 150, fun: 100, subscriptions: 60 } }, demoBudgets: true });
  }

  // ---------------- net worth ----------------
  const A = (name, kind, category, extra = {}) => ({ id: id(), demo: true, name, kind, category, ...extra });
  const nw = {
    checking: A('Checking', 'asset', 'cash', { currency: 'EUR', institution: 'Revolut', custody: 'bank', purpose: 'Spending' }),
    hysa: A('High-yield savings', 'asset', 'savings', { currency: 'EUR', institution: 'Trade Republic', custody: 'bank', purpose: 'Emergency fund', apy: 3.75 }),
    mmf: A('Money-market fund', 'asset', 'savings', { currency: 'USD', institution: 'IBKR', custody: 'broker', purpose: 'Short-term goals', apy: 4.6, liquid: true }),
    etf: A('ETF portfolio', 'asset', 'brokerage', { currency: 'USD', institution: 'IBKR', custody: 'broker', purpose: 'Long-term investing' }),
    pension: A('Pension fund', 'asset', 'retirement', { currency: 'EUR', institution: 'Pension', custody: 'broker', purpose: 'Retirement' }),
    cexAcc: A('Binance spot', 'asset', 'crypto', { currency: 'USD', institution: 'Binance', custody: 'cex', purpose: 'Crypto', tracksHoldings: true, holdings: [
      { id: id(), type: 'crypto', symbol: 'SOL', qty: 18, price: 150, cost: 2100, priceSource: 'demo', priceAt: now.toISOString() },
      { id: id(), type: 'crypto', symbol: 'LINK', qty: 140, price: 14, cost: 1650, priceSource: 'demo', priceAt: now.toISOString() },
      { id: id(), type: 'crypto', symbol: 'USDC', qty: 2500, price: 1, cost: 2500, priceSource: 'demo', priceAt: now.toISOString() },
    ] }),
    cold: A('Cold wallet (BTC)', 'asset', 'crypto', { currency: 'USD', institution: 'Hardware wallet', custody: 'self', purpose: 'Long-term investing', tracksHoldings: true, holdings: [
      { id: id(), type: 'crypto', symbol: 'BTC', qty: 0.12, price: 68000, cost: 4200, priceSource: 'demo', priceAt: now.toISOString() },
    ] }),
    defi: A('Staked ETH (Lido)', 'asset', 'crypto', { currency: 'USD', institution: 'Lido', custody: 'dex', purpose: 'Crypto', apy: 3.1 }),
    trading: A('Swing trading capital', 'asset', 'trading', { currency: 'USD', institution: 'IBKR', custody: 'broker', purpose: 'Trading capital' }),
    bybit: A('Bybit trading capital', 'asset', 'trading', { currency: 'USDT', institution: 'Bybit', custody: 'cex', purpose: 'Trading capital' }),
    home: A('Apartment', 'asset', 'realestate', { currency: 'EUR', purpose: 'Home & property' }),
    car: A('Car', 'asset', 'vehicle', { currency: 'EUR' }),
    mortgage: A('Mortgage', 'liability', 'mortgage', { currency: 'EUR', institution: 'Bank', rate: 3.4, payment: 820 }),
    cc: A('Credit card', 'liability', 'credit', { currency: 'EUR', institution: 'Amex', rate: 21 }),
  };
  const M = 30;
  const snaps = [];
  let v = { checking: 3800, hysa: 9000, mmf: 4000, etf: 26000, pension: 18000, defi: 4200, home: 185000, car: 19000, mortgage: 142000, cc: 900, trading: 30000, bybit: 6000 };
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
      v.trading = Math.max(15000, v.trading * (1 + 0.012 + normal() * 0.05));
      v.bybit = Math.max(2000, v.bybit * (1 + 0.01 + normal() * 0.09));
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
  // subscriptions & bills come out of the everyday account, salary goes into it
  await store.putMany('recurring', bills.map(b => ({ ...b, accountId: b.category === 'subscriptions' && b.method === 'Credit card' ? nw.cc.id : nw.checking.id })));
  await store.putMany('txns', txns.filter(t => t.recurringId).map(t => ({ ...t, accountId: store.get('recurring', t.recurringId)?.accountId || '' })));
  await store.putMany('nwSnapshots', snaps.filter(s => !store.all('nwSnapshots').some(x => x.date === s.date)));
  const pl = store.getSettings().plan;
  if (!Object.keys(pl.targetAllocation || {}).length) {
    await store.saveSettings({ plan: { currentAge: 31, retirementAge: 50, targetAllocation: { cash: 3, savings: 10, brokerage: 25, trading: 12, retirement: 10, crypto: 10, realestate: 28, vehicle: 2 } } });
  }
}
