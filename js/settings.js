import * as store from './store.js';
import { html, raw, esc, toast, download, readFileText, confirmDlg, modal, formData, today } from './ui.js';
import { loadDemo, removeDemo, hasDemo } from './demo.js';
import { exportTradesCSV, importTradesCSVDialog } from './trading/csv.js';
import { refresh } from './main.js';
import { APP_VERSION, CHANGELOG, checkForUpdate, applyUpdate } from './version.js';
import { exportBackupFlow, importBackupFlow } from './backup.js';

import { CURRENCIES, refreshRates, currenciesInUse, otherCurrencies, ratesAt, rate, usingFallback, migrateCurrencies } from './fx.js';

export default async function settingsView(el) {
  const s = store.getSettings();
  const est = await store.storageEstimate();
  const persisted = await store.isPersisted();
  const counts = Object.fromEntries(store.COLLECTIONS.map(c => [c, store.all(c).length]));

  el.innerHTML = String(html`
    <div class="page-head"><div><h1>Settings & data</h1><div class="sub">Preferences, backups, import/export.</div></div></div>
    <div class="grid g2">
      <div class="stack">
        <form class="card" id="prefs">
          <div class="card-head"><h2>Preferences</h2></div>
          <div class="form-grid">
            <label class="field">Display currency <span class="hint">totals & charts are converted to this</span>
              <select name="currency">${CURRENCIES.map(c => html`<option ${c === s.currency ? raw('selected') : ''}>${c}</option>`)}</select>
            </label>
            <label class="field">Number & date format
              <select name="locale">
                ${[['', 'Browser default'], ['en-US', 'English (US)'], ['en-GB', 'English (UK)'], ['de-DE', 'German'], ['bg-BG', 'Bulgarian'], ['fr-FR', 'French']].map(([v, l]) => html`<option value="${v}" ${(s.locale || '') === v ? raw('selected') : ''}>${l}</option>`)}
              </select>
            </label>
            <label class="field">Profit / loss colours
              <select name="pnlColors">
                <option value="greenred" ${s.pnlColors === 'greenred' ? raw('selected') : ''}>Green / red</option>
                <option value="blueorange" ${s.pnlColors === 'blueorange' ? raw('selected') : ''}>Blue / orange (colour-blind friendly)</option>
              </select>
            </label>
            <label class="field">Theme
              <select name="theme"><option value="auto" ${s.theme === 'auto' ? raw('selected') : ''}>Auto (match system)</option><option value="dark" ${s.theme === 'dark' ? raw('selected') : ''}>Dark</option><option value="light" ${s.theme === 'light' ? raw('selected') : ''}>Light</option></select>
            </label>
          </div>
          <p class="small muted mt">Each account keeps its own currency (set it when you add the account). Everything is converted into the display currency using ECB reference rates — historical snapshots use the rate on that date.</p>
          <div class="row mt"><span class="spacer"></span><button class="btn primary">Save preferences</button></div>
        </form>

        <form class="card" id="lists">
          <div class="card-head"><h2>Lists — tags, habits</h2><span class="hint">One per line</span></div>
          <div class="form-grid">
            <label class="field">Mistakes<textarea name="mistakes" rows="8">${s.tagLists.mistakes.join('\n')}</textarea></label>
            <label class="field">Emotions<textarea name="emotions" rows="8">${s.tagLists.emotions.join('\n')}</textarea></label>
            <label class="field">Tags / conditions<textarea name="tags" rows="8">${s.tagLists.tags.join('\n')}</textarea></label>
            <label class="field">Daily habits<textarea name="habits" rows="8">${(s.habits || []).join('\n')}</textarea></label>
            <label class="field">Journal day tags<textarea name="dayTags" rows="8">${(s.dayTags || []).join('\n')}</textarea></label>
          </div>
          <div class="row mt"><span class="spacer"></span><button class="btn primary">Save lists</button></div>
        </form>
      </div>

      <div class="stack">
        <div class="card">
          <div class="card-head"><h2>Backup & restore</h2></div>
          <p class="small muted">Your data lives only in this browser${persisted ? ' (persistent storage granted)' : ''}. Clearing site data, switching browsers or devices loses it — keep a backup. Backups are <b>encrypted with a password you choose</b> (AES-256); restoring asks for it.</p>
          <div class="row">
            <button class="btn primary" data-act="export">Export full backup (.json)</button>
            <button class="btn" data-act="export-lite">Export without screenshots</button>
          </div>
          <div class="row mt">
            <label class="btn">Restore from backup…<input type="file" accept=".json,application/json" data-act="import" hidden></label>
          </div>
          <p class="small muted mt" style="margin-bottom:0">
            ${counts.trades} trades · ${counts.tAccounts} trading accounts · ${counts.days} journal days · ${counts.setups} setups ·
            ${counts.nwAccounts} net-worth accounts · ${counts.nwSnapshots} snapshots · ${counts.nwCashflow} cash-flow months
            ${est ? html`<br>Using ${(est.usage / 1048576).toFixed(1)} MB of local storage.` : ''}
          </p>
        </div>

        <div class="card">
          <div class="card-head"><h2>Trades CSV</h2></div>
          <p class="small muted">Import round-trip trades from any broker export or spreadsheet — you map the columns. Export gives one row per trade with all computed metrics. <b>CSV files are not encrypted</b> — use a backup for safekeeping.</p>
          <div class="row">
            <button class="btn" data-act="csv-import">Import trades from CSV…</button>
            <button class="btn" data-act="csv-export">Export trades CSV</button>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Demo data</h2></div>
          ${hasDemo() ? html`<p class="small muted">Demo data is loaded. Remove it before you start logging real entries (your own entries are kept).</p><button class="btn" data-act="demo-remove">Remove demo data</button>`
                      : html`<p class="small muted">Load sample trades, journal days, accounts and net-worth history to explore every chart.</p><button class="btn" data-act="demo-load">Load demo data</button>`}
        </div>

        <div class="card">
          <div class="card-head"><h2>Exchange rates</h2><span class="hint">${ratesAt() ? 'updated ' + new Date(ratesAt()).toLocaleString() : usingFallback() && currenciesInUse().length ? 'approximate — not loaded yet' : 'not needed yet'}</span></div>
          ${otherCurrencies().length ? html`<table class="data compact"><tbody>${otherCurrencies().map(c => html`<tr><td>1 ${s.currency}</td><td class="num">${(rate(c) / rate(s.currency)).toFixed(4)} ${c}</td><td class="num muted">1 ${c} = ${(rate(s.currency) / rate(c)).toFixed(4)} ${s.currency}</td></tr>`)}</tbody></table>` : html`<p class="small muted">All your accounts use ${s.currency}. Add an account in another currency and rates load automatically.</p>`}
          <div class="row mt"><button class="btn" data-act="fx">Refresh rates</button><span class="small muted">Source: European Central Bank (via Frankfurter), Coinbase as fallback.</span></div>
        </div>

        <form class="card" id="pricecfg">
          <div class="card-head"><h2>Price data</h2><span class="hint">last update: ${s.priceApi?.lastUpdate ? new Date(s.priceApi.lastUpdate).toLocaleString() : 'never'}</span></div>
          <p class="small muted">Holdings in net worth can fetch live prices. <b>Crypto</b> works out of the box (Binance, with Coinbase as fallback). <b>Stocks/ETFs</b> need a free API key from <a href="https://finnhub.io/register" target="_blank" rel="noopener">finnhub.io</a> (US-listed symbols on the free plan). The key is stored only in this browser and sent only to Finnhub. Prices are converted from USD into each account's currency using ECB rates.</p>
          <div class="row"><input name="finnhubKey" value="${s.priceApi?.finnhubKey || ''}" placeholder="Finnhub API key" autocomplete="off" spellcheck="false" style="flex:1;min-width:200px"><button class="btn primary">Save key</button></div>
        </form>

        <div class="card">
          <div class="card-head"><h2>About this beta</h2><span class="hint">v${APP_VERSION}</span></div>
          <p class="small muted">The site is static — new versions appear when you reload, but your browser may keep old files cached for a few minutes. This checks for a newer version and loads it.</p>
          <div class="row"><button class="btn" data-act="update">Check for app update</button><span class="small muted" id="upd"></span></div>
          <details class="mt"><summary class="small" style="cursor:pointer">What's new</summary><dl class="small mt" style="margin:8px 0 0">${CHANGELOG.map(([v, n]) => html`<dt><b>v${v}</b></dt><dd style="margin:0 0 8px">${n}</dd>`)}</dl></details>
        </div>

        <div class="card">
          <div class="card-head"><h2>Danger zone</h2></div>
          <p class="small muted">Wipe every trade, journal entry, screenshot, account, snapshot and setting (including your Finnhub key) from this browser. Export a backup first if you want to keep anything.</p>
          <button class="btn danger" data-act="wipe">Delete all data…</button>
        </div>
      </div>
    </div>`);

  el.querySelector('#prefs').onsubmit = async e => {
    e.preventDefault();
    const f = formData(e.target);
    await store.saveSettings({ currency: f.currency, locale: f.locale || undefined, pnlColors: f.pnlColors, theme: f.theme });
    await refreshRates().catch(() => {});
    toast('Preferences saved'); refresh();
  };
  el.querySelector('#pricecfg').onsubmit = async e => {
    e.preventDefault();
    await store.saveSettings({ priceApi: { ...(store.getSettings().priceApi || {}), finnhubKey: e.target.finnhubKey.value.trim() } });
    toast('Price data key saved');
  };
  el.querySelector('#lists').onsubmit = async e => {
    e.preventDefault();
    const f = formData(e.target);
    const lines = v => [...new Set(v.split('\n').map(x => x.trim()).filter(Boolean))];
    await store.saveSettings({ tagLists: { mistakes: lines(f.mistakes), emotions: lines(f.emotions), tags: lines(f.tags) }, habits: lines(f.habits), dayTags: lines(f.dayTags) });
    toast('Lists saved');
  };

  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (!a) return;
    if (a === 'fx') {
      const r = await refreshRates({ force: true });
      toast(r.ok ? 'Exchange rates updated' : 'Could not load rates: ' + (r.errors || []).join(' '), r.ok ? 'info' : 'error');
      refresh(); return;
    }
    if (a === 'update') {
      const out = el.querySelector('#upd');
      out.textContent = 'Checking…';
      try {
        const u = await checkForUpdate();
        if (!u.available) { out.textContent = `You're on the latest version (v${APP_VERSION}).`; return; }
        out.textContent = `v${u.latest} is available — loading…`;
        await applyUpdate(u.files);
      } catch (err) { out.textContent = 'Could not check: ' + err.message; }
    } else if (a === 'export' || a === 'export-lite') {
      if (await exportBackupFlow({ includeImages: a === 'export' })) refresh();
    } else if (a === 'csv-export') {
      exportTradesCSV();
    } else if (a === 'csv-import') {
      if (await importTradesCSVDialog()) refresh();
    } else if (a === 'demo-load') {
      await loadDemo(); toast('Demo data loaded'); refresh();
    } else if (a === 'demo-remove') {
      await removeDemo(); toast('Demo data removed'); refresh();
    } else if (a === 'wipe') {
      const ok = await modal({
        title: 'Delete all data?',
        body: `<p>This permanently deletes every trade, journal entry, screenshot, account, snapshot and setting stored in this browser. It cannot be undone.</p><label class="field">Type <b>DELETE</b> to confirm<input name="c" autocomplete="off"></label>`,
        actions: [{ label: 'Cancel' }, { label: 'Delete everything', kind: 'danger', value: w => (w.querySelector('[name=c]').value === 'DELETE' ? true : (toast('Type DELETE to confirm', 'error'), false)) }],
      });
      if (ok === true) { await store.wipeEverything(); toast('All data deleted'); refresh(); }
    }
  });

  el.querySelector('[data-act=import]').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f && (await importBackupFlow(f))) refresh();
  };
}
