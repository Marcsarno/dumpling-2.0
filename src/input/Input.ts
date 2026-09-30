/**
 * Movement input: a DOM virtual joystick (Pointer Events with capture: touch, pen, mouse)
 * summed with WASD/arrow keys and clamped to length 1. Resets whenever focus, size or
 * visibility changes so a stuck key or finger can never keep her walking.
 */
const KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

export class MoveInput {
  readonly value = {x: 0, y: 0};
  private readonly stick = {x: 0, y: 0};
  private readonly held = new Set<string>();
  private pointer: number | null = null;
  private readonly abort = new AbortController();

  constructor(private readonly pad?: HTMLElement, private readonly knob?: HTMLElement) {
    const o = {signal: this.abort.signal};
    addEventListener('keydown', e => {
      if (!(e.code in KEYS) || document.querySelector('dialog[open]')) return;
      if ((e.target as HTMLElement | null)?.closest('input,select,textarea')) return;
      this.held.add(e.code); e.preventDefault();
    }, o);
    addEventListener('keyup', e => this.held.delete(e.code), o);
    addEventListener('blur', this.reset, o);
    addEventListener('resize', this.reset, o);
    document.addEventListener('visibilitychange', this.reset, o);
    if (pad) {
      pad.addEventListener('pointerdown', this.down, o);
      pad.addEventListener('pointermove', this.move, o);
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) pad.addEventListener(type, this.up, o);
      pad.addEventListener('contextmenu', e => e.preventDefault(), o);
    }
  }

  read() {
    let x = this.stick.x, y = this.stick.y;
    for (const code of this.held) { x += KEYS[code][0]; y += KEYS[code][1]; }
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    if (document.hidden) x = y = 0;
    this.value.x = x; this.value.y = y;
    return this.value;
  }

  private down = (e: PointerEvent) => {
    if (this.pointer !== null || e.button !== 0) return;
    e.preventDefault(); this.pointer = e.pointerId; this.pad!.setPointerCapture(e.pointerId); this.pad!.classList.add('dragging'); this.move(e);
  };
  private move = (e: PointerEvent) => {
    if (e.pointerId !== this.pointer) return;
    e.preventDefault();
    const rect = this.pad!.getBoundingClientRect(), radius = rect.width * .29;
    const x = e.clientX - rect.left - rect.width / 2, y = e.clientY - rect.top - rect.height / 2, length = Math.hypot(x, y);
    const clamp = length > radius ? radius / length : 1;
    if (this.knob) this.knob.style.transform = `translate(${x * clamp}px, ${y * clamp}px)`;
    // 12% dead zone, remaining range rescaled to keep analog speed control.
    const magnitude = Math.max(0, (Math.min(length / radius, 1) - .12) / .88);
    this.stick.x = length ? x / length * magnitude : 0; this.stick.y = length ? -y / length * magnitude : 0;
  };
  private up = (e: PointerEvent) => { if (e.pointerId === this.pointer) this.reset(); };
  reset = () => {
    const id = this.pointer; this.pointer = null;
    if (id !== null && this.pad?.hasPointerCapture(id)) this.pad.releasePointerCapture(id);
    this.stick.x = this.stick.y = 0; this.held.clear();
    if (this.knob) this.knob.style.transform = '';
    this.pad?.classList.remove('dragging');
  };
  destroy() { this.reset(); this.abort.abort(); }
}
