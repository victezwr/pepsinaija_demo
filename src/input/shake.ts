import * as C from '../config';

/**
 * Turns drags, holds, device motion and the keyboard into one 0..1 shake energy.
 * Shaking is vertical (up and down, like shaking a real bottle). Only back-and-forth strokes
 * count fully: a one-way stroke stops adding after SHAKE_STROKE_CAP.
 */
class ShakeMeter {
  energy = 0;
  /** Smoothed vertical drag velocity in px/s (screen y, down = positive). */
  velocity = 0;
  /** Vertical drag offset in px from the pointer-down point (down = positive). */
  offsetPx = 0;
  active = false;
  touched = false;

  private down = false;
  private downAt = 0;
  private downX = 0;
  private downY = 0;
  private lastY = 0;
  private runPx = 0;
  private runSign = 0;
  private holding = false;
  private keyHeld = false;
  private minDim = 1;

  reset(): void {
    this.energy = 0;
    this.velocity = 0;
    this.offsetPx = 0;
    this.down = false;
    this.holding = false;
    this.keyHeld = false;
    this.touched = false;
    this.runPx = 0;
    this.runSign = 0;
  }

  setViewport(w: number, h: number): void {
    this.minDim = Math.max(1, Math.min(w, h));
  }

  pointerDown(x: number, y: number, nowMs: number): void {
    if (!this.active) return;
    this.down = true;
    this.downAt = nowMs;
    this.downX = x;
    this.downY = this.lastY = y;
    this.runPx = 0;
    this.runSign = 0;
    this.touched = true;
  }

  pointerMove(x: number, y: number, dtS: number): void {
    if (!this.active || !this.down) return;
    const dy = y - this.lastY;
    this.lastY = y;
    this.offsetPx = y - this.downY;
    if (Math.hypot(x - this.downX, y - this.downY) > 14) this.holding = false;
    const sign = Math.sign(dy);
    if (sign !== 0 && sign !== this.runSign) {
      this.runSign = sign;
      this.runPx = 0;
    }
    const cap = C.SHAKE_STROKE_CAP * this.minDim;
    const counted = Math.max(0, Math.min(Math.abs(dy), cap - this.runPx));
    this.runPx += Math.abs(dy);
    this.energy = Math.min(1, this.energy + (counted / this.minDim) * C.SHAKE_DRAG_GAIN);
    if (dtS > 0) this.velocity += (dy / dtS - this.velocity) * Math.min(1, dtS * 18);
  }

  pointerUp(): void {
    this.down = false;
    this.holding = false;
  }

  key(held: boolean): void {
    if (!this.active) return;
    this.keyHeld = held;
    if (held) this.touched = true;
  }

  /** Android device motion; acceleration magnitude without gravity, m/s². */
  motion(magnitude: number): void {
    if (!this.active || magnitude < C.SHAKE_MOTION_THRESHOLD) return;
    this.touched = true;
    this.energy = Math.min(1, this.energy + (magnitude - C.SHAKE_MOTION_THRESHOLD) * C.SHAKE_MOTION_GAIN);
  }

  tick(dtS: number, nowMs: number): number {
    if (!this.active) return this.energy;
    if (this.down && !this.holding && nowMs - this.downAt > C.SHAKE_HOLD_DELAY_MS && Math.abs(this.offsetPx) < 14) {
      this.holding = true;
    }
    if (this.holding) this.energy = Math.min(1, this.energy + C.SHAKE_HOLD_PER_S * dtS);
    else if (this.keyHeld) this.energy = Math.min(1, this.energy + C.SHAKE_KEY_PER_S * dtS);
    else this.energy = Math.max(0, this.energy - C.SHAKE_DECAY_PER_S * dtS);
    if (!this.down) {
      this.offsetPx *= Math.pow(0.002, dtS);
      this.velocity *= Math.pow(0.01, dtS);
    }
    return this.energy;
  }

  get isHolding(): boolean {
    return this.holding || this.keyHeld;
  }
}

export const shake = new ShakeMeter();
