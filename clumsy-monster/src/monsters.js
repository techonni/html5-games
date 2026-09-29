import * as THREE from 'three';

// Monstros modelados com primitivas three.js (sem ficheiros 3D).
// Cada construtor devolve um THREE.Group com ~2 unidades de altura, pés em y = 0,
// e userData.update(t) para animações próprias (piscar, chamas, tentáculos…).

const mats = new Map();
function toy(color, extra = {}) {
  const key = `${color}-${JSON.stringify(extra)}`;
  if (!mats.has(key)) {
    mats.set(
      key,
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.5,
        clearcoat: 0.45,
        clearcoatRoughness: 0.35,
        sheen: 0.12,
        sheenRoughness: 0.8,
        sheenColor: new THREE.Color(0xffffff),
        ...extra,
      }),
    );
  }
  return mats.get(key);
}
const glossyBlack = () => toy(0x1b1414, { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0 });
const white = () => toy(0xfbf7ef, { roughness: 0.35, sheen: 0 });

function mesh(geo, mat, pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.rotation.set(...rot);
  m.castShadow = true;
  return m;
}
const sphere = (r = 1, w = 48, h = 32) => new THREE.SphereGeometry(r, w, h);
const capsule = (r, l) => new THREE.CapsuleGeometry(r, l, 8, 20);
const cone = (r, h) => new THREE.ConeGeometry(r, h, 24);

// Olhos que piscam (escala Y a zero por breves instantes).
function addEyes(group, eyes) {
  group.userData.eyes = eyes;
  group.userData.blinkAt = 1 + Math.random() * 3;
}
function blink(group, t) {
  const eyes = group.userData.eyes;
  if (!eyes) return;
  const d = t - group.userData.blinkAt;
  let s = 1;
  if (d > 0 && d < 0.16) s = Math.max(0.08, Math.abs(d - 0.08) / 0.08);
  if (d >= 0.16) group.userData.blinkAt = t + 2 + Math.random() * 3;
  for (const e of eyes) e.scale.y = e.userData.sy * s;
}
function eye(r, pos) {
  const e = mesh(sphere(r, 24, 16), glossyBlack(), pos, [1, 1.25, 0.6]);
  e.userData.sy = 1.25;
  return e;
}

// Coloca uma peça sobre a superfície de um elipsoide, virada para fora.
function onEllipsoid(obj, center, radii, dir, lift = 0) {
  const d = dir.clone().normalize();
  const p = new THREE.Vector3(d.x * radii.x, d.y * radii.y, d.z * radii.z);
  const n = new THREE.Vector3(p.x / (radii.x * radii.x), p.y / (radii.y * radii.y), p.z / (radii.z * radii.z)).normalize();
  obj.position.copy(center).add(p).addScaledVector(n, lift);
  obj.lookAt(obj.position.clone().add(n));
  return obj;
}

// Números pseudo-aleatórios estáveis (manchas iguais em todas as visitas).
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// ---------------- Duoceratops ----------------
function duoceratops() {
  const g = new THREE.Group();
  const orange = toy(0xe39445);
  const cream = toy(0xf2cf73);
  const brown = toy(0x8c5a3b);
  const center = new THREE.Vector3(0, 1.08, 0);
  const radii = new THREE.Vector3(0.95, 1.05, 0.82);

  const body = mesh(sphere(), orange, center.toArray(), radii.toArray());
  const belly = mesh(sphere(), cream, [0, 0.86, 0.36], [0.72, 0.78, 0.55]);
  g.add(body, belly);

  // Pernas e braços
  for (const s of [-1, 1]) {
    g.add(mesh(capsule(0.24, 0.18), orange, [s * 0.42, 0.25, 0.08]));
    g.add(mesh(capsule(0.19, 0.5), orange, [s * 0.93, 0.92, 0.1], [1, 1, 1], [0.15, 0, s * 0.22]));
    const horn = mesh(cone(0.11, 0.32), brown, [s * 0.5, 1.98, -0.05], [1, 1, 1], [0, 0, -s * 0.45]);
    g.add(horn);
    // Presas brancas a sair da boca
    g.add(mesh(cone(0.055, 0.17), white(), [s * 0.2, 1.46, 0.77], [1, 1, 1], [-0.25, 0, 0]));
  }
  // Boca
  g.add(mesh(capsule(0.022, 0.5), toy(0x4a2a1a, { sheen: 0 }), [0, 1.39, 0.8], [1, 1, 1], [0, 0, Math.PI / 2]));
  // Olhos
  const eyes = [eye(0.065, [-0.27, 1.64, 0.74]), eye(0.065, [0.27, 1.64, 0.74])];
  g.add(...eyes);
  addEyes(g, eyes);

  // Manchas castanhas espalhadas pelo corpo (fora da barriga e da cara)
  const r = rng(7);
  let placed = 0;
  while (placed < 22) {
    const dir = new THREE.Vector3(r() * 2 - 1, r() * 2 - 0.9, r() * 2 - 1);
    const d = dir.clone().normalize();
    if (d.z > 0.35 && Math.abs(d.x) < 0.62 && d.y < 0.75) continue;
    const size = 0.05 + r() * 0.08;
    const spot = mesh(sphere(1, 16, 12), brown, [0, 0, 0], [size, size * (0.8 + r() * 0.4), size * 0.25]);
    onEllipsoid(spot, center, radii, dir, -0.005);
    g.add(spot);
    placed++;
  }
  // Manchas nos braços
  for (const s of [-1, 1]) g.add(mesh(sphere(1, 16, 12), brown, [s * 1.1, 0.95, 0.18], [0.06, 0.07, 0.04]));

  g.userData.update = (t) => blink(g, t);
  return g;
}

// ---------------- Rexy (dinossauro vermelho com dentes) ----------------
function rexy() {
  const g = new THREE.Group();
  const red = toy(0xb4485c);
  const dark = toy(0x7e2638);
  const center = new THREE.Vector3(0, 1.0, 0);
  const radii = new THREE.Vector3(1.0, 0.95, 0.9);
  g.add(mesh(sphere(), red, center.toArray(), radii.toArray()));
  // Boca aberta com dentes
  const mouth = mesh(sphere(1, 32, 16), toy(0x3b0f1a, { sheen: 0 }), [0.1, 0.9, 0.72], [0.62, 0.2, 0.25]);
  g.add(mouth);
  for (let i = 0; i < 6; i++) {
    const x = -0.42 + i * 0.17 + 0.1;
    g.add(mesh(cone(0.06, 0.16), white(), [x, 1.02, 0.86 - Math.abs(x - 0.1) * 0.25], [1, 1, 1], [Math.PI, 0, 0]));
    g.add(mesh(cone(0.05, 0.13), white(), [x + 0.08, 0.78, 0.84 - Math.abs(x - 0.1) * 0.25]));
  }
  // Espinhos nas costas
  for (let i = 0; i < 6; i++) {
    const a = -0.6 + i * 0.28;
    const spike = mesh(cone(0.13, 0.36), dark);
    onEllipsoid(spike, center, radii, new THREE.Vector3(0, Math.cos(a) * 0.9, -Math.sin(a + 0.8)), 0.1);
    spike.rotateX(Math.PI / 2);
    g.add(spike);
  }
  // Olhos zangados
  const eyes = [eye(0.07, [-0.2, 1.42, 0.78]), eye(0.07, [0.34, 1.42, 0.74])];
  g.add(...eyes);
  addEyes(g, eyes);
  g.add(mesh(capsule(0.035, 0.18), dark, [-0.2, 1.56, 0.78], [1, 1, 1], [0, 0, Math.PI / 2 - 0.4]));
  g.add(mesh(capsule(0.035, 0.18), dark, [0.34, 1.56, 0.74], [1, 1, 1], [0, 0, Math.PI / 2 + 0.4]));
  for (const s of [-1, 1]) g.add(mesh(capsule(0.2, 0.15), red, [s * 0.45, 0.2, 0.15]));
  g.userData.update = (t) => blink(g, t);
  return g;
}

// ---------------- Blaze (chama zangada) ----------------
function blaze() {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const r = 0.95 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.02)), 0.7) * Math.pow(1 - t, 0.45) + (t === 1 ? 0 : 0.001);
    pts.push(new THREE.Vector2(Math.max(0.001, r), t * 2.3));
  }
  const geo = new THREE.LatheGeometry(pts, 64);
  const pos = geo.attributes.position;
  const colors = [];
  const cBottom = new THREE.Color(0xfff06a);
  const cMid = new THREE.Color(0xff9a2e);
  const cTop = new THREE.Color(0xd6362b);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 2.3;
    if (y < 0.5) tmp.copy(cBottom).lerp(cMid, y / 0.5);
    else tmp.copy(cMid).lerp(cTop, (y - 0.5) / 0.5);
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const base = pos.array.slice();
  const flame = mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, clearcoat: 0.6, emissive: 0xff6a1a, emissiveIntensity: 0.12 }));
  g.add(flame);
  // Cara zangada
  const eyes = [eye(0.07, [-0.24, 0.95, 0.83]), eye(0.07, [0.24, 0.95, 0.83])];
  g.add(...eyes);
  addEyes(g, eyes);
  const brow = toy(0x2a120c, { sheen: 0 });
  g.add(mesh(capsule(0.035, 0.2), brow, [-0.24, 1.12, 0.82], [1, 1, 1], [0, 0, Math.PI / 2 - 0.45]));
  g.add(mesh(capsule(0.035, 0.2), brow, [0.24, 1.12, 0.82], [1, 1, 1], [0, 0, Math.PI / 2 + 0.45]));
  g.add(mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 24, Math.PI), brow, [0, 0.66, 0.86]));

  g.userData.update = (t) => {
    blink(g, t);
    // Tremula a chama: desloca os vértices consoante a altura
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const bz = base[i * 3 + 2];
      const h = by / 2.3;
      const sway = Math.sin(t * 5 + h * 5) * 0.12 * h * h;
      pos.setXYZ(i, bx * (1 + Math.sin(t * 7 + h * 9) * 0.03) + sway, by * (1 + Math.sin(t * 4) * 0.02), bz);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
  return g;
}

// ---------------- Blubby (fantasma azul) ----------------
function blubby() {
  const g = new THREE.Group();
  // Perfil de baixo para cima: base, lados e cúpula.
  const pts = [new THREE.Vector2(0.001, 0.02), new THREE.Vector2(0.9, 0.02), new THREE.Vector2(0.92, 0.15), new THREE.Vector2(0.8, 0.6)];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * 0.76), 1.25 + Math.sin(a) * 0.78));
  }
  const geo = new THREE.LatheGeometry(pts, 72);
  // Barra ondulada em baixo
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < 0.3) {
      const a = Math.atan2(pos.getX(i), pos.getZ(i));
      pos.setY(i, y + Math.sin(a * 6) * 0.08 * (1 - y / 0.3));
    }
  }
  geo.computeVertexNormals();
  const blue = toy(0x74bdf4);
  g.add(mesh(geo, blue));
  for (const s of [-1, 1]) g.add(mesh(capsule(0.13, 0.25), blue, [s * 0.86, 0.95, 0.1], [1, 1, 1], [0, 0, s * 0.9]));
  const eyes = [eye(0.075, [-0.22, 1.5, 0.66]), eye(0.075, [0.22, 1.5, 0.66])];
  g.add(...eyes);
  addEyes(g, eyes);
  g.add(mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 24, Math.PI), toy(0x1d3550, { sheen: 0 }), [0, 1.3, 0.72], [1, 1, 1], [0, 0, Math.PI]));
  for (const s of [-1, 1]) g.add(mesh(sphere(1, 16, 12), toy(0xf59bb6), [s * 0.4, 1.33, 0.6], [0.09, 0.05, 0.03]));
  g.userData.update = (t) => blink(g, t);
  return g;
}

// ---------------- Squiddo (polvo cor-de-rosa) ----------------
function squiddo() {
  const g = new THREE.Group();
  const pink = toy(0xee88b6);
  const light = toy(0xf7b8d4);
  const head = mesh(sphere(), pink, [0, 1.35, 0], [0.72, 0.78, 0.7]);
  g.add(head);
  const r = rng(3);
  for (let i = 0; i < 7; i++) {
    const s = mesh(sphere(1, 16, 12), light);
    s.scale.set(0.08 + r() * 0.05, 0.08 + r() * 0.05, 0.03);
    onEllipsoid(s, new THREE.Vector3(0, 1.35, 0), new THREE.Vector3(0.72, 0.78, 0.7), new THREE.Vector3(r() * 2 - 1, 0.3 + r(), -r()), -0.003);
    g.add(s);
  }
  const tentacles = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const t = mesh(capsule(0.1, 0.55), pink, [Math.sin(a) * 0.38, 0.45, Math.cos(a) * 0.38]);
    t.userData.a = a;
    tentacles.push(t);
    g.add(t);
  }
  // Um olho grande
  g.add(mesh(sphere(1, 24, 16), white(), [0, 1.38, 0.6], [0.2, 0.22, 0.12]));
  const pupil = eye(0.1, [0, 1.36, 0.7]);
  g.add(pupil);
  addEyes(g, [pupil]);
  g.userData.update = (t) => {
    blink(g, t);
    tentacles.forEach((tt, i) => {
      tt.rotation.x = Math.cos(tt.userData.a) * (0.25 + Math.sin(t * 3 + i) * 0.12);
      tt.rotation.z = -Math.sin(tt.userData.a) * (0.25 + Math.sin(t * 3 + i) * 0.12);
    });
  };
  return g;
}

// ---------------- Spikey (bola verde com espinhos) ----------------
function spikey() {
  const g = new THREE.Group();
  const green = toy(0x6cc14a);
  const dark = toy(0x4d9e33);
  const c = new THREE.Vector3(0, 1.0, 0);
  g.add(mesh(sphere(0.88), green, c.toArray()));
  const ico = new THREE.IcosahedronGeometry(1, 1);
  const p = ico.attributes.position;
  const seen = new Set();
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const key = v.toArray().map((n) => n.toFixed(2)).join();
    if (seen.has(key)) continue;
    seen.add(key);
    if (v.z > 0.55 && v.y < 0.6 && v.y > -0.5) continue; // deixa a cara livre
    const spike = mesh(cone(0.13, 0.32), dark);
    spike.position.copy(c).addScaledVector(v, 0.95);
    spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
    g.add(spike);
  }
  const eyes = [eye(0.07, [-0.24, 1.18, 0.8]), eye(0.07, [0.24, 1.18, 0.8])];
  g.add(...eyes);
  addEyes(g, eyes);
  g.add(mesh(new THREE.TorusGeometry(0.12, 0.024, 8, 24, Math.PI), toy(0x1f3a14, { sheen: 0 }), [0, 0.98, 0.86], [1, 1, 1], [0, 0, Math.PI]));
  g.userData.update = (t) => blink(g, t);
  return g;
}

export const MONSTERS = [
  { id: 'blubby', name: 'Blubby', build: blubby, stats: [62, 141, 96], color: '#bfe2fb' },
  { id: 'duoceratops', name: 'Duoceratops', build: duoceratops, stats: [90, 124, 83], color: '#f3c3cf' },
  { id: 'squiddo', name: 'Squiddo', build: squiddo, stats: [74, 108, 131], color: '#f9cfe2' },
  { id: 'spikey', name: 'Spikey', build: spikey, stats: [118, 66, 71], color: '#cdeebf' },
  { id: 'rexy', name: 'Rexy', build: rexy, stats: [132, 87, 60], color: '#f2c2cb' },
  { id: 'blaze', name: 'Blaze', build: blaze, stats: [105, 119, 77], color: '#fbd9b8' },
];

// Monstro pronto a usar: normalizado para 2 unidades de altura e centrado.
export function createMonster(id) {
  const def = MONSTERS.find((m) => m.id === id);
  const inner = def.build();
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const s = 2 / size.y;
  inner.scale.setScalar(s);
  inner.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, 0);
  // Pivô nos pés para as quedas "desastradas"
  const root = new THREE.Group();
  root.add(inner);
  root.userData = { id, inner, update: inner.userData.update, phase: Math.random() * 6 };
  return root;
}
