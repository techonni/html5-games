// Ícones SVG desenhados à mão para a interface.
export const icons = {
  plus: '<svg width="34" height="34" viewBox="0 0 34 34"><path d="M17 5v24M5 17h24" stroke="#333" stroke-width="2.6" stroke-linecap="round"/></svg>',
  chevron: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1.5 4.5 7 10l5.5-5.5" fill="none" stroke="#555" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dots: '<svg width="20" height="20" viewBox="0 0 20 20"><g fill="#333"><circle cx="10" cy="3.5" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="10" cy="16.5" r="1.6"/></g></svg>',
  expand: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#333" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2h7v7M20 2l-7 7M9 20H2v-7M2 20l7-7"/></svg>',
  collapse: '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#333" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 2l-7 7M13 3v6h6M2 20l7-7M9 19v-6H3"/></svg>',
  home: '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="#333" stroke-width="1.6" stroke-linejoin="round"><path d="M4 13.5 15 4l11 9.5M7 11v14h16V11"/></svg>',
  trade:
    '<svg width="30" height="30" viewBox="0 0 30 30"><rect x="4.5" y="4.5" width="21" height="21" rx="3" fill="currentColor" stroke="currentColor" stroke-width="1.6"/><g stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M11 21V9M8 12l3-3 3 3M19 9v12M16 18l3 3 3-3"/><path d="M15 15h0"/></g></svg>',
  tradeOutline:
    '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="#333" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="4.5" width="21" height="21" rx="3"/><path d="M11 21V9M8 12l3-3 3 3M19 9v12M16 18l3 3 3-3"/></svg>',
  positions: '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="15" cy="15" r="11"/><path d="M15 8v7h5"/></svg>',
  positionsActive: '<svg width="30" height="30" viewBox="0 0 30 30"><circle cx="15" cy="15" r="11.8" fill="currentColor"/><path d="M15 8v7h5" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  menu: '<svg width="30" height="30" viewBox="0 0 30 30" stroke="#333" stroke-width="1.6" stroke-linecap="round"><path d="M5 8h20M5 15h20M5 22h20"/></svg>',
  stopwatch:
    '<svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#3d86d8" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="12.5" r="7"/><path d="M8.5 2.5h5M11 2.5v3M11 12.5V9"/></svg>',
  contract:
    '<svg width="34" height="34" viewBox="0 0 34 34" fill="none" stroke="#999" stroke-width="1.3" stroke-linecap="round"><rect x="3.5" y="3.5" width="27" height="27" rx="3"/><path d="M12 10v14M17 14v10M22 10v8M10 13h4M15 19h4M20 14h4"/></svg>',
  close: '<svg width="20" height="20" viewBox="0 0 20 20" stroke="#333" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l12 12M16 4 4 16"/></svg>',
};

// Ícone do índice sintético: etiqueta com o número, bolha "1s" e velas.
export function symbolIcon(badge, size = 38) {
  const w = 8 + badge.length * 6;
  return `<svg width="${size}" height="${size}" viewBox="0 0 38 38">
    <rect x="0" y="1" width="${w}" height="11" rx="2.5" fill="#333"/>
    <text x="${w / 2}" y="9.6" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="8.5" font-weight="700" fill="#fff">${badge}</text>
    <circle cx="${w + 6.5}" cy="6.5" r="5.3" fill="#e84a52"/>
    <text x="${w + 6.5}" y="8.8" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="6.5" font-weight="700" fill="#fff">1s</text>
    <g stroke="#3b94ae" stroke-width="1.2"><path d="M4 18v9M10 16v12M16 20v10M22 17v11M28 13v14M34 12v25"/></g>
    <g fill="#3b94ae"><rect x="2" y="20.5" width="4" height="4"/><rect x="8" y="18" width="4" height="7"/><rect x="14" y="22" width="4" height="5"/><rect x="20" y="19" width="4" height="7"/><rect x="26" y="15" width="4" height="8"/><rect x="32" y="14" width="4" height="7"/></g>
  </svg>`;
}
