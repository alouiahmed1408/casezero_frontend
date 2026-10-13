import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  msg: string;
  tone: string;
  out: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(msg: string, tone = '') {
    const id = ++this.seq;
    this.toasts.update(list => [...list, { id, msg, tone, out: false }]);
    setTimeout(() => {
      this.toasts.update(list => list.map(t => (t.id === id ? { ...t, out: true } : t)));
      setTimeout(() => this.toasts.update(list => list.filter(t => t.id !== id)), 320);
    }, 3600);
  }
}
