import './style.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MONSTERS, createMonster } from './monsters.js';

const $ = (s) => document.querySelector(s);
const desktop = window.matchMedia('(min-width: 760px)');

// ---------- Estado ----------
let chosen = 'duoceratops';
try {
  chosen = localStorage.getItem('clumsy.monster') || chosen;
} catch {
  /* sem armazenamento */
}
let browse = Math.max(0, MONSTERS.findIndex((m) => m.id === chosen));

// ---------- Renderer único, desenhado por zonas (scissor) ----------
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);
const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

// Sombra de contacto suave (textura radial) debaixo de cada monstro.
const blobTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(90,40,70,0.38)');
  grd.addColorStop(1, 'rgba(90,40,70,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();

function makeScene() {
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight(0xfff4ec, 1.6);
  key.position.set(2.5, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.radius = 6;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2, near: 1, far: 15 });
  scene.add(key, new THREE.HemisphereLight(0xfff0f6, 0xc9a6d6, 0.6));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.12 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  return scene;
}

function withShadow(monster, size = 1.9) {
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 0.6), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.005;
  monster.add(blob);
  return monster;
}

// Uma "vista" liga um elemento HTML a uma cena e câmara.
function makeView(el, camPos, target, fov = 30) {
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(...camPos);
  camera.lookAt(...target);
  return { el, scene: makeScene(), camera, monsters: [] };
}

// ---------- Ecrã 1: trio de monstros ----------
const welcome = makeView($('#view-welcome'), [0, 1.45, 9.2], [0, 0.8, 0]);
const SIDES = { left: { id: 'rexy', pos: [-1.45, 0, -0.9], rot: 0.5, scale: 0.9 }, right: { id: 'blaze', pos: [1.4, 0, -0.35], rot: -0.35, scale: 0.84 } };

function placeWelcome() {
  for (const m of welcome.monsters) welcome.scene.remove(m);
  welcome.monsters = [];
  // Os laterais nunca repetem o monstro escolhido.
  const pool = ['rexy', 'blaze', 'spikey', 'blubby', 'squiddo'].filter((id) => id !== chosen);
  const left = SIDES.left.id === chosen ? pool[0] : SIDES.left.id;
  let right = SIDES.right.id === chosen ? null : SIDES.right.id;
  if (!right || right === left) right = pool.find((id) => id !== left);
  const layout = [
    [left, SIDES.left],
    [right, SIDES.right],
    [chosen, { pos: [0, 0, 0.35], rot: 0, scale: 1.12 }],
  ];
  for (const [id, cfg] of layout) {
    const m = withShadow(createMonster(id));
    m.position.set(...cfg.pos);
    m.rotation.y = cfg.rot;
    m.userData.baseRot = cfg.rot;
    m.userData.k = cfg.scale;
    welcome.scene.add(m);
    welcome.monsters.push(m);
  }
}
placeWelcome();

// ---------- Ecrã 2: monstro em destaque ----------
const hero = makeView($('#view-hero'), [0, 1.25, 7.4], [0, 1.02, 0], 30);
hero.scene.children.find((c) => c.isMesh).visible = false; // o halo cor-de-rosa faz de fundo
const heroCache = new Map();
function showHero(id, pop = true) {
  for (const m of hero.monsters) hero.scene.remove(m);
  let m = heroCache.get(id);
  if (!m) {
    m = createMonster(id);
    m.userData.k = 1;
    m.userData.baseRot = 0;
    heroCache.set(id, m);
  }
  m.rotation.set(0, 0, 0);
  m.userData.pop = pop ? performance.now() : 0;
  hero.scene.add(m);
  hero.monsters = [m];
}

// ---------- Animações ----------
const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const easeInQuad = (t) => t * t;

function animateMonster(m, t, now) {
  const u = m.userData;
  u.update?.(t);
  const b = Math.sin(t * 2.2 + u.phase) * 0.018;
  let k = u.k ?? 1;
  if (u.pop) {
    const p = Math.min(1, (now - u.pop) / 450);
    k *= Math.max(0.001, easeOutBack(p));
    if (p >= 1) u.pop = 0;
  }
  m.scale.set(k * (1 - b * 0.6), k * (1 + b), k * (1 - b * 0.6));

  // Salto de alegria
  let y = 0;
  if (u.jump) {
    const p = (now - u.jump) / 700;
    if (p >= 1) u.jump = 0;
    else y = Math.sin(p * Math.PI) * 0.9;
  }
  m.position.y = y;

  // Queda desastrada: tomba, ressalta, fica deitado e levanta-se.
  if (u.fall) {
    const e = (now - u.fall.t0) / 1000;
    const dir = u.fall.dir;
    let rz = 0;
    if (e < 0.4) rz = easeInQuad(e / 0.4) * 1.45;
    else if (e < 0.65) rz = 1.45 - Math.sin(((e - 0.4) / 0.25) * Math.PI) * 0.14;
    else if (e < 1.35) rz = 1.45;
    else if (e < 2) rz = 1.45 * (1 - easeOutBack((e - 1.35) / 0.65));
    else u.fall = null;
    m.rotation.z = dir * rz;
  }
  // Rotação volta devagar ao ângulo original nas vistas do trio
  if (!u.dragging && u.spring) m.rotation.y += (u.baseRot - m.rotation.y) * 0.06;
}

// ---------- Interação: arrastar para rodar, tocar para tropeçar ----------
const ray = new THREE.Raycaster();
function pick(view, e) {
  const r = view.el.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, view.camera);
  const hits = ray.intersectObjects(view.monsters, true);
  if (!hits.length) return null;
  let o = hits[0].object;
  while (o && !view.monsters.includes(o)) o = o.parent;
  return o;
}

function stumble(m) {
  if (!m || m.userData.fall) return;
  m.userData.fall = { t0: performance.now(), dir: Math.random() < 0.5 ? -1 : 1 };
  navigator.vibrate?.(30);
}

function bindInteraction(view, { always = false, spring = false } = {}) {
  let drag = null;
  view.el.addEventListener('pointerdown', (e) => {
    const m = always ? view.monsters[0] : pick(view, e);
    if (!m) return;
    view.el.setPointerCapture(e.pointerId);
    m.userData.dragging = true;
    m.userData.spring = spring;
    drag = { m, x: e.clientX, y: e.clientY, moved: false, rot: m.rotation.y };
  });
  view.el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6) drag.moved = true;
    if (drag.moved) drag.m.rotation.y = drag.rot + dx * 0.012;
  });
  const end = (e) => {
    if (!drag) return;
    drag.m.userData.dragging = false;
    if (!drag.moved && (always ? pick(view, e) : true)) stumble(drag.m);
    drag = null;
  };
  view.el.addEventListener('pointerup', end);
  view.el.addEventListener('pointercancel', end);
}
bindInteraction(welcome, { spring: true });
bindInteraction(hero, { always: true });

// ---------- Ciclo de desenho ----------
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function frame() {
  const t = clock.getElapsedTime();
  const now = performance.now();
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);
  const H = window.innerHeight;
  for (const view of [welcome, hero]) {
    const r = view.el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.right < 0 || r.left > window.innerWidth) continue;
    const opacity = parseFloat(getComputedStyle(view.el.closest('.card')).opacity);
    if (opacity < 0.05) continue;
    for (const m of view.monsters) animateMonster(m, t, now);
    renderer.setViewport(r.left, H - r.bottom, r.width, r.height);
    renderer.setScissor(r.left, H - r.bottom, r.width, r.height);
    view.camera.aspect = r.width / r.height;
    view.camera.updateProjectionMatrix();
    renderer.render(view.scene, view.camera);
  }
  requestAnimationFrame(frame);
}

// ---------- Miniaturas do carrossel (renderizadas uma vez) ----------
function renderThumbs() {
  const size = 200;
  const off = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  off.setSize(size, size);
  off.toneMapping = THREE.NeutralToneMapping;
  off.toneMappingExposure = 0.95;
  off.setClearColor(0x000000, 0);
  const offEnv = new THREE.PMREMGenerator(off).fromScene(new RoomEnvironment(), 0.04).texture;
  const scene = new THREE.Scene();
  scene.environment = offEnv;
  scene.environmentIntensity = 0.55;
  const light = new THREE.DirectionalLight(0xfff4ec, 1.5);
  light.position.set(2.5, 5, 4);
  scene.add(light, new THREE.HemisphereLight(0xfff0f6, 0xc9a6d6, 0.6));
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0, 1.2, 5.4);
  cam.lookAt(0, 1, 0);
  const urls = {};
  for (const def of MONSTERS) {
    const m = createMonster(def.id);
    m.rotation.y = -0.25;
    scene.add(m);
    m.userData.update?.(0.5);
    off.render(scene, cam);
    urls[def.id] = off.domElement.toDataURL('image/png');
    scene.remove(m);
  }
  off.dispose();
  off.forceContextLoss();
  return urls;
}

// ---------- Interface do ecrã de escolha ----------
const thumbsEl = $('#thumbs');
let thumbUrls = {};
function buildCarousel() {
  thumbsEl.replaceChildren(
    ...MONSTERS.map((def, i) => {
      const b = document.createElement('button');
      b.className = 'thumb';
      b.setAttribute('aria-label', def.name);
      b.innerHTML = `<img alt="" src="${thumbUrls[def.id]}">`;
      b.onclick = () => select(i);
      return b;
    }),
  );
}

function centerThumb(smooth) {
  const b = thumbsEl.children[browse];
  if (!b) return;
  // Espera pela transição de tamanho da miniatura antes de centrar.
  setTimeout(() => {
    const br = b.getBoundingClientRect();
    const tr = thumbsEl.getBoundingClientRect();
    const left = thumbsEl.scrollLeft + br.left + br.width / 2 - (tr.left + tr.width / 2);
    thumbsEl.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
  }, smooth ? 320 : 0);
}

function countUp(el, to) {
  const from = parseInt(el.textContent, 10) || 0;
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / 450);
    el.textContent = Math.round(from + (to - from) * (1 - (1 - p) ** 3));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function select(i, { scroll = true, pop = true } = {}) {
  browse = (i + MONSTERS.length) % MONSTERS.length;
  const def = MONSTERS[browse];
  $('#m-name').textContent = def.name;
  def.stats.forEach((v, k) => countUp($(`#s-${k}`), v));
  $('#halo').style.background = def.color;
  [...thumbsEl.children].forEach((b, k) => b.classList.toggle('on', k === browse));
  if (scroll) centerThumb(true);
  showHero(def.id, pop);
}

$('#prev').onclick = () => select(browse - 1);
$('#next').onclick = () => select(browse + 1);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  t.style.animation = 'none';
  void t.offsetWidth;
  t.style.animation = '';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2200);
}

function confetti() {
  const box = $('#confetti');
  const colors = ['#ea5670', '#f4d98f', '#74bdf4', '#6cc14a', '#ee88b6', '#eaa75e'];
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 200}px`);
    c.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    c.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    c.style.animationDelay = `${Math.random() * 0.3}s`;
    box.append(c);
    setTimeout(() => c.remove(), 3500);
  }
}

$('#choose-btn').onclick = () => {
  const def = MONSTERS[browse];
  chosen = def.id;
  try {
    localStorage.setItem('clumsy.monster', chosen);
  } catch {
    /* ignorar */
  }
  placeWelcome();
  hero.monsters[0].userData.jump = performance.now();
  confetti();
  toast(`${def.name} is your monster!`);
  if (!desktop.matches) setTimeout(() => history.back(), 900);
};

// ---------- Navegação (telemóvel: um ecrã de cada vez) ----------
function route() {
  document.body.classList.toggle('at-choose', location.hash === '#choose');
}
window.addEventListener('hashchange', route);
$('#explore').onclick = () => {
  if (desktop.matches) {
    hero.monsters[0].userData.jump = performance.now();
    return;
  }
  location.hash = 'choose';
};
route();

// ---------- Arranque ----------
(async () => {
  try {
    await document.fonts?.ready;
  } catch {
    /* ignorar */
  }
  thumbUrls = renderThumbs();
  buildCarousel();
  select(browse, { scroll: false, pop: false });
  requestAnimationFrame(() => centerThumb(false));
  frame();
})();
