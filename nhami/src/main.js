import './style.css';
import { monsterSVG, ICON, cloud, bush } from './art.js';

// ---------------- Dados ----------------
const SPECIES = [
  { id: 'bolota', name: 'Bolota', type: 'Planta', rarity: 0, body: 'blob', extra: 'sprout', eyesY: 108, spread: 30,
    colors: { base: '#7ed957', shade: '#5cb83a', belly: '#d5f5b8', accent: '#58c14a', accentShade: '#3b9030', cheek: '#ff9eb5', feet: '#4fa532' } },
  { id: 'fagulha', name: 'Fagulha', type: 'Fogo', rarity: 1, body: 'flame', extra: 'none', eyesY: 118, spread: 28,
    colors: { base: '#ff8a3d', shade: '#e0662a', belly: '#ffd27a', accent: '#ffd27a', accentShade: '#e0662a', cheek: '#ff5a6e', feet: '#c9521c' } },
  { id: 'gotinha', name: 'Gotinha', type: 'Água', rarity: 0, body: 'drop', extra: 'none', eyesY: 120, spread: 28,
    colors: { base: '#4db6ff', shade: '#2f8fe0', belly: '#c9ebff', accent: '#c9ebff', accentShade: '#2f8fe0', cheek: '#ff9eb5', feet: '#2677c4' } },
  { id: 'pipoca', name: 'Pipoca', type: 'Elétrico', rarity: 0, body: 'puff', extra: 'spark', eyesY: 110, spread: 30,
    colors: { base: '#ffd43b', shade: '#f2b705', belly: '#fff3b0', accent: '#ff9f1c', accentShade: '#e07b00', cheek: '#ff8a5c', feet: '#d99a00' } },
  { id: 'chiclete', name: 'Chiclete', type: 'Normal', rarity: 0, body: 'cat', extra: 'none', eyesY: 112, spread: 30,
    colors: { base: '#ff8fb1', shade: '#f26a95', belly: '#ffd6e3', accent: '#ffd6e3', accentShade: '#f26a95', cheek: '#ff5a86', feet: '#d9537d' } },
  { id: 'rochedo', name: 'Rochedo', type: 'Pedra', rarity: 1, body: 'rock', extra: 'moss', eyesY: 112, spread: 32,
    colors: { base: '#a7b0be', shade: '#838da0', belly: '#d3d8e0', accent: '#6cc14a', accentShade: '#4fa532', cheek: '#ff9eb5', feet: '#6f788a' } },
  { id: 'chifrudo', name: 'Chifrudo', type: 'Terra', rarity: 1, body: 'blob', extra: 'horns', eyesY: 108, spread: 30,
    colors: { base: '#c98a4a', shade: '#a96c33', belly: '#f1d1a6', accent: '#fff6e5', accentShade: '#e0d2bb', cheek: '#ff9e8a', feet: '#8c5626' } },
  { id: 'nebulina', name: 'Nebulina', type: 'Fantasma', rarity: 2, body: 'ghost', extra: 'none', eyesY: 104, spread: 28,
    colors: { base: '#b79cff', shade: '#8f6ff0', belly: '#e6dcff', accent: '#e6dcff', accentShade: '#8f6ff0', cheek: '#ff8fc4', feet: 'transparent' } },
  { id: 'cristalino', name: 'Cristalino', type: 'Cristal', rarity: 3, body: 'crystal', extra: 'shine', eyesY: 110, spread: 26,
    colors: { base: '#5ce1e6', shade: '#2fb8c4', belly: '#c8f7f9', accent: '#c8f7f9', accentShade: '#2fb8c4', cheek: '#ff9eb5', feet: '#239aa6' } },
];
const RARITY = [
  { name: 'Comum', color: '#58c14a', weight: 50, catch: 0.85 },
  { name: 'Incomum', color: '#4da3ff', weight: 30, catch: 0.65 },
  { name: 'Raro', color: '#7b61ff', weight: 15, catch: 0.45 },
  { name: 'Lendário', color: '#ff9f1c', weight: 5, catch: 0.3 },
];
const FOODS = [
  { id: 'apple', name: 'Maçã', price: 5, fill: 15, xp: 8 },
  { id: 'cookie', name: 'Bolacha', price: 10, fill: 25, xp: 15 },
  { id: 'fish', name: 'Peixe', price: 15, fill: 35, xp: 25 },
  { id: 'cake', name: 'Bolo', price: 30, fill: 60, xp: 50 },
];
const STARTERS = ['bolota', 'fagulha', 'gotinha'];
const sp = (id) => SPECIES.find((s) => s.id === id);
const xpNeed = (lvl) => 40 + lvl * 20;
const DECAY_MS = 3 * 60 * 1000; // −1% de barriga a cada 3 minutos

// ---------------- Estado (guardado no browser) ----------------
const KEY = 'nhami.v1';
let S;
try {
  S = JSON.parse(localStorage.getItem(KEY));
} catch {
  S = null;
}
S ??= { coins: 60, food: { apple: 3, cookie: 1, fish: 0, cake: 0 }, team: [], active: null, seen: [] };
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {
    /* ignorar */
  }
};
const activeMon = () => S.team.find((m) => m.uid === S.active);

function decay() {
  const now = Date.now();
  for (const m of S.team) {
    const steps = Math.floor((now - m.t) / DECAY_MS);
    if (steps > 0) {
      m.belly = Math.max(0, m.belly - steps);
      m.t += steps * DECAY_MS;
    }
  }
}

function addMonster(id) {
  const m = { uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), sp: id, level: 1, xp: 0, belly: 60, t: Date.now() };
  S.team.push(m);
  if (!S.seen.includes(id)) S.seen.push(id);
  return m;
}

// ---------------- Utilitários de interface ----------------
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
let screen = 'home';

function toast(html) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = html;
  document.body.append(t);
  setTimeout(() => t.classList.add('out'), 1800);
  setTimeout(() => t.remove(), 2200);
}

function burst(x, y, kind = 'heart', n = 6) {
  for (let i = 0; i < n; i++) {
    const p = document.createElement('div');
    p.className = `particle ${kind}`;
    p.innerHTML = kind === 'heart' ? ICON.heart : kind === 'star' ? ICON.star : '';
    const a = (i / n) * Math.PI - Math.PI;
    const d = 50 + Math.random() * 50;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    document.body.append(p);
    p.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 30}px)) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 60}px)) scale(.8)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.3,1)' },
    ).onfinish = () => p.remove();
  }
}

function confetti() {
  const colors = ['#58c14a', '#4da3ff', '#ffc93c', '#ff5a6e', '#7b61ff', '#ff9f1c'];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = `${Math.random() * 100}vw`;
    c.style.background = colors[i % colors.length];
    document.body.append(c);
    c.animate(
      [{ transform: 'translateY(-20px) rotate(0)' }, { transform: `translate(${(Math.random() - 0.5) * 160}px, 110vh) rotate(${Math.random() * 900}deg)` }],
      { duration: 1600 + Math.random() * 1200, delay: Math.random() * 250, easing: 'cubic-bezier(.3,.6,.6,1)' },
    ).onfinish = () => c.remove();
  }
}

const bar = (value, max, color) => `<div class="bar"><i style="width:${Math.max(4, (value / max) * 100)}%;background:${color}"></i></div>`;
const bellyColor = (b) => (b > 55 ? '#58c14a' : b > 25 ? '#ffb300' : '#ff4b6e');
const moodClass = (m) => (m.belly < 25 ? 'sad' : '');

// ---------------- Ecrãs ----------------
function topTiles() {
  const foodCount = Object.values(S.food).reduce((a, b) => a + b, 0);
  return `<header class="top">
    <button class="tile tile-sq" data-go="shop" aria-label="Loja">${ICON.coin}<b>${S.coins}</b></button>
    <button class="tile tile-sq" data-act="feed" aria-label="Comida">${ICON.basket}<b>${foodCount}</b></button>
    <button class="tile tile-sq" data-go="dex" aria-label="Coleção">${ICON.dex}<b>${S.seen.length}/${SPECIES.length}</b></button>
  </header>`;
}

function nav() {
  const item = (id, icon, label) => `<button class="nav-btn${screen === id ? ' on' : ''}" data-go="${id}">${ICON[icon]}<span>${label}</span></button>`;
  return `<nav class="nav">${item('home', 'home', 'Casa')}${item('explore', 'map', 'Explorar')}${item('dex', 'grid', 'Coleção')}</nav>`;
}

function homeScreen() {
  const m = activeMon();
  const s = sp(m.sp);
  const need = xpNeed(m.level);
  return `${topTiles()}
    <section class="scene home-scene">
      <div class="cloud c1">${cloud()}</div><div class="cloud c2">${cloud()}</div><div class="cloud c3">${cloud()}</div>
      <div class="platform"></div>
      <button class="mon-wrap ${moodClass(m)}" id="mon" aria-label="Fazer festinhas ao ${s.name}">${monsterSVG(s)}</button>
      <div class="bubble" id="bubble" hidden></div>
    </section>
    <section class="info">
      <p class="eyebrow">Nível ${m.level} · ${s.type}</p>
      <h1 class="mon-name">${s.name}</h1>
      <div class="stat"><span>Barriga</span><b>${m.belly}%</b></div>
      ${bar(m.belly, 100, bellyColor(m.belly))}
      <div class="stat"><span>Experiência</span><b>${m.xp}/${need}</b></div>
      ${bar(m.xp, need, '#4da3ff')}
    </section>
    <div class="actions">
      <button class="btn btn-blue" data-act="feed">Alimentar</button>
      <div class="row2">
        <button class="tile tile-wide" data-go="shop">${ICON.basket}<b>Loja</b></button>
        <button class="tile tile-wide" data-act="switch">${ICON.dex}<b>Trocar</b></button>
      </div>
    </div>
    ${nav()}`;
}

let bushState = [0, 0, 0]; // instante a partir do qual o arbusto volta a ter monstros
let wild = null;
function exploreScreen() {
  const now = Date.now();
  return `<header class="head">
      <h1>Explorar</h1>
      <p>Toca num arbusto para procurar monstros selvagens.</p>
    </header>
    <section class="scene explore-scene">
      <div class="sun"></div>
      <div class="cloud c1">${cloud('#ffffff')}</div><div class="cloud c2">${cloud('#ffffff')}</div>
      <div class="hill h1"></div><div class="hill h2"></div><div class="hill h3"></div>
      ${[0, 1, 2]
        .map((i) => `<button class="bush b${i}${bushState[i] > now ? ' empty' : ''}" data-bush="${i}" aria-label="Arbusto ${i + 1}">${bush()}${bushState[i] > now ? '<span class="zzz">zzz</span>' : ''}</button>`)
        .join('')}
      <div class="wild" id="wild" hidden></div>
    </section>
    <div class="catch-panel" id="catch" hidden></div>
    ${nav()}`;
}

function dexScreen() {
  return `<header class="head">
      <h1>Coleção</h1>
      <p><b>${S.seen.length}</b> de ${SPECIES.length} monstros descobertos</p>
      ${bar(S.seen.length, SPECIES.length, '#7b61ff')}
    </header>
    <section class="dex">
      ${SPECIES.map((s) => {
        const owned = S.team.find((m) => m.sp === s.id);
        const r = RARITY[s.rarity];
        return owned
          ? `<button class="tile dex-card${owned.uid === S.active ? ' active' : ''}" data-pick="${owned.uid}">
              ${monsterSVG(s)}
              <b>${s.name}</b>
              <span class="chip" style="background:${r.color}">${r.name}</span>
              <small>Nv. ${owned.level}</small>
            </button>`
          : `<div class="tile dex-card locked">${monsterSVG(s, { silhouette: true })}<b>???</b><span class="chip grey">${r.name}</span></div>`;
      }).join('')}
    </section>
    ${nav()}`;
}

function starterScreen() {
  return `<section class="starter">
      <div class="cloud c1">${cloud()}</div><div class="cloud c2">${cloud()}</div>
      <p class="eyebrow">Bem-vindo ao Nhami</p>
      <h1>Escolhe o teu primeiro monstro</h1>
      <div class="starters">
        ${STARTERS.map((id, i) => `<button class="tile starter-card${i === 0 ? ' on' : ''}" data-starter="${id}">${monsterSVG(sp(id))}<b>${sp(id).name}</b><span>${sp(id).type}</span></button>`).join('')}
      </div>
      <p class="starter-desc" id="starter-desc">${starterDesc('bolota')}</p>
      <button class="btn btn-green" id="starter-go">Escolher Bolota</button>
    </section>`;
}
function starterDesc(id) {
  return {
    bolota: 'Calmo e guloso. Adora maçãs e sestas ao sol.',
    fagulha: 'Cheio de energia. Fica muito rabugento com fome.',
    gotinha: 'Curioso e brincalhão. Nunca diz não a um peixe.',
  }[id];
}

function render() {
  decay();
  if (!S.team.length) screen = 'starter';
  app.dataset.screen = screen;
  app.innerHTML = { home: homeScreen, explore: exploreScreen, dex: dexScreen, starter: starterScreen }[screen]();
  save();
}

// ---------------- Folhas inferiores ----------------
function sheet(title, body) {
  closeSheet();
  const w = document.createElement('div');
  w.className = 'sheet-wrap';
  w.innerHTML = `<div class="sheet"><div class="sheet-head"><h2>${title}</h2><button class="x" aria-label="Fechar">✕</button></div><div class="sheet-body">${body}</div></div>`;
  w.addEventListener('click', (e) => {
    if (e.target === w || e.target.closest('.x')) closeSheet();
  });
  document.body.append(w);
  return w;
}
function closeSheet() {
  document.querySelector('.sheet-wrap')?.remove();
}

function feedSheet() {
  const w = sheet(
    'Alimentar',
    `<div class="foods">${FOODS.map(
      (f) => `<button class="tile food${S.food[f.id] ? '' : ' none'}" data-food="${f.id}">
        <span class="food-ico">${ICON[f.id]}</span><b>${f.name}</b><small>+${f.fill}% barriga</small><span class="count">×${S.food[f.id]}</span>
      </button>`,
    ).join('')}</div>
    <button class="btn btn-yellow" data-sheet-shop>Comprar comida</button>`,
  );
  w.querySelectorAll('[data-food]').forEach((b) => (b.onclick = () => feed(b.dataset.food, b)));
  w.querySelector('[data-sheet-shop]').onclick = shopSheet;
}

function shopSheet() {
  const w = sheet(
    'Loja',
    `<p class="sheet-sub">${ICON.coin}<b>${S.coins}</b> moedas</p>
    <div class="shop">${FOODS.map(
      (f) => `<div class="tile shop-row"><span class="food-ico">${ICON[f.id]}</span>
        <div><b>${f.name}</b><small>+${f.fill}% barriga · +${f.xp} XP</small></div>
        <button class="btn btn-yellow btn-sm" data-buy="${f.id}"${S.coins < f.price ? ' disabled' : ''}>${ICON.coin}${f.price}</button></div>`,
    ).join('')}</div>
    <p class="hint">Ganha moedas a apanhar monstros em Explorar.</p>`,
  );
  w.querySelectorAll('[data-buy]').forEach(
    (b) =>
      (b.onclick = () => {
        const f = FOODS.find((x) => x.id === b.dataset.buy);
        if (S.coins < f.price) return;
        S.coins -= f.price;
        S.food[f.id]++;
        save();
        render();
        shopSheet();
        toast(`${ICON[f.id]} <b>${f.name}</b> comprada!`);
      }),
  );
}

function switchSheet() {
  const w = sheet(
    'Os teus monstros',
    `<div class="team">${S.team
      .map((m) => {
        const s = sp(m.sp);
        return `<button class="tile team-row${m.uid === S.active ? ' on' : ''}" data-pick="${m.uid}">${monsterSVG(s)}<div><b>${s.name}</b><small>Nível ${m.level} · Barriga ${m.belly}%</small></div></button>`;
      })
      .join('')}</div>`,
  );
  w.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => pick(b.dataset.pick)));
}

function pick(uid) {
  S.active = uid;
  closeSheet();
  screen = 'home';
  render();
  const s = sp(activeMon().sp);
  toast(`<b>${s.name}</b> está contigo!`);
}

// ---------------- Alimentar ----------------
let busy = false;
function feed(foodId, fromEl) {
  const m = activeMon();
  const f = FOODS.find((x) => x.id === foodId);
  if (busy || !S.food[foodId]) return;
  if (m.belly >= 100) {
    closeSheet();
    say('Estou cheio!');
    return;
  }
  busy = true;
  S.food[foodId]--;
  const from = fromEl.querySelector('.food-ico').getBoundingClientRect();
  closeSheet();
  const mon = $('#mon');
  const r = mon.getBoundingClientRect();
  const tx = r.left + r.width / 2;
  const ty = r.top + r.height * 0.68;
  const fly = document.createElement('div');
  fly.className = 'fly';
  fly.innerHTML = ICON[foodId];
  fly.style.left = `${from.left + from.width / 2}px`;
  fly.style.top = `${from.top + from.height / 2}px`;
  document.body.append(fly);
  mon.classList.add('eating');
  const dx = tx - (from.left + from.width / 2);
  const dy = ty - (from.top + from.height / 2);
  fly.animate(
    [
      { transform: 'translate(-50%,-50%) scale(1)' },
      { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 120}px)) scale(1.1) rotate(180deg)`, offset: 0.5 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.3) rotate(360deg)` },
    ],
    { duration: 650, easing: 'cubic-bezier(.4,0,.6,1)' },
  ).onfinish = () => {
    fly.remove();
    mon.classList.add('chew');
    burst(tx, r.top + r.height * 0.3, 'heart', 7);
    m.belly = Math.min(100, m.belly + f.fill);
    m.xp += f.xp;
    let leveled = false;
    while (m.xp >= xpNeed(m.level)) {
      m.xp -= xpNeed(m.level);
      m.level++;
      leveled = true;
    }
    setTimeout(() => {
      busy = false;
      render();
      if (leveled) {
        confetti();
        toast(`${ICON.star} <b>${sp(m.sp).name}</b> subiu para o nível ${m.level}!`);
        $('#mon')?.classList.add('jump');
      } else say(['Nham nham!', 'Que bom!', 'Mais! Mais!', 'Delicioso!'][Math.floor(Math.random() * 4)]);
    }, 750);
  };
}

function say(text) {
  const b = $('#bubble');
  if (!b) return;
  b.textContent = text;
  b.hidden = false;
  clearTimeout(say.t);
  say.t = setTimeout(() => (b.hidden = true), 1800);
}

// ---------------- Explorar e apanhar ----------------
function rollSpecies() {
  const total = RARITY.reduce((a, r) => a + r.weight, 0);
  let x = Math.random() * total;
  let rar = 0;
  for (; rar < RARITY.length; rar++) {
    x -= RARITY[rar].weight;
    if (x <= 0) break;
  }
  const pool = SPECIES.filter((s) => s.rarity === Math.min(rar, 3));
  return pool[Math.floor(Math.random() * pool.length)];
}

function searchBush(i, el) {
  if (wild || bushState[i] > Date.now()) return;
  el.classList.add('shake');
  setTimeout(() => {
    el.classList.remove('shake');
    bushState[i] = Date.now() + 20000;
    if (Math.random() < 0.25) {
      el.classList.add('empty');
      toast('Nada aqui… tenta outro arbusto!');
      return;
    }
    const s = rollSpecies();
    wild = { s, bush: i };
    const w = $('#wild');
    w.className = `wild at-${i}`;
    w.innerHTML = monsterSVG(s);
    w.hidden = false;
    const r = RARITY[s.rarity];
    const known = S.seen.includes(s.id);
    const c = $('#catch');
    c.innerHTML = `<p class="eyebrow" style="color:${r.color}">${r.name}${known ? '' : ' · Novo!'}</p>
      <h2>Um ${s.name} selvagem!</h2>
      <p class="sub">${s.type} · Probabilidade de apanhar ${Math.round(r.catch * 100)}%</p>
      <div class="row2"><button class="btn btn-grey" id="flee">Deixar ir</button><button class="btn btn-red" id="throw">${ICON.ball}Apanhar</button></div>`;
    c.hidden = false;
    $('#flee').onclick = () => endWild();
    $('#throw').onclick = throwBall;
  }, 500);
}

function endWild() {
  wild = null;
  render();
}

function throwBall() {
  const { s } = wild;
  $('#catch').hidden = true;
  const w = $('#wild');
  const r = w.getBoundingClientRect();
  const ball = document.createElement('div');
  ball.className = 'ball';
  ball.innerHTML = ICON.ball;
  const sx = window.innerWidth / 2;
  const sy = window.innerHeight - 90;
  ball.style.left = `${sx}px`;
  ball.style.top = `${sy}px`;
  document.body.append(ball);
  const tx = r.left + r.width / 2 - sx;
  const ty = r.top + r.height * 0.6 - sy;
  ball.animate(
    [
      { transform: 'translate(-50%,-50%) scale(1.2)' },
      { transform: `translate(calc(-50% + ${tx / 2}px), calc(-50% + ${ty / 2 - 160}px)) rotate(360deg)`, offset: 0.55 },
      { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotate(720deg) scale(.8)` },
    ],
    { duration: 700, easing: 'cubic-bezier(.3,0,.7,1)', fill: 'forwards' },
  ).onfinish = () => {
    w.classList.add('sucked');
    const ok = Math.random() < RARITY[s.rarity].catch;
    ball.animate(
      [
        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(.8) rotate(0)` },
        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty + 50}px)) scale(.8) rotate(-18deg)`, offset: 0.25 },
        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty + 50}px)) scale(.8) rotate(18deg)`, offset: 0.5 },
        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty + 50}px)) scale(.8) rotate(-18deg)`, offset: 0.75 },
        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty + 50}px)) scale(.8) rotate(0)` },
      ],
      { duration: 1400, fill: 'forwards' },
    ).onfinish = () => {
      if (ok) {
        const dup = S.seen.includes(s.id);
        const coins = dup ? 30 : 20;
        S.coins += coins;
        addMonster(s.id);
        save();
        confetti();
        burst(r.left + r.width / 2, r.top + r.height / 2, 'star', 8);
        toast(`${ICON.star} Apanhaste um <b>${s.name}</b>! +${coins} ${ICON.coin}`);
        ball.remove();
        endWild();
      } else {
        ball.remove();
        w.classList.remove('sucked');
        w.classList.add('run');
        toast(`O ${s.name} fugiu!`);
        setTimeout(endWild, 700);
      }
    };
  };
}

// ---------------- Eventos (delegação) ----------------
app.addEventListener('click', (e) => {
  const t = e.target.closest('button, [data-go]');
  if (!t) return;
  if (t.dataset.go) {
    if (t.dataset.go === 'shop') return shopSheet();
    screen = t.dataset.go;
    wild = null;
    return render();
  }
  if (t.dataset.act === 'feed') return screen === 'home' ? feedSheet() : ((screen = 'home'), render(), feedSheet());
  if (t.dataset.act === 'switch') return switchSheet();
  if (t.dataset.pick) return pick(t.dataset.pick);
  if (t.dataset.bush) return searchBush(Number(t.dataset.bush), t);
  if (t.id === 'mon') {
    t.classList.remove('jump');
    void t.offsetWidth;
    t.classList.add('jump');
    const r = t.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height * 0.25, 'heart', 4);
    const m = activeMon();
    say(m.belly < 25 ? 'Tenho fome…' : m.belly > 90 ? 'Estou tão cheio!' : ['Olá!', 'Hehe!', 'Brincamos?', 'Gosto de ti!'][Math.floor(Math.random() * 4)]);
    return;
  }
  if (t.dataset.starter) {
    app.querySelectorAll('.starter-card').forEach((c) => c.classList.toggle('on', c === t));
    $('#starter-desc').textContent = starterDesc(t.dataset.starter);
    $('#starter-go').textContent = `Escolher ${sp(t.dataset.starter).name}`;
    $('#starter-go').dataset.id = t.dataset.starter;
    return;
  }
  if (t.id === 'starter-go') {
    const m = addMonster(t.dataset.id || 'bolota');
    S.active = m.uid;
    screen = 'home';
    render();
    confetti();
    toast(`<b>${sp(m.sp).name}</b> é o teu primeiro monstro!`);
  }
});

setInterval(() => {
  if (screen === 'home' && !busy && !document.querySelector('.sheet-wrap')) render();
}, 60000);

render();
