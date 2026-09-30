import {Vector3, type Camera, type Object3D} from 'three';

/**
 * A family member's speech bubble (PlayCanvas .lilah-label / .marc-label): shown for a few
 * seconds above the head, clamped to the screen sides and hidden near the top and bottom
 * edges where the HUD and controls live.
 */
export class SpeechLabel {
  readonly element = document.createElement('div');
  text = '';
  private until = 0;
  private readonly head = new Vector3();

  constructor(variant: string, private readonly seconds: number, private readonly margins: {top: number; bottom: number; side: number}) {
    this.element.className = `speech-label ${variant}`; this.element.hidden = true;
    document.querySelector('#game')?.append(this.element);
  }

  say(text: string) { this.text = text; this.element.textContent = text; this.until = performance.now() + this.seconds * 1000; }
  get showing() { return performance.now() <= this.until; }

  place(target: Object3D, height: number, camera: Camera, canvas: HTMLElement) {
    const e = this.element;
    if (!target.visible || !this.showing) { e.hidden = true; return; }
    this.head.set(target.position.x, target.position.y + height, target.position.z).project(camera);
    const rect = canvas.getBoundingClientRect(), x = (this.head.x + 1) / 2 * rect.width, y = (1 - this.head.y) / 2 * rect.height;
    e.hidden = x < this.margins.side || x > rect.width - this.margins.side || y < this.margins.top || y > rect.height - this.margins.bottom;
    if (e.hidden) return;
    const w = e.offsetWidth, h = e.offsetHeight;
    e.style.transform = `translate(${Math.max(4, Math.min(rect.width - w - 4, x - w / 2))}px,${y - h}px)`;
  }

  hide() { this.element.hidden = true; }
  dispose() { this.element.remove(); }
}
