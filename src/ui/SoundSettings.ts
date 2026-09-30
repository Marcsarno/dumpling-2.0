import type {WebGLRenderer} from 'three';
import {audioLevel, setAudioLevel, type AudioChannel} from './audioLevels';

/**
 * "Sound & performance" (PlayCanvas AudioSettings + PerformanceSettings): music and
 * sound-effect volumes (0 is silent, saved), the music and house-sounds toggles, and a
 * small performance readout. Rendering pauses while any menu is open, as in PlayCanvas.
 */
export class SoundSettings {
  readonly dialog = document.createElement('dialog');
  private readonly readout = document.createElement('p');
  private readonly info = document.createElement('details');
  private frames = 0;
  private start = performance.now();
  private fps = 0;
  private readonly timer: number;

  constructor(private readonly renderer: WebGLRenderer, toggles: HTMLElement[]) {
    const d = this.dialog;
    d.id = 'sound-settings'; d.className = 'adventure-panel sound-settings'; d.setAttribute('aria-labelledby', 'sound-settings-title');
    d.innerHTML = `<header class="adventure-panel-head"><div><span class="adventure-overline">JUST RIGHT</span><h2 id="sound-settings-title">Sound &amp; performance</h2></div></header>
      <div class="adventure-panel-body">${(['music', 'effects'] as const).map(c => `<label class="sound-level">${c === 'music' ? 'Music' : 'Sound effects'} <output id="${c}-level"></output>
      <input type="range" min="0" max="100" step="1" data-channel="${c}" aria-label="${c === 'music' ? 'Music volume' : 'Sound effects volume'}"></label>`).join('')}
      <div class="audio-mutes"></div><p class="sound-note">0 is silent. Your volume is saved.</p><button class="adventure-resume" type="button">Done</button></div>`;
    for (const slider of d.querySelectorAll<HTMLInputElement>('input[type=range]')) {
      const channel = slider.dataset.channel as AudioChannel, output = d.querySelector<HTMLOutputElement>(`#${channel}-level`)!;
      slider.value = String(Math.round(audioLevel(channel) * 100)); output.value = slider.value + '%';
      slider.addEventListener('input', () => { setAudioLevel(channel, Number(slider.value) / 100); output.value = slider.value + '%'; });
    }
    d.querySelector('.audio-mutes')!.append(...toggles);
    const summary = document.createElement('summary'); summary.textContent = 'Performance information';
    this.info.append(summary, this.readout); d.querySelector('.sound-note')!.after(this.info);
    d.querySelector('.adventure-resume')!.addEventListener('click', () => d.close());
    d.addEventListener('cancel', e => { e.preventDefault(); d.close(); });
    document.querySelector('#game')!.append(d);
    this.timer = window.setInterval(() => {
      if (!this.info.open) return;
      const i = this.renderer.info;
      this.readout.textContent = `Last active render rate: ${this.fps} FPS · ${i.render.calls} draws · ${Math.round(i.render.triangles / 1000)}k triangles · ${i.memory.textures} textures. Rendering pauses behind menus.`;
    }, 500);
  }

  /** Count a drawn frame (for the readout). */
  drew() {
    this.frames++;
    const now = performance.now();
    if (now - this.start >= 1000) { this.fps = Math.round(this.frames * 1000 / (now - this.start)); this.frames = 0; this.start = now; }
  }

  open() { this.dialog.showModal(); this.dialog.querySelector<HTMLElement>('input')?.focus({preventScroll: true}); }
  destroy() { clearInterval(this.timer); this.dialog.remove(); }
}
