// Arte flat em SVG: cores sólidas, uma única cor de sombra por forma, sem gradientes.
let uid = 0;

// Corpo base de cada espécie (viewBox 0 0 200 200, pés em y≈186).
const BODIES = {
  blob: 'M100 50c44 0 72 30 72 74 0 36-28 58-72 58s-72-22-72-58c0-44 28-74 72-74z',
  drop: 'M100 26c20 34 72 66 72 104 0 32-30 52-72 52s-72-20-72-52c0-38 52-70 72-104z',
  flame: 'M100 24c8 22 26 26 30 44 10-10 12-22 10-32 22 22 32 50 32 80 0 40-30 66-72 66s-72-26-72-66c0-24 8-44 22-58 2 14 8 22 16 26-2-26 14-44 34-60z',
  ghost: 'M100 34c42 0 68 32 68 72v76l-17-12-17 12-17-12-17 12-17-12-17 12-17-12-17 12v-76c0-40 26-72 68-72z',
  rock: 'M58 58h84c18 0 30 12 32 30l6 58c2 22-12 36-34 36H54c-22 0-36-14-34-36l6-58c2-18 14-30 32-30z',
  cat: 'M42 36l30 24c9-3 18-4 28-4s19 1 28 4l30-24 4 48c6 11 10 24 10 38 0 38-30 60-72 60s-72-22-72-60c0-14 4-27 10-38z',
  puff: 'M100 44c14 0 22 8 28 16 12-4 26 2 30 14 12 4 18 16 16 28 10 8 12 22 6 32 2 30-30 48-80 48s-82-18-80-48c-6-10-4-24 6-32-2-12 4-24 16-28 4-12 18-18 30-14 6-8 14-16 28-16z',
  crystal: 'M100 22l58 40 14 64-30 56H58l-30-56 14-64z',
};

// Decorações por espécie (desenhadas antes ou depois do corpo).
const EXTRAS = {
  sprout: (c) => ({
    back: `<path d="M100 54c-2-16 4-28 16-34 2 14-4 26-16 34z" fill="${c.accent}"/><path d="M100 54c-8-12-22-16-34-12 6 12 20 16 34 12z" fill="${c.accentShade}"/><rect x="97" y="40" width="6" height="18" rx="3" fill="${c.accentShade}"/>`,
  }),
  horns: (c) => ({
    back: `<path d="M58 70l-10-34 30 22z" fill="${c.accent}"/><path d="M142 70l10-34-30 22z" fill="${c.accent}"/>`,
  }),
  ears: (c) => ({
    back: `<ellipse cx="46" cy="74" rx="18" ry="30" transform="rotate(-24 46 74)" fill="${c.shade}"/><ellipse cx="154" cy="74" rx="18" ry="30" transform="rotate(24 154 74)" fill="${c.shade}"/><ellipse cx="48" cy="76" rx="9" ry="18" transform="rotate(-24 48 76)" fill="${c.belly}"/><ellipse cx="152" cy="76" rx="9" ry="18" transform="rotate(24 152 76)" fill="${c.belly}"/>`,
  }),
  moss: (c) => ({
    front: `<path d="M58 58h84c14 0 24 8 28 20-14-6-24 2-36-2-12 6-22-4-34 2-12-6-24 4-38-2-10 4-22-2-32 4 2-14 14-22 28-22z" fill="${c.accent}"/>`,
  }),
  spark: (c) => ({
    back: `<path d="M150 40l8 16 16 2-12 10 4 16-16-8-14 8 4-16-12-10 16-2z" fill="${c.accent}"/>`,
  }),
  shine: (c) => ({
    front: `<path d="M100 22l20 50-20 110-20-110z" fill="${c.belly}" opacity=".55"/><path d="M42 62l38 10-22 54z" fill="#ffffff" opacity=".35"/>`,
  }),
  none: () => ({}),
};

// Olhos grandes com brilho, boca e bochechas; a boca muda com o humor.
function face(c, eyesY = 104, spread = 30) {
  const eye = (x) => `
    <g class="eye" style="transform-origin:${x}px ${eyesY}px">
      <ellipse cx="${x}" cy="${eyesY}" rx="15" ry="17" fill="#fff"/>
      <ellipse class="pupil" cx="${x + 2}" cy="${eyesY + 3}" rx="8.5" ry="10" fill="#2b2b3a"/>
      <circle cx="${x + 5}" cy="${eyesY - 2}" r="3.2" fill="#fff"/>
    </g>`;
  const my = eyesY + 30;
  return `
    ${eye(100 - spread)}${eye(100 + spread)}
    <ellipse cx="${100 - spread - 16}" cy="${my - 6}" rx="9" ry="5.5" fill="${c.cheek}"/>
    <ellipse cx="${100 + spread + 16}" cy="${my - 6}" rx="9" ry="5.5" fill="${c.cheek}"/>
    <path class="mouth-smile" d="M88 ${my - 4}q12 12 24 0" fill="none" stroke="#2b2b3a" stroke-width="5" stroke-linecap="round"/>
    <g class="mouth-open">
      <ellipse cx="100" cy="${my}" rx="15" ry="13" fill="#3a1d2c"/>
      <ellipse cx="100" cy="${my + 6}" rx="9" ry="5" fill="#ff7a93"/>
    </g>
    <path class="mouth-sad" d="M88 ${my + 4}q12 -10 24 0" fill="none" stroke="#2b2b3a" stroke-width="5" stroke-linecap="round"/>`;
}

// SVG completo de um monstro. Sombra flat: o corpo desenhado na cor escura
// e por cima o mesmo corpo deslocado na cor base, recortado pela silhueta.
export function monsterSVG(sp, { silhouette = false } = {}) {
  const id = `m${uid++}`;
  const c = silhouette
    ? { base: '#d7dce6', shade: '#c7cdd9', belly: '#d7dce6', accent: '#c7cdd9', accentShade: '#bcc3d0', cheek: 'transparent', feet: '#c7cdd9' }
    : sp.colors;
  const extra = (EXTRAS[sp.extra] ?? EXTRAS.none)(c);
  const faceSvg = silhouette ? '' : face(c, sp.eyesY, sp.spread);
  return `<svg class="monster" viewBox="0 0 200 200" aria-hidden="true">
    <defs><path id="${id}b" d="${BODIES[sp.body]}"/><clipPath id="${id}c"><use href="#${id}b"/></clipPath></defs>
    <g class="mon-body">
      <ellipse class="feet" cx="72" cy="182" rx="18" ry="9" fill="${c.feet}"/>
      <ellipse class="feet" cx="128" cy="182" rx="18" ry="9" fill="${c.feet}"/>
      ${extra.back ?? ''}
      <g clip-path="url(#${id}c)">
        <use href="#${id}b" fill="${c.shade}"/>
        <use href="#${id}b" fill="${c.base}" transform="translate(-12 -10)"/>
        ${silhouette ? '' : `<ellipse cx="100" cy="${sp.bellyY ?? 150}" rx="${sp.bellyR ?? 42}" ry="${(sp.bellyR ?? 42) * 0.78}" fill="${c.belly}"/>`}
      </g>
      ${silhouette ? '' : extra.front ?? ''}
      ${faceSvg}
    </g>
  </svg>`;
}

// ---------- Ícones flat ----------
export const ICON = {
  coin: '<svg viewBox="0 0 40 40"><circle cx="20" cy="21" r="16" fill="#e5a800"/><circle cx="20" cy="19" r="16" fill="#ffc93c"/><circle cx="20" cy="19" r="10" fill="none" stroke="#e5a800" stroke-width="3"/><rect x="18" y="13" width="4" height="12" rx="2" fill="#e5a800"/></svg>',
  basket: '<svg viewBox="0 0 40 40"><path d="M10 16c0-6 4-10 10-10s10 4 10 10" fill="none" stroke="#b86b2b" stroke-width="3.5" stroke-linecap="round"/><path d="M4 16h32l-4 18H8z" fill="#e08a3c"/><path d="M4 16h32l-1 5H5z" fill="#b86b2b"/><path d="M14 22v9M20 22v9M26 22v9" stroke="#b86b2b" stroke-width="3" stroke-linecap="round"/></svg>',
  dex: '<svg viewBox="0 0 40 40"><rect x="5" y="5" width="30" height="30" rx="8" fill="#7b61ff"/><rect x="5" y="5" width="30" height="15" rx="8" fill="#957fff"/><rect x="5" y="16" width="30" height="4" fill="#5a40e0"/><circle cx="20" cy="20" r="6" fill="#fff" stroke="#5a40e0" stroke-width="3"/></svg>',
  gear: '<svg viewBox="0 0 40 40"><path d="M17 4h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z" fill="#aab3c2"/><circle cx="20" cy="20" r="7" fill="#fff"/></svg>',
  apple: '<svg viewBox="0 0 60 60"><path d="M30 18c-10-6-24-2-24 14 0 14 10 24 18 24 3 0 4-2 6-2s3 2 6 2c8 0 18-10 18-24 0-16-14-20-24-14z" fill="#e03b4f"/><path d="M30 18c10-6 24-2 24 14 0 14-10 24-18 24-3 0-4-2-6-2z" fill="#ff5a6e"/><rect x="28" y="6" width="4" height="14" rx="2" fill="#7a4a2a"/><path d="M32 12c4-8 12-8 16-6-4 8-12 8-16 6z" fill="#58c14a"/></svg>',
  cookie: '<svg viewBox="0 0 60 60"><circle cx="30" cy="32" r="24" fill="#c98a4a"/><circle cx="30" cy="30" r="24" fill="#e6a863"/><circle cx="20" cy="22" r="4" fill="#6b3f1f"/><circle cx="36" cy="18" r="3.5" fill="#6b3f1f"/><circle cx="40" cy="34" r="4.5" fill="#6b3f1f"/><circle cx="24" cy="40" r="4" fill="#6b3f1f"/><circle cx="30" cy="30" r="2.5" fill="#6b3f1f"/></svg>',
  fish: '<svg viewBox="0 0 60 60"><path d="M8 30c8-14 22-18 34-10l12-8v36l-12-8c-12 8-26 4-34-10z" fill="#3d8fe0"/><path d="M8 30c8 14 22 18 34 10l12 8V30z" fill="#2f74c0"/><circle cx="20" cy="27" r="4" fill="#fff"/><circle cx="21" cy="27" r="2" fill="#1d2433"/></svg>',
  cake: '<svg viewBox="0 0 60 60"><rect x="10" y="26" width="40" height="26" rx="6" fill="#ff8fb1"/><rect x="10" y="38" width="40" height="14" rx="6" fill="#f26a95"/><path d="M10 30c4 6 8 6 10 0 4 6 8 6 10 0 4 6 8 6 10 0 4 6 8 6 10 0v-4H10z" fill="#fff"/><rect x="28" y="10" width="4" height="14" rx="2" fill="#7b61ff"/><path d="M30 2c4 4 4 8 0 9-4-1-4-5 0-9z" fill="#ffc93c"/></svg>',
  heart: '<svg viewBox="0 0 40 40"><path d="M20 35S4 25 4 14c0-6 4-10 9-10 3 0 6 2 7 5 1-3 4-5 7-5 5 0 9 4 9 10 0 11-16 21-16 21z" fill="#ff4b6e"/></svg>',
  home: '<svg viewBox="0 0 40 40"><path d="M6 18L20 6l14 12v16H6z" fill="currentColor"/><rect x="16" y="24" width="8" height="10" rx="2" fill="#fff"/></svg>',
  map: '<svg viewBox="0 0 40 40"><path d="M4 10l10-4 12 4 10-4v24l-10 4-12-4-10 4z" fill="currentColor"/><path d="M14 6v24M26 10v24" stroke="#fff" stroke-width="2.5"/></svg>',
  grid: '<svg viewBox="0 0 40 40"><rect x="5" y="5" width="13" height="13" rx="4" fill="currentColor"/><rect x="22" y="5" width="13" height="13" rx="4" fill="currentColor"/><rect x="5" y="22" width="13" height="13" rx="4" fill="currentColor"/><rect x="22" y="22" width="13" height="13" rx="4" fill="currentColor"/></svg>',
  ball: '<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="24" fill="#ff5a6e"/><path d="M6 30a24 24 0 0 0 48 0z" fill="#fff"/><path d="M6 30a24 24 0 0 0 48 0" fill="none" stroke="#e5e8ef" stroke-width="0"/><rect x="6" y="27" width="48" height="6" fill="#2b2b3a"/><circle cx="30" cy="30" r="9" fill="#2b2b3a"/><circle cx="30" cy="30" r="5" fill="#fff"/></svg>',
  star: '<svg viewBox="0 0 40 40"><path d="M20 3l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="#ffc93c"/><path d="M20 3l5 11 12 1-9 8 3 12-11-6z" fill="#ffb300"/></svg>',
  bolt: '<svg viewBox="0 0 40 40"><path d="M23 3L8 23h10l-3 14 17-21H21z" fill="#ffc93c"/></svg>',
};

// Nuvem e arbusto flat para os cenários.
export const cloud = (fill = '#e3f4fb') =>
  `<svg viewBox="0 0 120 60" aria-hidden="true"><path d="M20 56c-11 0-18-7-18-16s7-16 18-16c2-12 12-20 24-20 10 0 18 5 22 13 3-2 7-3 11-3 11 0 20 8 21 19 10 1 18 8 18 17 0 4-2 6-6 6z" fill="${fill}"/></svg>`;

export const bush = () =>
  `<svg viewBox="0 0 140 90" aria-hidden="true"><circle cx="40" cy="56" r="32" fill="#46a83a"/><circle cx="72" cy="42" r="38" fill="#46a83a"/><circle cx="104" cy="58" r="30" fill="#46a83a"/><circle cx="36" cy="52" r="28" fill="#58c14a"/><circle cx="66" cy="36" r="32" fill="#58c14a"/><circle cx="98" cy="54" r="24" fill="#58c14a"/><rect x="8" y="78" width="124" height="12" rx="6" fill="#3b9030"/></svg>`;
