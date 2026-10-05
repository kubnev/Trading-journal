// One-time conversion of data from the old "trading journal + net worth" version.
//  • Net-worth accounts that mirrored a trading account become normal accounts: their current
//    value (starting balance + deposits/withdrawals + closed-trade P&L) is recorded for today.
//  • Monthly cash-flow totals become one spending transaction per month, so your usual
//    monthly spending keeps its history.
// Old trades / journal entries are left untouched in the browser database (not shown, not deleted).
import * as store from './store.js';
import { today } from './ui.js';

// realised net P&L of a closed trade (average cost), same rules the old trading journal used
function closedNet(t) {
  const dir = t.side === 'short' ? -1 : 1, mult = +t.multiplier || 1, open = dir === 1 ? 'buy' : 'sell';
  const ex = [...(t.executions || [])].filter(e => +e.qty > 0 && e.price != null && e.price !== '')
    .sort((a, b) => (a.datetime || '').localeCompare(b.datetime || '') || (a.action === open ? 0 : 1) - (b.action === open ? 0 : 1));
  let pos = 0, avg = 0, pnl = 0, fees = 0;
  for (const e of ex) {
    const q = +e.qty, p = +e.price; fees += +e.fee || 0;
    if (e.action === open) { avg = (avg * pos + p * q) / (pos + q); pos += q; }
    else { const c = Math.min(q, pos); pnl += (p - avg) * c * dir * mult; pos -= c; }
  }
  if (!ex.length || pos > 1e-9) return null;   // still open
  return { net: pnl - fees - (+t.funding || 0), day: (ex.at(-1).datetime || '').slice(0, 10) };
}

export async function migrateLegacy(src = null) {
  const s = store.getSettings();
  if (s.v1Migrated && !src) return false;
  let changed = false;

  // 1. linked accounts → plain accounts with today's value
  const linked = store.all('nwAccounts').filter(a => a.linkedTradingAccountId);
  if (linked.length) {
    const tAccounts = src?.tAccounts || await store.readLegacy('tAccounts');
    const transfers = src?.tTransfers || await store.readLegacy('tTransfers');
    const trades = src?.trades || await store.readLegacy('trades');
    const d = today();
    const snap = store.all('nwSnapshots').find(x => x.date === d);
    const balances = { ...(snap?.balances || {}) };
    for (const a of linked) {
      const ta = tAccounts.find(x => x.id === a.linkedTradingAccountId);
      let v = +ta?.startingBalance || 0;
      for (const x of transfers) if (x.accountId === a.linkedTradingAccountId) v += (x.type === 'withdrawal' ? -1 : 1) * (+x.amount || 0);
      for (const t of trades) if (t.accountId === a.linkedTradingAccountId) { const c = closedNet(t); if (c) v += c.net; }
      balances[a.id] = Math.round(v * 100) / 100;
      await store.put('nwAccounts', { ...a, linkedTradingAccountId: '', currency: ta?.currency || a.currency, note: a.note });
    }
    await store.put('nwSnapshots', { ...(snap || { date: d }), balances });
    changed = true;
  }

  // 2. monthly cash-flow totals → transactions
  const months = store.all('nwCashflow');
  if (months.length) {
    const tx = [];
    for (const m of months) {
      const base = { date: `${m.id}-01`, currency: m.currency, imported: 'cashflow', note: m.note || '' };
      if (+m.expenses) tx.push({ ...base, type: 'expense', amount: +m.expenses, category: 'other', note: base.note || 'Monthly spending total (from the old Cash flow page)' });
    }
    if (tx.length) await store.putMany('txns', tx);
    for (const m of months) await store.del('nwCashflow', m.id);
    changed = true;
  }

  if (!s.v1Migrated) await store.saveSettings({ v1Migrated: true });
  return changed;
}
