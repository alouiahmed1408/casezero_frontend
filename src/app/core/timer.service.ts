import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { formatTime } from './util';

// The countdown shown in the hourglass box
@Injectable({ providedIn: 'root' })
export class TimerService {
  readonly remaining = signal(0); // seconds left
  readonly total = signal(1); // seconds at the start
  readonly caseNo = signal('000');
  readonly expired = new Subject<void>(); // fires when it reaches 0

  readonly digits = computed(() => formatTime(this.remaining()));
  readonly fraction = computed(() => this.remaining() / this.total());
  readonly urgent = computed(() => this.remaining() > 0 && this.remaining() <= 120);

  private interval: ReturnType<typeof setInterval> | null = null;

  start(remainingSeconds: number, totalSeconds: number, caseNo: string) {
    this.stop();
    this.total.set(Math.max(1, totalSeconds));
    this.remaining.set(Math.max(0, remainingSeconds));
    this.caseNo.set(caseNo);
    if (remainingSeconds > 0) {
      this.interval = setInterval(() => this.tick(), 1000);
    }
  }

  // stops the clock and shows 00:00 (used when the investigation is already over)
  finished(totalSeconds: number, caseNo: string) {
    this.stop();
    this.total.set(Math.max(1, totalSeconds));
    this.caseNo.set(caseNo);
    this.remaining.set(0);
  }

  // stop and show 00:00 without changing the rest
  zero() {
    this.stop();
    this.remaining.set(0);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private tick() {
    const left = this.remaining() - 1;
    this.remaining.set(Math.max(0, left));
    if (left <= 0) {
      this.stop();
      this.expired.next();
    }
  }
}
