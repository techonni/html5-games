import { Application, Container } from 'pixi.js';

export const COLORS = {
  bg: 0x0e1c26,
  panel: 0x1b2d3b,
  panelLight: 0x2a4152,
  line: 0x34505f,
  text: 0xffffff,
  muted: 0x9fb0c8,
  green: 0x00e07a,
  red: 0xff3d57,
  yellow: 0xffc53d,
  blue: 0x2f8cff,
  purple: 0x8b5cff,
};

export const FONT = 'Inter, system-ui, -apple-system, Segoe UI, sans-serif';

// Cria uma Application que preenche `host` e um `root` com resolução de design fixa,
// escalado e centrado para caber em qualquer tamanho de ecrã.
export async function createStage(host, { width = 800, height = 600, background = COLORS.bg } = {}) {
  const app = new Application();
  await app.init({
    background,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
  });
  host.appendChild(app.canvas);

  const root = new Container();
  app.stage.addChild(root);
  app.stage.eventMode = 'static';
  app.stage.hitArea = app.screen;

  const fit = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    app.renderer.resize(w, h);
    const s = Math.min(w / width, h / height);
    root.scale.set(s);
    root.position.set((w - width * s) / 2, (h - height * s) / 2);
  };
  const ro = new ResizeObserver(fit);
  ro.observe(host);
  fit();

  return {
    app,
    root,
    width,
    height,
    destroy() {
      ro.disconnect();
      app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true, texture: true, textureSource: true });
    },
  };
}
