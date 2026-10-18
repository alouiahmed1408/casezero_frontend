import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  tone: string; // '' = normal, 'm' = good, 'c' = bad (css classes)
  leaving: boolean;
}

// Little messages shown in the corner of the screen
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  show(message: string, tone = '') {
    const id = this.nextId++;
    this.toasts.update(list => [...list, { id, message, tone, leaving: false }]);

    // after 3.5s play the fade out, then remove it
    setTimeout(() => {
      this.toasts.update(list => list.map(t => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => {
        this.toasts.update(list => list.filter(t => t.id !== id));
      }, 320);
    }, 3500);
  }
}
