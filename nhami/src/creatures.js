// Monstros originais em estilo "silhueta de tinta": preto quase puro, uma cor
// secundária azul-noite, olhos brancos em fenda e sombra cinzenta no chão.
// Cada monstro é feito de polígonos pretos sobrepostos (que se fundem numa só
// silhueta). As peças têm uma fase mínima: a fase 1 é o bebé, a 3 o adulto.

const INK = '#101014';
const NAVY = '#3d3d5e';
const GHOST = '#d9dde5';

// Olho em fenda: forma branca afiada + pupila. `flip` espelha na horizontal.
function eye([x, y], s, rot = 0, style = 'angry', flip = false) {
  const shapes = {
    angry: `M${-s} ${-s * 0.05}Q0 ${-s * 0.95} ${s} ${-s * 0.6}Q${s * 0.35} ${s * 0.75} ${-s} ${-s * 0.05}Z`,
    wide: `M${-s} 0Q${-s} ${-s * 0.85} 0 ${-s * 0.85}Q${s} ${-s * 0.85} ${s} 0Q${s} ${s * 0.85} 0 ${s * 0.85}Q${-s} ${s * 0.85} ${-s} 0Z`,
    sleepy: `M${-s} 0L${s} ${-s * 0.1}Q${s * 0.2} ${s * 0.8} ${-s} 0Z`,
    smug: `M${-s} ${s * 0.1}Q0 ${-s * 0.7} ${s} ${-s * 0.2}Q${s * 0.2} ${s * 0.5} ${-s} ${s * 0.1}Z`,
  };
  const pupil = { angry: [s * 0.25, -s * 0.28, s * 0.3], wide: [s * 0.2, s * 0.05, s * 0.34], sleepy: [s * 0.1, s * 0.18, s * 0.26], smug: [s * 0.35, -s * 0.05, s * 0.26] }[style];
  return `<g transform="translate(${x} ${y})"><g transform="rotate(${rot}) scale(${flip ? -1 : 1} 1)"><g class="eye">
    <path d="${shapes[style]}" fill="#fff"/><circle cx="${pupil[0]}" cy="${pupil[1]}" r="${pupil[2]}" fill="${INK}"/></g></g></g>`;
}
const poly = (pts) => pts.map((p) => p.join(',')).join(' ');
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function smoothPath(pts) {
  const n = pts.length;
  let d = `M${mid(pts[n - 1], pts[0]).join(' ')}`;
  for (let i = 0; i < n; i++) d += `Q${pts[i].join(' ')} ${mid(pts[i], pts[(i + 1) % n]).join(' ')}`;
  return `${d}Z`;
}
const teeth = (list) => list.map((t) => `<polygon points="${poly(t)}" fill="#fff"/>`).join('');

export const SPECIES = [
  {
    id: 'birra', num: 1, name: 'Birra', type: 'Fogo', role: 'Lutador', rarity: 0,
    lore: 'Birra faz uma cena por tudo e por nada. Bate o pé quando tem fome, bate o pé quando está cheio e bate o pé só para ver se alguém está a olhar. Os mais velhos aprendem a transformar a birra em força, mas nunca deixam de a fazer.',
    stages: ['Cabe na palma da mão. Morde tornozelos.', 'Já sabe fechar os punhos. Usa-os.', 'Espinhos nas costas, pavio muito curto.'],
    ink: [
      [1, [[60, 178], [70, 140], [66, 112], [84, 86], [112, 78], [134, 88], [142, 112], [132, 140], [150, 178]], 'smooth'],
      [1, [[84, 86], [96, 56], [126, 50], [158, 62], [168, 74], [142, 80], [162, 92], [138, 98], [112, 98]]],
      [1, [[60, 176], [44, 184], [90, 184], [86, 170]]],
      [1, [[128, 170], [148, 184], [172, 184], [150, 166]]],
      [2, [[104, 58], [90, 18], [118, 54]]],
      [2, [[124, 52], [132, 22], [138, 56]]],
      [2, [[130, 108], [166, 102], [184, 88], [178, 106], [192, 104], [174, 122], [134, 130]]],
      [2, [[138, 158], [176, 150], [196, 126], [188, 154], [150, 176]]],
    ],
    navy: [
      [2, [[72, 118], [40, 108], [28, 92], [34, 112], [22, 114], [46, 130], [74, 136]]],
      [3, [[68, 110], [34, 90], [64, 102]]],
      [3, [[62, 128], [26, 122], [60, 138]]],
      [3, [[66, 148], [32, 152], [64, 160]]],
      [3, [[176, 106], [198, 98], [182, 116]]],
    ],
    eyes: [[[128, 68], 16, -12, 'angry'], [[148, 72], 11, -12, 'angry']],
    teeth: [[[144, 82], [148, 90], [152, 84]], [[152, 86], [156, 94], [160, 88]]],
  },
  {
    id: 'medo', num: 2, name: 'Medo', type: 'Sombra', role: 'Furtivo', rarity: 0,
    lore: 'Medo esconde-se atrás de qualquer coisa, incluindo de si próprio. As orelhas enormes ouvem perigos que ainda não existem. Quando finalmente se sente seguro, é o companheiro mais leal que alguma vez vais ter.',
    stages: ['Treme até com o próprio eco.', 'Aprendeu a tapar os olhos. Continua a espreitar.', 'Veste-se de sombras. Ainda pede colo.'],
    ink: [
      [1, [[56, 180], [60, 140], [80, 110], [110, 100], [140, 112], [152, 146], [150, 180]], 'smooth'],
      [1, [[106, 104], [98, 80], [112, 62], [138, 60], [154, 78], [148, 100]], 'smooth'],
      [1, [[114, 66], [100, 28], [126, 62]]],
      [1, [[134, 64], [156, 30], [146, 70]]],
      [2, [[100, 30], [94, 6], [110, 36]]],
      [2, [[154, 32], [170, 10], [158, 40]]],
    ],
    navy: [
      [2, [[92, 132], [118, 118], [128, 130], [116, 138], [126, 148], [104, 150], [90, 142]], 'front'],
      [3, [[58, 168], [22, 150], [10, 118], [34, 144], [54, 150]]],
      [3, [[62, 140], [34, 126], [58, 128]]],
      [3, [[72, 118], [50, 96], [80, 110]]],
    ],
    eyes: [[[124, 84], 16, 0, 'wide'], [[142, 84], 13, 0, 'wide']],
    teeth: [],
  },
  {
    id: 'preguica', num: 3, name: 'Preguiça', type: 'Terra', role: 'Tanque', rarity: 0,
    lore: 'Preguiça já esteve acordado uma vez e não gostou. Passa os dias deitado a deixar crescer musgo nas costas. Dizem que um Preguiça totalmente evoluído é tão pesado que as montanhas se desviam dele.',
    stages: ['Dorme 23 horas por dia. A outra hora é sesta.', 'Descobriu que rolar é mais fácil do que andar.', 'Uma colina com opiniões muito firmes sobre sofás.'],
    ink: [
      [1, [[30, 180], [40, 140], [70, 112], [110, 104], [150, 114], [172, 144], [176, 180]], 'smooth'],
      [1, [[140, 152], [160, 130], [186, 132], [198, 156], [192, 178], [150, 180]], 'smooth'],
      [2, [[42, 158], [20, 172], [12, 184], [62, 184], [68, 168]]],
      [2, [[98, 108], [94, 86], [112, 104]]],
    ],
    navy: [
      [3, [[68, 114], [80, 90], [104, 106]]],
      [3, [[102, 106], [122, 84], [142, 110]]],
      [3, [[140, 112], [162, 96], [164, 128]]],
      [3, [[48, 136], [54, 116], [74, 126]]],
    ],
    eyes: [[[168, 150], 14, 4, 'sleepy'], [[186, 152], 11, 4, 'sleepy']],
    teeth: [[[178, 166], [182, 172], [186, 166]]],
  },
  {
    id: 'teimosia', num: 4, name: 'Teimosia', type: 'Pedra', role: 'Tanque', rarity: 1,
    lore: 'Teimosia escolhe uma direção e não muda de ideias, nem quando há uma parede à frente. Os cornos crescem a cada discussão que ganha, o que acontece muito mais vezes do que devia.',
    stages: ['Marra contra portas fechadas. E abertas.', 'Cornos novos, argumentos nenhuns.', 'Coberto de placas. Continua a ter razão.'],
    ink: [
      [1, [[40, 150], [50, 110], [100, 96], [150, 104], [166, 130], [156, 150]], 'smooth'],
      [1, [[48, 144], [46, 180], [62, 180], [66, 144]]],
      [1, [[72, 146], [72, 180], [86, 180], [88, 146]]],
      [1, [[126, 146], [128, 180], [142, 180], [142, 144]]],
      [1, [[146, 138], [154, 180], [168, 180], [160, 136]]],
      [1, [[148, 104], [178, 110], [194, 136], [184, 156], [166, 150], [154, 128]]],
      [1, [[42, 122], [20, 110], [30, 130]]],
    ],
    navy: [
      [2, [[156, 110], [150, 86], [168, 74], [188, 84], [188, 104], [176, 102], [174, 90], [164, 92], [168, 110]], 'front'],
      [3, [[58, 110], [70, 84], [86, 102]]],
      [3, [[84, 102], [98, 78], [112, 98]]],
      [3, [[110, 98], [126, 76], [138, 102]]],
    ],
    eyes: [[[178, 126], 13, 22, 'angry']],
    teeth: [],
  },
  {
    id: 'inveja', num: 5, name: 'Inveja', type: 'Veneno', role: 'Astuto', rarity: 2,
    lore: 'Inveja quer sempre o lanche dos outros, mesmo quando o seu é maior. Move-se sem fazer barulho e, quando cresce, ganha um terceiro olho só para vigiar o que os vizinhos estão a comer.',
    stages: ['Rouba migalhas. Nega tudo.', 'A cauda serve para apontar para o que é dos outros.', 'Três olhos, zero satisfação.'],
    ink: [
      [1, [[40, 160], [60, 130], [110, 122], [150, 130], [160, 152], [130, 162], [70, 164]], 'smooth'],
      [1, [[60, 156], [50, 182], [66, 182], [74, 160]]],
      [1, [[134, 152], [150, 182], [166, 182], [148, 148]]],
      [1, [[140, 134], [150, 98], [170, 84], [194, 90], [182, 100], [188, 108], [164, 112], [156, 138]]],
      [1, [[158, 90], [156, 64], [172, 86]]],
      [2, [[44, 154], [18, 138], [12, 108], [26, 84], [42, 92], [28, 110], [34, 134], [58, 146]], 'smooth'],
    ],
    navy: [
      [2, [[70, 130], [80, 110], [92, 128]]],
      [3, [[94, 126], [106, 104], [118, 126]]],
      [3, [[118, 128], [130, 108], [140, 130]]],
      [3, [[26, 84], [18, 66], [36, 86]]],
    ],
    eyes: [[[172, 96], 11, -8, 'smug'], [[184, 99], 8, -8, 'smug'], [[164, 86], 6, -20, 'smug', false, 3]],
    teeth: [[[182, 104], [186, 110], [188, 104]]],
  },
  {
    id: 'vaidade', num: 6, name: 'Vaidade', type: 'Ar', role: 'Veloz', rarity: 3,
    lore: 'Vaidade passa horas a arranjar a crista e só aceita comida servida com elegância. É raríssimo vê-lo no mato: sujaria as penas. Quem apanha um Vaidade nunca mais tem paz com o espelho da casa de banho.',
    stages: ['Uma bola de penugem com muita autoestima.', 'A crista chegou. O ego também.', 'Asas de gala. Só voa se alguém estiver a ver.'],
    ink: [
      [1, [[96, 182], [100, 142], [106, 142], [104, 182]]],
      [1, [[112, 182], [114, 142], [120, 142], [120, 182]]],
      [1, [[88, 182], [124, 182], [124, 178], [88, 178]]],
      [1, [[70, 150], [80, 120], [110, 108], [140, 118], [150, 140], [130, 156], [100, 160]], 'smooth'],
      [1, [[120, 114], [126, 72], [136, 52], [152, 46], [176, 54], [156, 60], [150, 72], [142, 118]]],
      [1, [[168, 50], [198, 58], [168, 60]]],
    ],
    navy: [
      [1, [[72, 150], [32, 160], [10, 150], [40, 142], [22, 130], [66, 134]]],
      [2, [[136, 52], [124, 18], [142, 40], [148, 10], [152, 42], [168, 20], [158, 48]]],
      [3, [[96, 118], [58, 86], [36, 92], [68, 110], [48, 118], [90, 136]], 'front'],
    ],
    eyes: [[[152, 54], 11, -10, 'smug']],
    teeth: [],
  },
];

export const TYPE_COLOR = { Fogo: '#ff5a4e', Sombra: '#7b61ff', Terra: '#d99a00', Pedra: '#8a93a3', Veneno: '#4caf3f', Ar: '#4da3ff' };
export const stageOf = (level) => (level >= 10 ? 3 : level >= 5 ? 2 : 1);
const STAGE_SCALE = { 1: 0.74, 2: 0.88, 3: 1 };

// SVG de um monstro numa fase. `silhouette` desenha tudo em cinzento (por descobrir).
export function creatureSVG(s, { stage = 1, silhouette = false, shadow = true } = {}) {
  const ink = silhouette ? GHOST : INK;
  const navy = silhouette ? GHOST : NAVY;
  const parts = (list, fill) =>
    list
      .filter(([min]) => stage >= min)
      .map(([, pts, flags = '']) =>
        flags.includes('smooth')
          ? `<path d="${smoothPath(pts)}" fill="${fill}"/>`
          : `<polygon points="${poly(pts)}" fill="${fill}" stroke="${fill}" stroke-width="3" stroke-linejoin="round"/>`,
      )
      .join('');
  const k = STAGE_SCALE[stage];
  const eyes = silhouette ? '' : s.eyes.filter((e) => stage >= (e[5] ?? 1)).map((e) => eye(e[0], e[1], e[2], e[3], e[4])).join('');
  return `<svg class="monster" viewBox="0 0 200 200" aria-hidden="true">
    ${shadow ? `<ellipse cx="104" cy="184" rx="${76 * k}" ry="${8 * k + 2}" fill="#e6e8ee"/>` : ''}
    <g class="mon-body"><g transform="translate(${104 * (1 - k)} ${184 * (1 - k)}) scale(${k})">
      ${parts(s.navy.filter((n) => !(n[2] ?? '').includes('front')), navy)}
      ${parts(s.ink, ink)}
      ${parts(s.navy.filter((n) => (n[2] ?? '').includes('front')), navy)}
      ${silhouette ? '' : teeth(s.teeth)}
      ${eyes}
    </g></g>
  </svg>`;
}
