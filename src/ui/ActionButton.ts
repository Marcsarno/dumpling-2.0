/** Single control shared by tap actions and hold actions. Pointer capture supports two thumbs. */
export class ActionButton {
  enabled = true;
  held = false;
  private pointer: number | null = null;
  private key: string | null = null;
  private readonly abort = new AbortController();
  constructor(readonly element: HTMLButtonElement, private readonly press: () => void, private readonly cancel: () => void) {
    const options = { signal: this.abort.signal };
    element.addEventListener('pointerdown', event => {
      if (!this.enabled || event.button !== 0 || this.held || element.disabled || document.querySelector('dialog[open]')) return;
      event.preventDefault(); this.pointer = event.pointerId;
      element.setPointerCapture(event.pointerId); this.held = true; this.press();
    }, options);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      element.addEventListener(name, event => { if (event.pointerId === this.pointer) this.reset(); }, options);
    }
    element.addEventListener('contextmenu', event => event.preventDefault(), options);
    element.addEventListener('click', event => {
      // Pointer activations happen on press. detail=0 supports assistive programmatic clicks.
      if (this.enabled && event.detail === 0 && !this.held && !element.disabled && !document.querySelector('dialog[open]')) { this.press(); this.cancel(); }
    }, options);
    window.addEventListener('keydown', event => {
      const target = event.target as HTMLElement;
      if (!this.enabled || !['Space', 'KeyE'].includes(event.code) || document.querySelector('dialog[open]') || (target?.closest('button') && target !== element)) return;
      event.preventDefault();
      if (event.repeat || this.held || element.disabled) return;
      this.key = event.code; this.held = true; this.press();
    }, options);
    window.addEventListener('keyup', event => { if (event.code === this.key) { event.preventDefault(); this.reset(); } }, options);
    window.addEventListener('blur', this.reset, options);
    window.addEventListener('resize', this.reset, options);
    document.addEventListener('visibilitychange', this.reset, options);
  }
  reset = () => {
    const pointer = this.pointer;
    this.pointer = null; this.key = null; this.held = false;
    if (pointer !== null && this.element.hasPointerCapture(pointer)) this.element.releasePointerCapture(pointer);
    this.cancel();
  };
  destroy() { this.reset(); this.abort.abort(); }
}
