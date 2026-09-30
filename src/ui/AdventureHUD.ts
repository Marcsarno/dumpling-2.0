import './hud.css';

const icons = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  book: '<path d="M12 6C9 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2Zm0 0v15M6 8h2m-2 4h2m8-4h2m-2 4h2"/>',
  flower: '<path d="M12 9c-7-10-12 1-5 4-9 4 0 12 5 4 5 8 14 0 5-4 7-3 2-14-5-4Z"/><circle cx="12" cy="13" r="2"/>',
  bag: '<path d="M5 8h14l1 13H4L5 8Zm4 1V6a3 3 0 0 1 6 0v3"/>',
  menu: '<path d="M4 7h16M4 12h11M4 17h16"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  spark: '<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2Z"/>',
};
export const hudIcon = (name: keyof typeof icons) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

/** Everything the HUD shows, computed by the game each frame (no reading back from the DOM). */
export interface HudState {
  location: string; day: number; time: string; phase: string; balance: number;
  tasks: readonly {id: string; name: string; room?: string}[]; completed: ReadonlySet<string>;
  hint: string; timed: boolean; remaining: string; urgent: boolean; clockNote: string;
  action: {ready: boolean; title: string; detail: string; target?: string; progress?: number};
  message: string;
}
const ROOMS: Record<string, string> = {teeth: 'Bathroom', outfit: 'Bedroom', breakfast: 'Kitchen', read: 'Bedroom'};

/**
 * The adventure HUD (PlayCanvas src/ui/AdventureHUD.ts, the owner-reviewed redesign): day and
 * place card with today's count, wallet, menu and journal dialogs, the round timer, and the
 * large action button. Same markup and styling; the rebuild drives it from a typed state
 * instead of scraping hidden legacy DOM, and only lists menu destinations that exist.
 */
export class AdventureHUD {
  private readonly game = document.querySelector<HTMLElement>('#game')!;
  private readonly root = document.createElement('div');
  readonly menu = document.createElement('dialog');
  readonly journal = document.createElement('dialog');
  private readonly abort = new AbortController();
  private taskSignature = '';
  private lastFocus?: HTMLElement;
  private hasModal = false;
  private readonly observer: MutationObserver;

  constructor(private readonly resetInput: () => void, extraMenu: HTMLElement[] = []) {
    this.game.classList.add('adventure-ui');
    this.game.dataset.input = matchMedia('(pointer:coarse)').matches ? 'touch' : 'pointer';
    this.root.id = 'adventure-hud';
    this.root.innerHTML = `<div class="adventure-status"><div class="day-seal">${hudIcon('sun')}</div><div class="place-copy"><span id="adventure-time"></span><strong id="adventure-place"></strong></div><button id="adventure-today" aria-label="Open today's journal">${hudIcon('book')}<span>Today <b id="adventure-count"></b></span></button></div><div class="adventure-tools"><div class="adventure-wallet" aria-label="Wallet">${hudIcon('bag')}<strong id="adventure-balance"></strong></div><button id="adventure-menu-open" aria-label="Open game menu">${hudIcon('menu')}<span>Menu</span></button></div><div class="adventure-timer" hidden><small>TIME LEFT</small><strong></strong></div><div class="adventure-keyboard" aria-hidden="true"><kbd>W A S D</kbd><span>Move</span></div><p id="save-message" role="status"></p>`;
    this.menu.id = 'adventure-menu'; this.menu.className = 'adventure-panel'; this.menu.setAttribute('aria-labelledby', 'adventure-menu-title');
    this.menu.innerHTML = `<header class="adventure-panel-head"><div><span class="adventure-overline">A LITTLE TIME FOR YOU</span><h2 id="adventure-menu-title">Arianna<span class="brand-petal">${hudIcon('flower')}</span></h2></div><button class="adventure-close" aria-label="Close menu">${hudIcon('close')}</button></header><div class="adventure-panel-body"><button class="adventure-resume">Back to the adventure ${hudIcon('arrow')}</button><nav class="adventure-destinations" aria-label="Game menu"><button data-journal>${hudIcon('book')}<span><strong>Today's journal</strong><small>Your little things to do</small></span>${hudIcon('arrow')}</button></nav><details class="adventure-help"><summary>How to play</summary><p>Drag the movement stick, or use WASD / arrow keys. Walk close to something, then use the large action button or E / Space. Hold the action button when it says “Hold to clean.”</p><p data-help></p></details><div data-extra></div><p class="adventure-clock-note"></p><div class="adventure-menu-foot"><a href="./asset-credits.html" target="_blank" rel="noopener">Art credits</a></div></div>`;
    this.journal.id = 'adventure-journal'; this.journal.className = 'adventure-panel'; this.journal.setAttribute('aria-labelledby', 'adventure-journal-title');
    this.journal.innerHTML = `<header class="adventure-panel-head"><div><span class="adventure-overline" data-journal-day></span><h2 id="adventure-journal-title">A lovely little day.</h2></div><button class="adventure-close" aria-label="Close journal">${hudIcon('close')}</button></header><div class="adventure-panel-body"><div class="journal-summary">${hudIcon('book')}<span data-summary></span></div><ol class="journal-tasks"></ol><div class="journal-hint"><span class="adventure-overline">A LITTLE NUDGE</span><p data-hint></p></div><p class="adventure-clock-note"></p><button class="adventure-resume">Let's go ${hudIcon('arrow')}</button></div>`;
    this.menu.querySelector('[data-extra]')!.append(...extraMenu);
    this.game.append(this.root, this.menu, this.journal);
    const signal = this.abort.signal;
    this.root.querySelector('#adventure-menu-open')!.addEventListener('click', () => this.open(this.menu), {signal});
    this.root.querySelector('#adventure-today')!.addEventListener('click', () => this.open(this.journal), {signal});
    for (const dialog of [this.menu, this.journal]) {
      for (const button of dialog.querySelectorAll('.adventure-close,.adventure-resume')) button.addEventListener('click', () => this.close(), {signal});
      dialog.addEventListener('cancel', e => { e.preventDefault(); this.close(); }, {signal});
      dialog.addEventListener('close', () => this.resetInput(), {signal});
    }
    this.menu.querySelector('[data-journal]')!.addEventListener('click', () => { this.menu.close(); this.open(this.journal); }, {signal});
    const glyph = document.createElement('span'); glyph.className = 'adventure-action-glyph'; glyph.innerHTML = hudIcon('spark');
    const key = document.createElement('kbd'); key.className = 'adventure-action-key'; key.textContent = 'E';
    document.querySelector('#action-button')?.append(glyph, key);
    addEventListener('pointerdown', e => { this.game.dataset.input = e.pointerType === 'touch' ? 'touch' : 'pointer'; }, {signal});
    addEventListener('keydown', e => {
      if (e.code === 'Tab') this.game.dataset.input = 'keyboard';
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !document.querySelector('dialog[open]')) this.game.dataset.input = 'keyboard';
      if (e.code === 'Escape' && !document.querySelector('dialog[open]')) { e.preventDefault(); this.open(this.menu); }
    }, {signal});
    // Held movement and actions are released whenever any dialog opens or closes.
    this.observer = new MutationObserver(() => this.syncModal());
    this.observer.observe(document.body, {subtree: true, attributes: true, attributeFilter: ['open']});
  }

  get modalOpen() { return !!document.querySelector('dialog[open]'); }
  private syncModal() {
    const opened = this.modalOpen;
    if (opened !== this.hasModal) { this.resetInput(); this.hasModal = opened; }
    this.game.dataset.modal = String(opened);
  }
  open(dialog: HTMLDialogElement) {
    if (this.modalOpen) return;
    if (document.activeElement instanceof HTMLElement && !document.activeElement.closest('dialog')) this.lastFocus = document.activeElement;
    this.resetInput(); dialog.showModal(); this.syncModal();
    dialog.querySelector<HTMLElement>('.adventure-close')!.focus({preventScroll: true});
  }
  close() {
    this.menu.close(); this.journal.close(); this.resetInput();
    if (!this.modalOpen) this.lastFocus?.focus({preventScroll: true});
  }

  private text(scope: ParentNode, selector: string, value: string) { const node = scope.querySelector(selector)!; if (node.textContent !== value) node.textContent = value; }

  update(state: HudState) {
    const done = state.tasks.filter(t => state.completed.has(t.id)).length;
    this.text(this.root, '#adventure-place', state.location);
    this.text(this.root, '#adventure-time', `Day ${state.day} · ${state.time}`);
    this.text(this.root, '#adventure-balance', `$${state.balance}`);
    this.text(this.root, '#adventure-count', `${done}/${state.tasks.length}`);
    this.text(this.root, '#save-message', state.message);
    const night = state.phase === 'night';
    const seal = this.root.querySelector<HTMLElement>('.day-seal')!;
    if (seal.dataset.night !== String(night)) { seal.dataset.night = String(night); seal.innerHTML = hudIcon(night ? 'moon' : 'sun'); }
    const timer = this.root.querySelector<HTMLElement>('.adventure-timer')!;
    timer.hidden = !state.timed; this.text(timer, 'strong', state.remaining); timer.classList.toggle('urgent', state.urgent);
    this.text(this.menu, '[data-help]', state.hint);
    for (const panel of [this.menu, this.journal]) this.text(panel, '.adventure-clock-note', state.clockNote);
    this.text(this.journal, '[data-journal-day]', `DAY ${state.day} · ${state.phase.toUpperCase()}`);
    this.text(this.journal, '[data-summary]', `${done} of ${state.tasks.length} little things done`);
    this.text(this.journal, '[data-hint]', state.hint);
    const signature = JSON.stringify([state.tasks, [...state.completed]]);
    if (signature !== this.taskSignature) {
      this.taskSignature = signature;
      const list = this.journal.querySelector('.journal-tasks')!; list.replaceChildren();
      for (const task of state.tasks) {
        const row = document.createElement('li'), mark = document.createElement('span'), copy = document.createElement('div'), name = document.createElement('strong'), place = document.createElement('small');
        const complete = state.completed.has(task.id);
        row.classList.toggle('done', complete); mark.className = 'journal-check'; mark.textContent = complete ? '✓' : ''; mark.setAttribute('aria-label', complete ? 'Complete' : 'To do');
        name.textContent = task.name; place.textContent = task.room ?? ROOMS[task.id] ?? '';
        copy.append(name); if (place.textContent) copy.append(place); row.append(mark, copy); list.append(row);
      }
    }
    const action = document.querySelector<HTMLButtonElement>('#action-button');
    if (action) {
      action.disabled = !state.action.ready;
      action.dataset.target = state.action.target ?? '';
      const progress = state.action.progress ?? 0;
      action.style.setProperty('--hold-progress', `${progress * 360}deg`); action.classList.toggle('holding', progress > 0);
      this.text(action, '#action-title', state.action.title); this.text(action, '#action-detail', state.action.detail);
    }
    this.game.dataset.action = state.action.ready ? 'ready' : 'idle';
  }

  destroy() { this.observer.disconnect(); this.abort.abort(); this.root.remove(); this.menu.remove(); this.journal.remove(); this.game.classList.remove('adventure-ui'); }
}
