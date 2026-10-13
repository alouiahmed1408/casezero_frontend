import { Injectable, computed, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { fmt } from './util';

@Injectable({ providedIn: 'root' })
export class TimerService {
  readonly remaining = signal(0);
  readonly total = signal(1);
  readonly caseNo = signal('000');
  readonly expired = new Subject<void>();

  readonly digits = computed(() => fmt(Math.max(0, this.remaining())));
  readonly fraction = computed(() => (this.total() ? this.remaining() / this.total() : 0));
  readonly urgent = computed(() => this.remaining() <= 120 && this.remaining() > 0);

  private handle: ReturnType<typeof setInterval> | null = null;

  start(remainingSeconds: number, totalSeconds: number, caseNo: string) {
    this.stop();
    this.total.set(Math.max(1, totalSeconds));
    this.remaining.set(Math.max(0, remainingSeconds));
    this.caseNo.set(caseNo);
    if (remainingSeconds <= 0) {
      return;
    }
    this.handle = setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.handle) {
      clearInterval(this.handle);
      this.handle = null;
    }
  }

  freeze(remainingSeconds: number) {
    this.stop();
    this.remaining.set(Math.max(0, remainingSeconds));
  }

  private tick() {
    const next = this.remaining() - 1;
    this.remaining.set(Math.max(0, next));
    if (next <= 0) {
      this.stop();
      this.expired.next();
    }
  }
}
