// App version + "check for update". The site is static (GitHub Pages), so an update
// means: fetch version.json fresh, and if it's newer, re-download every app file into
// the browser cache and reload. Bump APP_VERSION *and* version.json together.
export const APP_VERSION = '0.6.0';

export const CHANGELOG = [
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
