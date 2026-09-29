import { Application, Container } from 'pixi.js';
import gsap from 'gsap';
import { C } from './core/theme';
import { setDevicePixelRatio, updateTextResolutions } from './core/text';
import { sound } from './core/audio/Sound';
import type { GameScene } from './core/scene';
import { Header, type Route } from './site/Header';
import { Drawer } from './site/Drawer';
import { HomePage } from './site/HomePage';
import { AboutPage } from './site/AboutPage';
import type { Page } from './site/Page';

const TITLES: Record<Route, string> = {
  home: 'zunrel — jogos originais HTML5',
  crash: 'Crash — zunrel',
  binary: 'Binary — zunrel',
  about: 'Sobre — zunrel',
};

const MOBILE_BREAK = 860;

/** Site zunrel inteiro num único canvas PixiJS: cabeçalho, páginas e jogos embutidos. */
class Site {
  private readonly app = new Application();
  private readonly header = new Header();
  private readonly drawer = new Drawer();
  private readonly pages: Partial<Record<Route, Page>> = {};
  private readonly games: Partial<Record<Route, GameScene>> = {};
  private readonly body = new Container();
  private route: Route = 'home';
  private W = 400;
  private H = 800;
  private mobile = true;

  async start(): Promise<void> {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    setDevicePixelRatio(dpr);
    await this.app.init({ resizeTo: window, background: C.bgBase, antialias: true, autoDensity: true, resolution: dpr });
    document.body.appendChild(this.app.canvas);
    sound.init();

    this.pages.home = new HomePage();
    this.pages.about = new AboutPage();
    for (const p of Object.values(this.pages)) {
      p.onNavigate = (r) => this.navigate(r);
      p.visible = false;
      this.body.addChild(p);
    }
    this.header.onNavigate = (r) => this.navigate(r);
    this.header.onMenu = () => this.drawer.open(this.W);
    this.drawer.onNavigate = (r) => this.navigate(r);
    this.app.stage.addChild(this.body, this.header, this.drawer);

    window.addEventListener('resize', () => requestAnimationFrame(() => this.layout()));
    window.addEventListener('hashchange', () => this.show(this.fromHash()));
    this.layout();
    this.show(this.fromHash());

    this.app.ticker.add((t) => {
      const dt = Math.min(t.deltaMS, 100);
      this.pages[this.route]?.tick(dt);
      for (const [r, g] of Object.entries(this.games)) g.update(dt, r === this.route);
      updateTextResolutions();
    });
  }

  private fromHash(): Route {
    const h = location.hash.replace(/^#\/?/, '');
    return (['crash', 'binary', 'about'] as Route[]).includes(h as Route) ? (h as Route) : 'home';
  }

  private navigate(r: Route): void {
    const hash = r === 'home' ? '#/' : `#/${r}`;
    if (location.hash !== hash) location.hash = hash;
    else this.show(r);
  }

  /** Cria o jogo quando é aberto pela primeira vez (o código já vem no mesmo bundle). */
  private async game(r: Route): Promise<GameScene | undefined> {
    if (this.games[r]) return this.games[r];
    let g: GameScene | undefined;
    if (r === 'crash') g = new (await import('./games/crash/CrashGame')).CrashGame();
    if (r === 'binary') g = new (await import('./games/binary/BinaryGame')).BinaryGame();
    if (!g) return undefined;
    this.games[r] = g;
    g.view.visible = false;
    this.body.addChild(g.view);
    this.placeGame(g);
    return g;
  }

  private async show(r: Route): Promise<void> {
    this.route = r;
    document.title = TITLES[r];
    this.header.setRoute(r);
    this.drawer.setRoute(r);
    this.drawer.close();
    const target = this.pages[r] ?? (await this.game(r))?.view;
    if (this.route !== r) return;
    for (const p of Object.values(this.pages)) p.visible = p === target;
    for (const [k, g] of Object.entries(this.games)) {
      g.view.visible = g.view === target;
      g.setActive(k === r);
    }
    if (target) gsap.fromTo(target, { alpha: 0 }, { alpha: 1, duration: 0.3, ease: 'power2.out' });
  }

  private layout(): void {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.mobile = this.W < MOBILE_BREAK;
    const hh = Header.height(this.mobile);
    this.header.layout(this.W, this.mobile);
    this.drawer.layout(this.W, this.H);
    for (const p of Object.values(this.pages)) {
      p.y = hh;
      p.layout(this.W, this.H - hh, this.mobile);
    }
    for (const g of Object.values(this.games)) this.placeGame(g);
  }

  private placeGame(g: GameScene): void {
    const hh = Header.height(this.mobile);
    g.view.position.set(0, hh);
    g.resize(this.W, this.H - hh);
  }
}

void new Site().start();
