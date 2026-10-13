import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

const PLAYER_KEY = 'casezero.playerId';
const SOLVED_KEY = 'casezero.solved';

@Injectable({ providedIn: 'root' })
export class GuestService {
  private api = inject(ApiService);

  async playerId(): Promise<number> {
    const stored = localStorage.getItem(PLAYER_KEY);
    if (stored) {
      return Number(stored);
    }
    const tag = Math.random().toString(36).slice(2, 8);
    const player = await this.api.createPlayer(`detective-${tag}`, `detective-${tag}@guest.casezero`);
    localStorage.setItem(PLAYER_KEY, String(player.id));
    return player.id;
  }

  forgetPlayer() {
    localStorage.removeItem(PLAYER_KEY);
  }

  solvedIds(): number[] {
    try {
      return JSON.parse(localStorage.getItem(SOLVED_KEY) || '[]');
    } catch {
      return [];
    }
  }

  markSolved(caseId: number) {
    const ids = new Set(this.solvedIds());
    ids.add(caseId);
    localStorage.setItem(SOLVED_KEY, JSON.stringify([...ids]));
  }
}
