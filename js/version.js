// App version + "check for update". The site is static (GitHub Pages), so an update
// means: fetch version.json fresh, and if it's newer, re-download every app file into
// the browser cache and reload. Bump APP_VERSION *and* version.json together.
export const APP_VERSION = '0.3.0';

export const CHANGELOG = [
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
