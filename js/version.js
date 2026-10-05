// App version + "check for update". The site is static (GitHub Pages), so an update
// means: fetch version.json fresh, and if it's newer, re-download every app file into
// the browser cache and reload. Bump APP_VERSION *and* version.json together.
export const APP_VERSION = '1.3.2';

export const CHANGELOG = [
  ['1.3.2', 'Switching between light and dark now cross-fades smoothly instead of flashing (off when your device asks for reduced motion).'],
  ['1.3.1', 'Removed the “Stored locally in this browser” line from the sidebar.'],
  ['1.3.0', 'Built around balances instead of income. Removed: income entries, savings rate, FI planning and the To-do card (old income entries are hidden and can be deleted). New Moves page: plan transfers between your accounts (take profits, top up savings, pay a card, rebalance), see the interest each move gains or loses, mark it done and both balances update, or undo. New Interest page: per account earnings per day / month / year, earned since the last update and this year (APY changes keep the old rate for the past), what debts cost and cash that earns nothing. Expenses and subscriptions can be taken off an account’s balance (optional; reversed on edit or delete). Accounts & holdings is grouped by type with totals. The emotional journal is back under Spending — mood, energy, stress, sleep, habits — with insights on how you feel vs what you spend. Overview and Net worth now show interest, planned moves and cash runway; target allocation moved to Analytics with a 5/25 rebalancing band. Fixed: estimate tags cut off in narrow stat labels, and empty trend charts with a single balance update.'],
  ['1.2.0', 'Net worth first: the menu and the Overview now lead with net worth (12-month change, liquid net worth, savings rate, trend, allocation, FI progress, safety net); spending is a compact section below. New first-launch flow: Simple/Pro → starting estimates (income, spending, saving, budget, net worth a year ago, age) → a guided tour across every page on temporary sample data that is deleted afterwards. Long-term figures use your estimates (marked “estimate”) until you have a full calendar month of transactions, then switch to real averages automatically. Estimates are editable in Settings, which can also replay the tour.'],
  ['1.1.1', 'Sidebar: the input-mode note now reads “Input mode: Simple · change” instead of a bare “Simple input”.'],
  ['1.1.0', 'Subscriptions: add each one with the day it\'s charged and the account it comes from. Active subscriptions show on the Spending page (sorted by charge day, with monthly and yearly totals) and on their own tab; bills, income and paused items have tabs too, plus a “by account” breakdown. Charges are added automatically and carry the account.'],
  ['1.0.0', 'Ledgerline: a finance-only app — spending and net worth. New Spending section: quick add (button or N), month dashboard with pace, projection, safe-to-spend, categories vs average, income vs spending, needs/wants/saved (50/30/20), calendar, budgets, bills & subscriptions (auto-added, yearly cost), editable categories, bank CSV import/export. The trading journal and daily journal moved to the archive branch; linked trading accounts became normal accounts and old monthly cash-flow totals became transactions.'],
  ['0.7.1', 'Edit an account to change its balance: the form shows today\'s value and saving a new one records it for today, keeping earlier history.'],
  ['0.7.0', 'Simple / Pro is now an input mode, chosen on first launch: every page, chart and report is available in both — the difference is how much you fill in. Simple accounts are one of six plain types (Cash, Savings, Trading capital, Investments, Assets, Debt) with only the fields that type needs; Pro keeps the detailed categories. Switching modes never deletes anything (Settings → Input mode). Fixed hidden form fields sometimes still showing.'],
  ['0.6.2', 'Purpose / bucket is now a normal dropdown like the other fields (Auto, the standard buckets, any you created, or “Other” to type your own).'],
  ['0.6.1', 'Help everywhere: a “?” next to every form field and jargon table header explains it in a line or two — hover, tap or tab to it. Works in dialogs and on phones.'],
  ['0.6.0', 'Password-protected backups: exports are encrypted (AES-256-GCM, key from your password via PBKDF2 with 600,000 rounds) and restoring asks for the password. Restores check the whole file before touching your data and ignore unknown or invalid settings. "Delete all data" also removes settings and the API key. Content-Security-Policy: only the app\'s own code can run and it can only talk to the price and exchange-rate services. Enter now confirms dialogs.'],
  ['0.5.1', 'Full audit and fixes: partial exits now carry their share of entry fees (exits add up to the trade\'s net), same-time entry/exit ordering, exchange rates load as soon as a new currency is used, non-ECB currencies (AED) and BGN handled, USDT display currency, restoring a backup tags old records with a currency, typing is no longer wiped by background refreshes, CSV import reads European numbers, BOM, thesis/grade/review/lessons columns and skips rows closing before they open, deleting a trading account unlinks mirrored net-worth accounts, mobile layout overflow fixes, and smaller fixes across every page.'],
  ['0.5.0', 'Multi-currency: every account (net worth & trading) and cash-flow month keeps its own currency — EUR, USD, GBP and 20+ more. Totals, charts and dashboards are converted to the display currency from Settings using ECB rates (historical snapshots at the rate of their date). Holdings and live prices convert into each account\'s currency. Exchange-rate panel in Settings.'],
  ['0.4.1', 'Partial take-profits: "Take partial profit" / "Close rest" on positions and trades, size presets, stop to breakeven, per-exit P&L and R, edit or delete any exit. Editing a partially closed trade no longer collapses it into a full close.'],
  ['0.4.0', 'Claude-style design (ivory/charcoal, clay accent, serif headings). New structure: Overview, Net worth, Journal, Trading. Swing-trading focus: thesis-first trade form, open positions with live prices and portfolio heat, holding-period analysis. Daily journal with habits, open-position check-ins and insights. Net worth: fixed-yield accounts with live earnings, custody & purpose buckets, analytics and health scorecard. Help drawer and guided tour.'],
  ['0.3.0', 'Shared design language (amber accent, warm neutrals), one global Simple/Pro switch, holdings with live crypto/stock price updates, backup reminder, app update check.'],
  ['0.2.0', 'Auto colour scheme that follows your device.'],
  ['0.1.0', 'First beta: trading journal (trades, playbook, daily journal, calendar, reports) and net worth tracker (accounts, snapshots, cash flow, FI planning).'],
];

const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

// → { available: bool, latest: string, notes: string } ; throws if offline
export async function checkForUpdate() {
  const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`version.json responded ${r.status}`);
  const v = await r.json();
  return { available: newer(v.version, APP_VERSION), latest: v.version, notes: v.notes || '', files: v.files || [] };
}

// Refresh every app file in the HTTP cache, then reload the page.
export async function applyUpdate(files) {
  const list = ['index.html', ...files];
  await Promise.allSettled(list.map(f => fetch(f, { cache: 'reload' })));
  location.reload();
}
