import { Container } from 'pixi.js';
import { Button } from './Button';
import { Field, type FieldAddon } from './Field';
import { Segmented } from './Segmented';

const GAP = 14;

/** Painel de apostas: botão principal, montante, retirar em, ganho líquido e modo. */
export class ControlsPanel extends Container {
  static readonly HEIGHT = 52 + GAP + 3 * (Field.HEIGHT + GAP) + Segmented.HEIGHT;

  readonly play = new Button({ label: 'Apostar', width: 300, height: 52, fontSize: 18 });
  readonly amount: Field;
  readonly cashout: Field;
  readonly gain = new Field({ label: 'Ganho líquido se ganhar', value: '0.00', coin: true, readOnly: true });
  readonly mode = new Segmented(['Manual', 'Auto']);

  constructor(amountAddons: FieldAddon[], cashoutAddons: FieldAddon[]) {
    super();
    this.amount = new Field({ label: 'Montante', value: '0.00', coin: true, addons: amountAddons });
    this.cashout = new Field({ label: 'Retirar em', value: '2.00', addons: cashoutAddons });
    this.addChild(this.play, this.amount, this.cashout, this.gain, this.mode);
  }

  layout(w: number): void {
    let y = 0;
    this.play.setSize(w, 52);
    this.play.y = y;
    y += 52 + GAP;
    for (const f of [this.amount, this.cashout, this.gain]) {
      f.layout(w);
      f.y = y;
      y += Field.HEIGHT + GAP;
    }
    this.mode.layout(w);
    this.mode.y = y;
  }
}
