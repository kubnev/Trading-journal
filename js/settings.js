import * as store from './store.js';
import { html, raw, esc, toast, download, readFileText, confirmDlg, modal, formData, today } from './ui.js';
import { loadDemo, removeDemo, hasDemo } from './demo.js';
import { exportTradesCSV, importTradesCSVDialog } from './trading/csv.js';
import { refresh } from './main.js';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'BGN', 'CHF', 'JPY', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'RON', 'HUF', 'TRY', 'INR', 'SGD', 'HKD', 'CNY', 'ZAR', 'BRL', 'MXN', 'AED', 'USDT'];

export default async function settingsView(el) {
  const s = store.getSettings();
  const est = await store.storageEstimate();
  const persisted = await store.isPersisted();
  const counts = Object.fromEntries(store.COLLECTIONS.map(c => [c, store.all(c).length]));

  el.innerHTML = String(html`
    <div class="page-head"><div><h1>Settings & data</h1><div class="sub">Preferences, backups, import/export.</div></div></div>
    <div class="grid g2">
      <div class="stack">
        <div class="card alex-card">
          <div class="row"><div><h2>Alex mode</h2><p class="small muted" style="margin:4px 0 0">Rick and Morty skin for the whole site — portal green, space background, themed names. Purely cosmetic; your numbers don't change.</p></div><span class="spacer"></span>
          <button type="button" class="switch ${s.alexMode ? 'on' : ''}" role="switch" aria-checked="${s.alexMode ? 'true' : 'false'}" data-act="alex"><span class="knob"></span><span class="sr">Alex mode</span></button></div>
        </div>
        <form class="card" id="prefs">
          <div class="card-head"><h2>Preferences</h2></div>
          <div class="form-grid">
            <label class="field">Currency
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
          <p class="small muted mt">Amounts are tracked in one base currency. If you hold accounts in other currencies, enter their converted value.</p>
          <div class="row mt"><span class="spacer"></span><button class="btn primary">Save preferences</button></div>
        </form>

        <form class="card" id="lists">
          <div class="card-head"><h2>Trading tag lists</h2><span class="hint">One per line</span></div>
          <div class="form-grid">
            <label class="field">Mistakes<textarea name="mistakes" rows="8">${s.tagLists.mistakes.join('\n')}</textarea></label>
            <label class="field">Emotions<textarea name="emotions" rows="8">${s.tagLists.emotions.join('\n')}</textarea></label>
            <label class="field">Tags / conditions<textarea name="tags" rows="8">${s.tagLists.tags.join('\n')}</textarea></label>
          </div>
          <div class="row mt"><span class="spacer"></span><button class="btn primary">Save lists</button></div>
        </form>
      </div>

      <div class="stack">
        <div class="card">
          <div class="card-head"><h2>Backup & restore</h2></div>
          <p class="small muted">Your data lives only in this browser${persisted ? ' (persistent storage granted)' : ''}. Clearing site data, switching browsers or devices loses it — keep a backup.</p>
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
          <p class="small muted">Import round-trip trades from any broker export or spreadsheet — you map the columns. Export gives one row per trade with all computed metrics.</p>
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
          <div class="card-head"><h2>Danger zone</h2></div>
          <p class="small muted">Delete everything stored by this site in this browser. Export a backup first.</p>
          <button class="btn danger" data-act="wipe">Delete all data…</button>
        </div>
      </div>
    </div>`);

  el.querySelector('#prefs').onsubmit = async e => {
    e.preventDefault();
    const f = formData(e.target);
    await store.saveSettings({ currency: f.currency, locale: f.locale || undefined, pnlColors: f.pnlColors, theme: f.theme });
    toast('Preferences saved'); refresh();
  };
  el.querySelector('#lists').onsubmit = async e => {
    e.preventDefault();
    const f = formData(e.target);
    const lines = v => [...new Set(v.split('\n').map(x => x.trim()).filter(Boolean))];
    await store.saveSettings({ tagLists: { mistakes: lines(f.mistakes), emotions: lines(f.emotions), tags: lines(f.tags) } });
    toast('Lists saved');
  };

  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (!a) return;
    if (a === 'alex') {
      await store.saveSettings({ alexMode: !s.alexMode });
      toast(store.getSettings().alexMode ? 'Alex mode on' : 'Alex mode off'); refresh();
    } else if (a === 'export' || a === 'export-lite') {
      const b = await store.exportBackup({ includeImages: a === 'export' });
      download(`journal-backup-${today()}.json`, JSON.stringify(b));
      toast('Backup downloaded');
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
        body: `<p>This permanently deletes every trade, journal entry, screenshot, account and snapshot stored in this browser. It cannot be undone.</p><label class="field">Type <b>DELETE</b> to confirm<input name="c" autocomplete="off"></label>`,
        actions: [{ label: 'Cancel' }, { label: 'Delete everything', kind: 'danger', value: w => (w.querySelector('[name=c]').value === 'DELETE' ? true : (toast('Type DELETE to confirm', 'error'), false)) }],
      });
      if (ok === true) { await store.clearAll(); toast('All data deleted'); refresh(); }
    }
  });

  el.querySelector('[data-act=import]').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    let obj;
    try { obj = JSON.parse(await readFileText(f)); } catch { toast('Could not read that file as JSON', 'error'); return; }
    const mode = await modal({
      title: 'Restore backup',
      body: `<p>Backup from <b>${esc(obj.exportedAt ? new Date(obj.exportedAt).toLocaleString() : 'unknown date')}</b>.</p><p class="small muted"><b>Replace</b> deletes current data first. <b>Merge</b> adds the backup's records and overwrites records with the same id.</p>`,
      actions: [{ label: 'Cancel' }, { label: 'Merge', value: () => 'merge' }, { label: 'Replace all', kind: 'primary', value: () => 'replace' }],
    });
    if (mode !== 'merge' && mode !== 'replace') return;
    if (mode === 'replace' && !(await confirmDlg('Replace all data?', 'Current data in this browser will be deleted and replaced by the backup.', 'Replace'))) return;
    try { await store.importBackup(obj, { mode }); toast('Backup restored'); refresh(); }
    catch (err) { toast(err.message, 'error'); }
  };
}
