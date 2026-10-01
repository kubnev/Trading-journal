// "Alex mode": a Rick and Morty–inspired skin. Purely cosmetic — numbers,
// data and currency are never changed, only colours, fonts and wording.
import { getSettings } from './store.js';

export const isAlex = () => !!getSettings().alexMode;

// Sidebar / page labels while Alex mode is on (keyed by route path)
const NAV_LABELS = {
  '/trading': 'Citadel HQ',
  '/trading/trades': 'Adventures',
  '/trading/calendar': 'Timeline',
  '/trading/reports': "Rick's analysis",
  '/trading/journal': "Morty's diary",
  '/trading/playbook': 'Schemes',
  '/trading/accounts': 'Galactic banks',
  '/networth': 'Multiverse wealth',
  '/networth/update': 'Recalibrate portal',
  '/networth/accounts': 'Plumbuses & debts',
  '/networth/cashflow': 'Schmeckle flow',
  '/networth/plan': 'Retire to Blips & Chitz',
  '/settings': 'Garage settings',
};
export const navLabel = (path, fallback) => (isAlex() && NAV_LABELS[path]) || fallback;

// Page title swaps (matched on the original h1 text)
const TITLES = {
  'Trading dashboard': 'Citadel HQ',
  'Trades': 'Adventures log',
  'Calendar': 'Timeline (C-137)',
  'Reports': "Rick's analysis",
  'Daily journal': "Morty's diary",
  'Playbook': 'Schemes playbook',
  'Trading accounts': 'Galactic Federation banks',
  'New trade': 'New adventure',
  'Net worth': 'Multiverse net worth',
  'Update balances': 'Recalibrate the portal',
  'Assets & debts': 'Plumbuses & debts',
  'Cash flow': 'Schmeckle flow',
  'Financial independence': 'Retire to Blips & Chitz',
  'Settings & data': 'Garage settings',
};
const QUIPS = [
  'Wubba lubba dub dub!',
  "Nobody exists on purpose. Everybody's gonna journal.",
  "Sometimes science is more art than science, Morty.",
  "Get Schwifty with your edge.",
  "To live is to risk it all — but size it at 0.5R.",
  "I'm not saying the stop was wrong, Morty. I'm saying you moved it.",
  "Show me what you got! (Your expectancy, Morty.)",
  "Existence is pain — so is overtrading.",
  'Ooh-wee! Look at that equity curve.',
  "Don't think about it. Journal about it.",
  "Your boos mean nothing; I've seen what makes you cheer — profit factor > 2.",
];
const TOASTS = ['Wubba lubba dub dub!', 'Ooh-wee!', 'Riggity riggity wrecked, son!', "And that's the waaaay the news goes!", 'Grassss… tastes bad.', 'Show me what you got!', 'Schwifty!'];
const pick = a => a[Math.floor(Math.random() * a.length)];
export const toastSuffix = () => (isAlex() ? ' — ' + pick(TOASTS) : '');

// Post-render touches on the current page
export function decoratePage(page) {
  if (!isAlex() || !page) return;
  const h1 = page.querySelector('h1');
  if (h1) {
    const orig = h1.textContent.trim();
    if (TITLES[orig]) h1.textContent = TITLES[orig];
    const head = h1.closest('.page-head') || h1.parentElement;
    if (head && !page.querySelector('.alex-quip')) {
      const q = document.createElement('div');
      q.className = 'alex-quip';
      q.textContent = pick(QUIPS);
      (head.querySelector('.sub') || h1).after(q);
    }
  }
  if (document.body.classList.contains('home')) {
    const hero = page.querySelector('.hero h1');
    if (hero) hero.textContent = 'Your trades & net worth, across the multiverse.';
  }
}

// Original portal-swirl mark (no show artwork used)
export const PORTAL_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="pg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#eaffb0"/><stop offset=".45" stop-color="#97ce4c"/><stop offset="1" stop-color="#2f6b12"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#pg)"/><path d="M32 8c13 0 22 9 22 20s-9 18-19 18-15-6-15-13 5-11 11-11 8 3 8 7-2 6-5 6" fill="none" stroke="#d7ff8a" stroke-width="3.5" stroke-linecap="round"/><path d="M32 56C19 56 10 47 10 36" fill="none" stroke="#1f4d0b" stroke-width="3" stroke-linecap="round" opacity=".6"/></svg>`;
