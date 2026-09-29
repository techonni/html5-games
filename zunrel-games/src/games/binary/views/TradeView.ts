import { Container, Graphics, Rectangle, type Text } from 'pixi.js';
import gsap from 'gsap';
import { C, R } from '../theme';
import { makeText } from '../text';
import { sound } from '../audio/Sound';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Segmented';
import { Tile } from '../ui/Tile';
import { Chart } from './Chart';

const TOP_H = 72;
const PANEL_H = 16 + 56 + 16 + 76 + 16 + 56 + 18;

/** Ícone do mercado: mini-velas, número do índice e bolinha "1s". */
function marketIcon(): { view: Container; badge: Text } {
  const view = new Container();
  const g = new Graphics();
  const hs = [8, 12, 6, 14, 10, 16, 12];
  hs.forEach((h, i) => {
    g.rect(i * 6, 26 - h / 2, 4, h).fill(C.textMuted);
    g.rect(i * 6 + 1.5, 26 - h / 2 - 3, 1, h + 6).fill(C.textMuted);
  });
  g.rect(44, 8, 2, 38).fill(C.textMuted);
  const pill = new Graphics().roundRect(-2, -6, 34, 18, 5).fill(C.bgStage);
  const badge = makeText('100', { fontSize: 11, fontWeight: '700', fill: C.text });
  badge.anchor.set(0.5);
  badge.position.set(15, 3);
  const dot = new Graphics().circle(40, 2, 8).fill(C.btnPrimary);
  const s = makeText('1s', { fontSize: 9, fontWeight: '700', fill: C.text });
  s.anchor.set(0.5);
  s.position.set(40, 2);
  view.addChild(g, pill, badge, dot, s);
  return { view, badge };
}

/** Separador "Negociar": seletor de mercado, gráfico e painel de compra. */
export class TradeView extends Container {
  readonly chart = new Chart();
  readonly dir = new Segmented([
    { label: 'Sobe', color: C.up },
    { label: 'Desce', color: C.down },
  ]);
  readonly duration = new Tile('Duração');
  readonly stake = new Tile('Aposta');
  readonly payout = new Tile('Pagamento', false);
  readonly buy = new Button({ label: 'Comprar', width: 300, height: 56, fontSize: 20 });

  onPickMarket: (() => void) | null = null;
  onPickType: (() => void) | null = null;

  private readonly plus = new Container();
  private readonly card = new Container();
  private readonly cardBg = new Graphics();
  private readonly marketName: Text;
  private readonly typeText: Text;
  private readonly chev = new Graphics();
  private readonly icon = marketIcon();
  private readonly typeHit = new Container();
  private readonly panel = new Container();
  private readonly panelBg = new Graphics();
  private expanded = false;
  private readonly chartH = { v: 300 };
  private w = 360;
  private h = 600;
  private wide = false;
  private static readonly SIDE_W = 380;

  constructor() {
    super();
    const plusBg = new Graphics();
    plusBg.label = 'bg';
    const plusIcon = new Graphics().rect(-14, -1.5, 28, 3).rect(-1.5, -14, 3, 28).fill(C.text);
    this.plus.addChild(plusBg, plusIcon);
    this.plus.eventMode = 'static';
    this.plus.cursor = 'pointer';
    this.plus.on('pointertap', () => {
      sound.play('click');
      this.onPickMarket?.();
    });

    this.marketName = makeText('', { fontSize: 19, fontWeight: '700', fill: C.text });
    this.typeText = makeText('Binary', { fontSize: 16, fontWeight: '500', fill: C.textMuted });
    this.card.addChild(this.cardBg, this.icon.view, this.marketName, this.typeText, this.chev, this.typeHit);
    this.card.eventMode = 'static';
    this.card.cursor = 'pointer';
    this.card.on('pointertap', () => {
      sound.play('click');
      this.onPickMarket?.();
    });
    this.typeHit.eventMode = 'static';
    this.typeHit.cursor = 'pointer';
    this.typeHit.on('pointertap', (e) => {
      e.stopPropagation();
      sound.play('click');
      this.onPickType?.();
    });

    this.panel.addChild(this.panelBg, this.dir, this.duration, this.stake, this.payout, this.buy);
    this.addChild(this.plus, this.card, this.chart, this.panel);
    this.chart.onExpand = () => this.toggleExpand();
  }

  setMarket(name: string, badge: string): void {
    this.marketName.text = name;
    this.icon.badge.text = badge;
    this.layoutCard();
    gsap.fromTo(this.marketName, { alpha: 0 }, { alpha: 1, duration: 0.3 });
  }

  setType(name: string): void {
    this.typeText.text = name;
    this.layoutCard();
  }

  layout(w: number, h: number, wide = false): void {
    this.w = w;
    this.h = h;
    this.wide = wide;
    (this.plus.getChildByLabel('bg') as Graphics).clear().roundRect(0, 0, 64, TOP_H, R.panel).fill(C.bgPanel);
    this.plus.hitArea = new Rectangle(0, 0, 64, TOP_H);
    this.plus.children[1].position.set(32, TOP_H / 2);
    this.card.x = 74;
    this.layoutCard();

    const pw = wide ? TradeView.SIDE_W : w;
    this.panelBg.clear().roundRect(0, 0, pw, PANEL_H, R.panel).fill(C.bgPanel);
    const inner = pw - 32;
    this.dir.position.set(16, 16);
    this.dir.layout(inner, 56);
    const tw = (inner - 2 * 12) / 3;
    [this.duration, this.stake, this.payout].forEach((t, i) => {
      t.position.set(16 + i * (tw + 12), 16 + 56 + 16);
      t.layout(tw, 76);
    });
    this.buy.position.set(16, 16 + 56 + 16 + 76 + 16);
    this.buy.setSize(inner, 56);

    gsap.killTweensOf(this.chartH);
    this.chartH.v = this.targetChartH();
    this.placeChart();
  }

  /** Largura da coluna do gráfico (tudo no telemóvel; à esquerda do painel no computador). */
  private get leftW(): number {
    return this.wide && !this.expanded ? this.w - TradeView.SIDE_W - 16 : this.w;
  }

  private layoutCard(): void {
    const cw = (this.wide ? this.w - TradeView.SIDE_W - 16 : this.w) - 74;
    this.cardBg.clear().roundRect(0, 0, cw, TOP_H, R.panel).fill(C.bgPanel);
    this.card.hitArea = new Rectangle(0, 0, cw, TOP_H);
    this.icon.view.position.set(18, 10);
    this.marketName.position.set(82, 10);
    const room = cw - 82 - 14;
    this.marketName.scale.set(1);
    if (this.marketName.width > room) this.marketName.scale.set(room / this.marketName.width);
    this.typeText.position.set(82, 38);
    this.chev.clear().moveTo(0, 0).lineTo(7, 7).lineTo(14, 0).stroke({ width: 2.2, color: C.textMuted, cap: 'round', join: 'round' });
    this.chev.position.set(82 + this.typeText.width + 12, 46);
    this.typeHit.hitArea = new Rectangle(76, 34, this.typeText.width + 40, 36);
  }

  private targetChartH(): number {
    return this.expanded || this.wide ? this.h - TOP_H - 12 : this.h - TOP_H - 12 - PANEL_H - 12;
  }

  private placeChart(): void {
    this.chart.y = TOP_H + 12;
    this.chart.layout(this.leftW, this.chartH.v);
    if (this.wide) this.panel.position.set(this.w - TradeView.SIDE_W, 0);
    else this.panel.position.set(0, TOP_H + 12 + this.chartH.v + 12);
  }

  private toggleExpand(): void {
    this.expanded = !this.expanded;
    if (this.wide) this.placeChart();
    else gsap.to(this.chartH, { v: this.targetChartH(), duration: 0.45, ease: 'power3.inOut', onUpdate: () => this.placeChart() });
    gsap.to(this.panel, { alpha: this.expanded ? 0 : 1, duration: 0.3 });
    this.panel.eventMode = this.expanded ? 'none' : 'auto';
  }
}
