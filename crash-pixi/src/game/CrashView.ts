import { Container, FillGradient, Graphics, TextStyle, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C, FONT, R } from '../theme';
import { makeText } from '../text';
import { fmtMult } from '../format';
import { HistoryBar } from '../ui/HistoryBar';
import { multiplierAt } from './CrashEngine';

const multStyle = (outline: number) =>
  new TextStyle({
    fontFamily: FONT,
    fontSize: 76,
    fontWeight: '900',
    fill: C.text,
    stroke: { color: outline, width: 7, join: 'round' },
    dropShadow: { color: outline, distance: 6, angle: Math.PI / 2, blur: 0, alpha: 1 },
    padding: 12,
  });

/** Cena de jogo: histórico, curva com bola, multiplicador gigante e estado da ronda. */
export class CrashView extends Container {
  readonly history = new HistoryBar(4);

  private readonly bg = new Graphics();
  private readonly grid = new Graphics();
  private readonly area = new Graphics();
  private readonly line = new Graphics();
  private readonly ball = new Container();
  private readonly fx = new Container();
  private readonly mult: Text;
  private readonly status = new Container();
  private readonly statusBg = new Graphics();
  private readonly statusText: Text;
  private readonly bar = new Graphics();
  private readonly footLeft: Text;
  private readonly footRight: Text;

  private readonly blueStyle = multStyle(C.multBlue);
  private readonly redStyle = multStyle(C.multRed);
  private readonly lineGrad = new FillGradient({
    start: { x: 0, y: 0.5 },
    end: { x: 1, y: 0.5 },
    colorStops: [
      { offset: 0, color: C.curveStart },
      { offset: 1, color: C.multBlue },
    ],
  });
  private readonly areaGrad = new FillGradient({
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: 'rgba(59,130,246,0.38)' },
      { offset: 1, color: 'rgba(59,130,246,0)' },
    ],
  });

  private w = 360;
  private plot = { x0: 0, y0: 0, x1: 1, y1: 1 };
  private multValue = '';
  private statusMode: 'none' | 'countdown' | 'crashed' = 'none';
  private tip = { x: 0, y: 0 };

  constructor() {
    super();
    this.mult = makeText(fmtMult(1), {});
    this.mult.style = this.blueStyle;
    this.mult.anchor.set(0.5);

    const glow = new Graphics().circle(0, 0, 20).fill({ color: C.text, alpha: 0.12 });
    const core = new Graphics().circle(0, 0, 12).fill(C.text);
    this.ball.addChild(glow, core);
    gsap.to(glow.scale, { x: 1.35, y: 1.35, duration: 0.7, repeat: -1, yoyo: true, ease: 'sine.inOut' });

    this.statusText = makeText('', { fontSize: 17, fontWeight: '700', fill: C.text });
    this.statusText.anchor.set(0.5);
    this.status.addChild(this.statusBg, this.statusText, this.bar);
    this.status.visible = false;

    this.footLeft = makeText('', { fontSize: 15, fontWeight: '600', fill: C.textMuted });
    this.footRight = makeText('', { fontSize: 15, fontWeight: '600', fill: C.textMuted });
    this.footRight.anchor.set(1, 0);

    this.addChild(this.bg, this.grid, this.history, this.area, this.line, this.ball, this.mult, this.status, this.fx, this.footLeft, this.footRight);
  }

  layout(w: number, h: number, squareBottom: boolean): void {
    this.w = w;
    this.bg.clear().roundRect(0, 0, w, h, R.panel).fill(C.bgStage);
    if (squareBottom) this.bg.rect(0, h - R.panel, w, R.panel).fill(C.bgStage);

    this.history.position.set(16, 16);
    this.history.layout(w - 32);

    this.plot = { x0: 36, y0: 16 + HistoryBar.HEIGHT + 36, x1: w - 36, y1: h - 58 };
    const { x0, y0, x1, y1 } = this.plot;
    this.grid.clear();
    for (let i = 0; i <= 3; i++) {
      const y = y0 + ((y1 - y0) * i) / 3;
      this.grid.moveTo(x0, y).lineTo(x1, y);
    }
    this.grid.stroke({ width: 1, color: C.border, alpha: 0.35 });

    this.mult.position.set(w / 2, y0 + (y1 - y0) * 0.36);
    this.status.position.set(w / 2, this.statusMode === 'countdown' ? this.mult.y : this.mult.y + 78);
    this.footLeft.position.set(18, h - 34);
    this.footRight.position.set(w - 18, h - 34);
  }

  /** Posição (local) para avisos: logo acima do rodapé da cena. */
  get stageWidth(): number {
    return this.w;
  }

  get noticeY(): number {
    return this.plot.y1 - 40;
  }

  setRound(round: number, profit: number): void {
    const sign = profit > 0 ? '+' : profit < 0 ? '−' : '';
    this.footLeft.text = `Ronda #${round} · RTP 99%`;
    this.footRight.text = `Sessão ${sign}${Math.abs(profit).toFixed(2)}`;
    this.footRight.style.fill = profit > 0 ? C.win : C.textMuted;
  }

  /** Início de fase: prepara a cena e anima a transição. */
  enterCountdown(): void {
    this.mult.style = this.blueStyle;
    this.setMult(1);
    this.mult.visible = false;
    this.area.clear();
    this.line.clear();
    this.ball.visible = true;
    gsap.killTweensOf(this.ball);
    gsap.fromTo(this.ball, { alpha: 0 }, { alpha: 1, duration: 0.3 });
    this.drawCurve(0, false);
    this.showStatus('countdown');
  }

  enterRunning(): void {
    this.hideStatus();
    this.mult.visible = true;
    gsap.fromTo(this.mult.scale, { x: 0.8, y: 0.8 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(2.5)' });
  }

  enterCrashed(flightMs: number, crashAt: number): void {
    this.setMult(crashAt);
    this.mult.style = this.redStyle;
    this.mult.visible = true;
    this.drawCurve(flightMs, true);
    gsap.fromTo(this.mult, { x: this.w / 2 - 10 }, { x: this.w / 2, duration: 0.5, ease: 'elastic.out(1.4, 0.3)' });
    this.explode();
    this.showStatus('crashed');
  }

  updateCountdown(remainingMs: number, totalMs: number): void {
    this.statusText.text = `Próxima ronda em ${(remainingMs / 1000).toFixed(1)}s`;
    const w = Math.max(this.statusText.width + 44, 230);
    this.bar.clear().roundRect(-w / 2 + 16, 30, (w - 32) * (remainingMs / totalMs), 4, 2).fill(C.btnPrimary);
  }

  updateRunning(flightMs: number, m: number): void {
    this.setMult(m);
    this.drawCurve(flightMs, false);
  }

  /** Mostra o ganho a subir a partir da bola. */
  popCashout(text: string): void {
    const t = makeText(text, { fontSize: 22, fontWeight: '800', fill: C.win });
    t.anchor.set(0.5);
    t.position.set(Math.min(this.tip.x, this.w - 70), this.tip.y - 26);
    this.fx.addChild(t);
    gsap
      .timeline({ onComplete: () => t.destroy() })
      .from(t.scale, { x: 0.3, y: 0.3, duration: 0.35, ease: 'back.out(3)' })
      .to(t, { y: t.y - 60, alpha: 0, duration: 1.2, ease: 'power1.in' }, 0.35);
  }

  private setMult(m: number): void {
    const s = fmtMult(m);
    if (s !== this.multValue) {
      this.multValue = s;
      this.mult.text = s;
    }
  }

  private drawCurve(flightMs: number, crashed: boolean): void {
    const { x0, y0, x1, y1 } = this.plot;
    const m = multiplierAt(flightMs);
    // Eixos que "acompanham" a bola: a ponta fica perto de 85% × 80% da área.
    const xMax = Math.max(8000, flightMs / 0.85);
    const yMax = Math.max(1.8, 1 + (m - 1) / 0.8);
    const N = 48;
    const pts: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = (flightMs * i) / N;
      pts.push(x0 + (t / xMax) * (x1 - x0), y1 - ((multiplierAt(t) - 1) / (yMax - 1)) * (y1 - y0));
    }
    const tipX = pts[pts.length - 2];
    const tipY = pts[pts.length - 1];
    this.tip = { x: tipX, y: tipY };

    this.area.clear();
    this.line.clear();
    if (flightMs > 0) {
      this.area.poly([...pts, tipX, y1, x0, y1]).fill(crashed ? { color: C.curveDead, alpha: 0.18 } : this.areaGrad);
      this.line.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) this.line.lineTo(pts[i], pts[i + 1]);
      this.line.stroke(
        crashed
          ? { width: 8, color: C.curveDead, cap: 'round', join: 'round' }
          : { width: 8, fill: this.lineGrad, cap: 'round', join: 'round' },
      );
    }
    this.ball.position.set(tipX, tipY);
  }

  private explode(): void {
    const { x, y } = this.tip;
    gsap.to(this.ball, { alpha: 0, duration: 0.2 });
    const ring = new Graphics().circle(0, 0, 14).stroke({ width: 4, color: C.multRed });
    ring.position.set(x, y);
    this.fx.addChild(ring);
    gsap.to(ring.scale, { x: 4, y: 4, duration: 0.6, ease: 'power2.out' });
    gsap.to(ring, { alpha: 0, duration: 0.6, onComplete: () => ring.destroy() });
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
      const d = 40 + Math.random() * 40;
      const p = new Graphics().circle(0, 0, 3 + Math.random() * 3).fill(i % 2 ? C.multRed : C.text);
      p.position.set(x, y);
      this.fx.addChild(p);
      gsap.to(p, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 0.7, ease: 'power2.out', onComplete: () => p.destroy() });
    }
  }

  private showStatus(mode: 'countdown' | 'crashed'): void {
    this.statusMode = mode;
    const crashed = mode === 'crashed';
    this.statusText.text = crashed ? 'Crash' : 'Próxima ronda em 5.0s';
    const w = crashed ? 150 : Math.max(this.statusText.width + 44, 230);
    const h = crashed ? 54 : 48;
    this.statusBg.clear().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(crashed ? C.loss : C.btnSecondary);
    this.statusText.style.fontSize = crashed ? 22 : 17;
    this.bar.clear();
    this.bar.visible = !crashed;
    this.status.y = crashed ? this.mult.y + 78 : this.mult.y;
    this.status.visible = true;
    gsap.killTweensOf(this.status.scale);
    gsap.fromTo(this.status.scale, { x: 0.5, y: 0.5 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(2.5)' });
  }

  private hideStatus(): void {
    this.statusMode = 'none';
    gsap.killTweensOf(this.status.scale);
    gsap.to(this.status.scale, { x: 0, y: 0, duration: 0.2, ease: 'power2.in', onComplete: () => void (this.status.visible = this.statusMode !== 'none') });
  }
}
