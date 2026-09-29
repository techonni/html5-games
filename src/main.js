import './style.css';
import { games, byId, thumbSvg } from './games/index.js';
import { wallet } from './core/wallet.js';
import { money, mult } from './core/format.js';
import { createStage } from './core/stage.js';
import { h, toast } from './core/ui.js';

const view = document.getElementById('view');
const balanceEl = document.getElementById('balance');
const sidebar = document.getElementById('sidebar');
const scrim = document.getElementById('scrim');

// ---------- Carteira ----------
let lastBalance = wallet.balance;
function renderBalance() {
  balanceEl.textContent = money(wallet.balance);
  if (wallet.balance > lastBalance) {
    balanceEl.parentElement.classList.remove('flash');
    void balanceEl.offsetWidth;
    balanceEl.parentElement.classList.add('flash');
  }
  lastBalance = wallet.balance;
}
wallet.addEventListener('change', renderBalance);
renderBalance();
document.getElementById('refill-btn').addEventListener('click', () => {
  wallet.refill();
  toast('Créditos demo repostos: 1 000,00', 'win');
});

// ---------- Menu lateral ----------
const icon = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const nav = document.getElementById('side-nav');
nav.innerHTML = `
  <a href="#/" data-route="lobby">${icon('<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>')}<span>Lobby</span></a>
  <div class="side-title">Originais</div>
  ${games
    .map(
      (g) => `<a href="#/game/${g.id}" data-route="${g.id}"><span class="side-dot" style="background:linear-gradient(135deg,${g.art.bg[0]},${g.art.bg[1]})"></span><span>${g.name}</span></a>`,
    )
    .join('')}
  <div class="side-title">Trading</div>
  <a href="./binary-options/">${icon('<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>')}<span>Pixelune Trader</span></a>
  <div class="side-title">Conta</div>
  <a href="#/historico" data-route="historico">${icon('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>')}<span>Histórico</span></a>
  <a href="#/responsavel" data-route="responsavel">${icon('<path d="M12 21s-7-4.4-9.3-9A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.3 6c-2.3 4.6-9.3 9-9.3 9z"/>')}<span>Jogo responsável</span></a>
`;
const closeMenu = () => document.body.classList.remove('menu-open');
document.getElementById('menu-btn').addEventListener('click', () => document.body.classList.toggle('menu-open'));
scrim.addEventListener('click', closeMenu);
sidebar.addEventListener('click', (e) => e.target.closest('a') && closeMenu());

// ---------- Ciclo de vida dos jogos ----------
const CANCEL = Symbol('cancel');
let session = null;

function unmountGame() {
  if (!session) return;
  const s = session;
  session = null;
  s.cancelled = true;
  [...s.pending].forEach((f) => f());
  s.leave.forEach((f) => f());
  s.destroy?.();
}
window.addEventListener('pagehide', unmountGame);

async function mountGame(game, controls, host, recentEl) {
  const s = { cancelled: false, pending: new Set(), leave: [], destroy: null };
  session = s;
  const ctx = {
    controls,
    host,
    async createStage(opts) {
      if (document.fonts?.ready) await document.fonts.ready;
      if (s.cancelled) throw CANCEL;
      const stage = await createStage(host, opts);
      if (s.cancelled) {
        stage.destroy();
        throw CANCEL;
      }
      return stage;
    },
    // Regista um pagamento pendente: corre no fim da animação ou ao sair da página.
    once(fn) {
      let done = false;
      const run = () => {
        if (done) return;
        done = true;
        s.pending.delete(run);
        fn();
      };
      s.pending.add(run);
      return run;
    },
    onLeave(fn) {
      s.leave.push(fn);
    },
    recent(label, win, tier) {
      if (s.cancelled) return;
      const cls = win ? 'pill-win' : tier ? `pill-${tier}` : '';
      recentEl.prepend(h('span', { class: `pill ${cls}` }, label));
      while (recentEl.children.length > 10) recentEl.lastChild.remove();
    },
  };
  try {
    const destroy = await game.mount(ctx);
    if (s.cancelled) destroy();
    else s.destroy = destroy;
  } catch (e) {
    if (e !== CANCEL) {
      console.error(e);
      host.append(h('div', { class: 'stage-error' }, 'Não foi possível iniciar o WebGL neste dispositivo.'));
    }
  }
}

// ---------- Páginas ----------
function card(g, small = false) {
  return h(
    'a',
    {
      class: `game-card${small ? ' small' : ''}`,
      href: `#/game/${g.id}`,
      style: `--c1:${g.art.bg[0]};--c2:${g.art.bg[1]}`,
      'data-name': g.name.toLowerCase(),
    },
    Object.assign(h('div', { class: 'game-card-art' }), { innerHTML: thumbSvg(g) }),
    h('div', { class: 'game-card-name' }, g.name.toUpperCase()),
    h('div', { class: 'game-card-sub' }, 'PIXELUNE ORIGINALS'),
  );
}

function betsTable(limit = 10) {
  const rows = wallet.history.slice(0, limit);
  if (!rows.length) return h('div', { class: 'empty' }, 'Ainda não fizeste apostas. Escolhe um jogo para começar!');
  const time = (t) => new Date(t).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  return h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      { class: 'bets' },
      h('thead', {}, h('tr', {}, ['Jogo', 'Hora', 'Aposta', 'Multiplicador', 'Pagamento'].map((t) => h('th', {}, t)))),
      h(
        'tbody',
        {},
        rows.map((r) =>
          h(
            'tr',
            {},
            h('td', {}, h('a', { href: `#/game/${r.game.toLowerCase()}` }, r.game)),
            h('td', { class: 'muted' }, time(r.time)),
            h('td', {}, money(r.amount)),
            h('td', {}, mult(r.multiplier)),
            h('td', { class: r.payout > r.amount ? 'win' : r.payout < r.amount ? 'loss' : '' }, `${r.payout - r.amount >= 0 ? '+' : ''}${money(r.payout - r.amount)}`),
          ),
        ),
      ),
    ),
  );
}

function lobbyPage() {
  const grid = h('div', { class: 'games-grid' }, games.map((g) => card(g)));
  const search = h('input', { class: 'search', type: 'search', placeholder: 'Procurar jogos…' });
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    grid.querySelectorAll('.game-card').forEach((c) => (c.hidden = !c.dataset.name.includes(q)));
  });
  return h(
    'div',
    { class: 'page' },
    h(
      'section',
      { class: 'hero' },
      h(
        'div',
        { class: 'hero-text' },
        h('div', { class: 'hero-kicker' }, 'Pixelune Originals'),
        h('h1', {}, 'Jogos de casino feitos em ', h('span', {}, 'PixiJS')),
        h('p', {}, `${games.length} originais com gráficos WebGL, 1% de vantagem da casa e 1 000 créditos demo para jogares à vontade.`),
        h('div', { class: 'hero-actions' }, h('a', { class: 'btn-primary', href: '#/game/plinko' }, 'Jogar Plinko'), h('a', { class: 'btn-ghost', href: '#/game/crash' }, 'Experimentar Crash')),
      ),
      h('div', { class: 'hero-cards' }, games.slice(0, 3).map((g) => card(g, true))),
    ),
    h('div', { class: 'search-row' }, search),
    h('div', { class: 'section-head' }, h('h2', {}, 'Originais'), h('span', { class: 'muted' }, `${games.length} jogos`)),
    grid,
    h('div', { class: 'section-head' }, h('h2', {}, 'Trading'), h('span', { class: 'muted' }, 'Opções binárias demo')),
    h(
      'div',
      { class: 'games-grid' },
      h(
        'a',
        { class: 'game-card', href: './binary-options/', style: '--c1:#ec5156;--c2:#7a1f3d' },
        Object.assign(h('div', { class: 'game-card-art' }), {
          innerHTML:
            '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M8 70 26 52 40 62 58 34 72 44 92 18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="92" cy="18" r="6" fill="#fff"/><rect x="18" y="78" width="30" height="12" rx="6" fill="#55bf8e"/><rect x="52" y="78" width="30" height="12" rx="6" fill="#ffd3d8"/></svg>',
        }),
        h('div', { class: 'game-card-name' }, 'TRADER'),
        h('div', { class: 'game-card-sub' }, 'MULTIPLIERS · RISE/FALL'),
      ),
    ),
    h('div', { class: 'section-head' }, h('h2', {}, 'As tuas apostas'), h('a', { href: '#/historico' }, 'Ver tudo')),
    betsTable(8),
  );
}

function gamePage(g) {
  const controls = h('div', { class: 'game-controls' });
  const host = h('div', { class: 'canvas-host' });
  const recentEl = h('div', { class: 'recent' });
  const page = h(
    'div',
    { class: 'page game-page' },
    h('div', { class: 'game-frame' }, controls, h('div', { class: 'game-stage' }, recentEl, host)),
    h(
      'div',
      { class: 'game-bar' },
      h('div', { class: 'game-bar-title' }, h('span', { class: 'side-dot', style: `background:linear-gradient(135deg,${g.art.bg[0]},${g.art.bg[1]})` }), g.name),
      h('div', { class: 'muted' }, `Vantagem da casa ${g.edge} · Pixelune Originals`),
    ),
    h('section', { class: 'game-info' }, h('h2', {}, 'Como jogar'), h('p', {}, g.rules)),
    h('div', { class: 'section-head' }, h('h2', {}, 'Mais jogos')),
    h('div', { class: 'games-grid' }, games.filter((x) => x !== g).map((x) => card(x))),
  );
  return { page, mount: () => mountGame(g, controls, host, recentEl) };
}

function historyPage() {
  return h('div', { class: 'page' }, h('div', { class: 'section-head' }, h('h2', {}, 'Histórico de apostas'), h('span', { class: 'muted' }, 'Últimas 50')), betsTable(50));
}

function responsiblePage() {
  return h(
    'div',
    { class: 'page prose' },
    h('h2', {}, 'Jogo responsável'),
    h('p', {}, 'A Pixelune é uma demonstração técnica de jogos feitos com PixiJS. Todos os créditos são fictícios, não podem ser comprados nem levantados e não têm qualquer valor monetário.'),
    h('p', {}, 'Os resultados usam crypto.getRandomValues() no teu navegador e cada jogo tem uma vantagem da casa de cerca de 1% — tal como nos casinos reais, a longo prazo a casa ganha sempre.'),
    h('p', {}, 'Se o jogo a dinheiro real te está a causar problemas, procura ajuda junto de uma linha de apoio ao jogador do teu país.'),
  );
}

// ---------- Router ----------
function route() {
  unmountGame();
  const hash = location.hash.replace(/^#/, '') || '/';
  const [, section, id] = hash.split('/');
  let key = 'lobby';
  view.replaceChildren();
  window.scrollTo(0, 0);

  if (section === 'game' && byId[id]) {
    key = id;
    const { page, mount } = gamePage(byId[id]);
    view.append(page);
    document.title = `${byId[id].name} — Pixelune Casino`;
    mount();
  } else if (section === 'historico') {
    key = 'historico';
    view.append(historyPage());
    document.title = 'Histórico — Pixelune Casino';
  } else if (section === 'responsavel') {
    key = 'responsavel';
    view.append(responsiblePage());
    document.title = 'Jogo responsável — Pixelune Casino';
  } else {
    view.append(lobbyPage());
    document.title = 'Pixelune Casino';
  }
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.route === key));
}
window.addEventListener('hashchange', route);
route();
