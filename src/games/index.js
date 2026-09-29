import dice from './dice.js';
import limbo from './limbo.js';
import crash from './crash.js';
import plinko from './plinko.js';
import mines from './mines.js';
import wheel from './wheel.js';

// Aparência do cartão no lobby: gradiente + ícone SVG.
const ART = {
  plinko: {
    bg: ['#ff4d8d', '#8b1dff'],
    icon: '<g fill="#fff"><circle cx="50" cy="22" r="4"/><circle cx="40" cy="36" r="4"/><circle cx="60" cy="36" r="4"/><circle cx="30" cy="50" r="4"/><circle cx="50" cy="50" r="4"/><circle cx="70" cy="50" r="4"/><circle cx="20" cy="64" r="4"/><circle cx="40" cy="64" r="4"/><circle cx="60" cy="64" r="4"/><circle cx="80" cy="64" r="4"/></g><circle cx="55" cy="29" r="7" fill="#ffd23d"/><g fill="#ffd23d"><rect x="12" y="76" width="14" height="10" rx="2"/><rect x="30" y="76" width="14" height="10" rx="2" opacity=".8"/><rect x="48" y="76" width="14" height="10" rx="2" opacity=".6"/><rect x="66" y="76" width="14" height="10" rx="2" opacity=".8"/></g>',
  },
  mines: {
    bg: ['#1fb2ff', '#1043c9'],
    icon: '<path d="M50 14 78 40 50 86 22 40Z" fill="#5dffb0"/><path d="M50 14 78 40H22Z" fill="#b8ffde"/><path d="M50 86 78 40H50Z" fill="#00c96b"/>',
  },
  crash: {
    bg: ['#ffb02e', '#ff3d57'],
    icon: '<path d="M12 84Q50 80 84 18" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M84 18 70 22 80 32Z" fill="#fff"/><text x="16" y="40" font-family="Inter,sans-serif" font-weight="800" font-size="20" fill="#fff">2.4×</text>',
  },
  dice: {
    bg: ['#3dd6a0', '#0b7d6b'],
    icon: '<rect x="18" y="18" width="64" height="64" rx="14" fill="#fff"/><g fill="#0b7d6b"><circle cx="35" cy="35" r="6"/><circle cx="65" cy="35" r="6"/><circle cx="50" cy="50" r="6"/><circle cx="35" cy="65" r="6"/><circle cx="65" cy="65" r="6"/></g>',
  },
  limbo: {
    bg: ['#8b5cff', '#2a1a7a'],
    icon: '<circle cx="50" cy="50" r="34" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="4"/><circle cx="50" cy="50" r="22" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="4"/><text x="50" y="58" text-anchor="middle" font-family="Inter,sans-serif" font-weight="800" font-size="22" fill="#fff">99×</text>',
  },
  wheel: {
    bg: ['#ffd23d', '#ff7a1a'],
    icon: '<circle cx="50" cy="54" r="34" fill="#fff"/><g stroke="#ff7a1a" stroke-width="6"><path d="M50 20v68M16 54h68M26 30l48 48M74 30 26 78"/></g><circle cx="50" cy="54" r="12" fill="#1b2d3b"/><path d="M42 8h16L50 24Z" fill="#ff3d57"/>',
  },
};

export const games = [plinko, mines, crash, dice, limbo, wheel].map((g) => ({ ...g, art: ART[g.id] }));
export const byId = Object.fromEntries(games.map((g) => [g.id, g]));

export function thumbSvg(g) {
  return `<svg viewBox="0 0 100 100" aria-hidden="true">${g.art.icon}</svg>`;
}
