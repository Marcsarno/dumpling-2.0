import {Color, Mesh, MeshBasicMaterial, TorusGeometry, Vector3, type Camera, type Object3D} from 'three';
import './cleanup.css';
import type {Interaction} from '../game/cleanupProps';
import type {InteractionSystem} from '../systems/InteractionSystem';
import type {MissionSystem} from '../systems/MissionSystem';
import {guidanceCandidates} from '../systems/InteractionGuidance';

/**
 * Glowing floor rings and icon labels for what Arianna can do, plus the "+$1" reward pop
 * (PlayCanvas CleanupFeedback): rings show for anything available when her hands are free,
 * the current focus is enlarged, and the destination for a carried item pulses and keeps an
 * edge arrow when it is off screen.
 */
export class CleanupFeedback {
  private readonly geometry = new TorusGeometry(.43, .055, 8, 32).rotateX(Math.PI / 2);
  private readonly glow = new MeshBasicMaterial({color: new Color(1, .81, .42), toneMapped: false});
  private readonly markers: {target: Interaction; ring: Mesh; label: HTMLDivElement}[] = [];
  private readonly popups: {element: HTMLDivElement; point: Vector3; until: number}[] = [];
  private readonly screen = new Vector3();
  readonly layer: HTMLElement;

  constructor(parent: Object3D, private readonly camera: Camera, targets: Interaction[]) {
    this.layer = document.querySelector<HTMLElement>('#cleanup-effects') ?? Object.assign(document.createElement('div'), {id: 'cleanup-effects'});
    if (!this.layer.isConnected) document.querySelector('#game')!.append(this.layer);
    for (const target of targets) {
      const ring = new Mesh(this.geometry, this.glow); ring.name = `${target.name} highlight`; ring.visible = false; ring.renderOrder = 2;
      parent.add(ring);
      const label = document.createElement('div'); label.className = 'cleanup-marker'; label.textContent = target.icon;
      label.dataset.target = target.id; label.setAttribute('aria-hidden', 'true'); label.hidden = true; this.layer.append(label);
      this.markers.push({target, ring, label});
    }
  }

  reward(point: Vector3, text: string, now: number) {
    const element = document.createElement('div'); element.className = 'coin-popup';
    const amount = document.createElement('strong'); amount.textContent = text; element.append(amount);
    for (let i = 0; i < 6; i++) {
      const spark = document.createElement('span'); spark.textContent = '✦';
      spark.style.setProperty('--spark-x', `${Math.sin(i * Math.PI / 3) * 42}px`); spark.style.setProperty('--spark-y', `${Math.cos(i * Math.PI / 3) * 35}px`);
      element.append(spark);
    }
    this.layer.append(element); this.popups.push({element, point: point.clone(), until: now + 950});
  }

  private project(p: Vector3) {
    this.screen.copy(p).project(this.camera);
    return {x: (this.screen.x + 1) / 2 * this.layer.clientWidth, y: (1 - this.screen.y) / 2 * this.layer.clientHeight};
  }

  update(now: number, interactions: InteractionSystem, carried: string | null, hands: Vector3, mission: MissionSystem, show = true) {
    const visible = !document.hidden && !document.querySelector('dialog[open]');
    show = show && visible;
    const width = this.layer.clientWidth, height = this.layer.clientHeight;
    const available = this.markers.map(m => m.target).filter(t => interactions.available(t, carried, mission));
    const primary = guidanceCandidates(available, carried).sort((a, b) => interactions.distance(a, hands) - interactions.distance(b, hands))[0];
    for (const {target, ring, label} of this.markers) {
      const isAvailable = available.includes(target), destination = target === primary;
      const nearby = interactions.focus === target && isAvailable && !(target.id === 'put-tool-away' && primary && primary !== target);
      const ringVisible = show && (nearby || destination || (isAvailable && !carried && target.id !== 'play-lilah'));
      ring.visible = ringVisible;
      if (ringVisible) {
        const s = (destination ? 1.3 : nearby ? 1.1 : .85) + Math.sin(now / 300) * (destination ? .1 : .035);
        ring.position.set(target.anchor.x, .105, target.anchor.z); ring.scale.set(s, 1, s);
      }
      label.classList.toggle('nearby', nearby); label.classList.toggle('destination', destination); label.dataset.guided = String(destination);
      if (!show || (!nearby && !destination) || target.id === 'play-lilah') { label.hidden = true; continue; }
      const s = this.project(target.marker);
      const x = Math.max(30, Math.min(width - 30, s.x)), y = Math.max(height * .29, Math.min(height * .7, s.y));
      const offscreen = x !== s.x || y !== s.y;
      label.hidden = offscreen && !destination;
      if (label.hidden) continue;
      if (label.textContent !== target.icon) label.textContent = target.icon;
      label.classList.toggle('offscreen', offscreen && destination);
      label.style.setProperty('--guide-angle', `${Math.atan2(s.y - y, s.x - x)}rad`);
      label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const popup = this.popups[i];
      if (now >= popup.until) { popup.element.remove(); this.popups.splice(i, 1); continue; }
      if (!visible) continue;
      const s = this.project(popup.point); popup.element.style.left = `${s.x}px`; popup.element.style.top = `${s.y}px`;
    }
  }

  /** Destination label text for the carry hint ("Take teddy to 🧸"). */
  get destinationIcon() { return this.markers.find(m => m.label.classList.contains('destination'))?.target.icon ?? ''; }
  reset() { for (const p of this.popups) p.element.remove(); this.popups.length = 0; }
  hide() { this.reset(); for (const m of this.markers) { m.ring.visible = false; m.label.hidden = true; } }
  dispose() { this.reset(); for (const m of this.markers) { m.ring.removeFromParent(); m.label.remove(); } this.geometry.dispose(); this.glow.dispose(); }
}
