// Regenerate version.json after changing APP_VERSION in js/version.js:
//   node scripts/version.mjs "short release notes"
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const version = readFileSync('js/version.js', 'utf8').match(/APP_VERSION = '([\d.]+)'/)[1];
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...walk('css'), ...walk('js')].map(p => p.replace(/\\/g, '/')).sort();
writeFileSync('version.json', JSON.stringify({ version, notes: process.argv[2] || '', files }, null, 2) + '\n');
console.log(`version.json → ${version} (${files.length} files)`);
