import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Item, buildItems } from './items';
import { CaseDetail, Investigation, LinkDto } from './models';
import { TimerService } from './timer.service';
import { pad3, wait } from './util';

// Keeps the data of the current investigation so the book page
// and the accuse page can share it.
@Injectable({ providedIn: 'root' })
export class GameService {
  private api = inject(ApiService);
  private timer = inject(TimerService);

  readonly investigation = signal<Investigation | null>(null);
  readonly detail = signal<CaseDetail | null>(null);
  readonly links = signal<LinkDto[]>([]);

  // the evidence converted to what the book page displays
  readonly items = computed<Item[]>(() => {
    const detail = this.detail();
    return detail ? buildItems(detail) : [];
  });

  async load(id: number) {
    const [investigation, detail, links] = await Promise.all([
      this.api.getInvestigation(id),
      this.api.getCaseDetail(id),
      this.api.getLinks(id)
    ]);
    this.investigation.set(investigation);
    this.detail.set(detail);
    this.links.set(links);
  }

  // load only if we don't already have this investigation
  async loadIfNeeded(id: number) {
    if (this.investigation()?.id !== id || !this.detail()) {
      await this.load(id);
    }
  }

  async refreshInvestigation(id: number) {
    const investigation = await this.api.getInvestigation(id);
    this.investigation.set(investigation);
    return investigation;
  }

  addLink(link: LinkDto) {
    this.links.update(list => [...list, link]);
  }

  // Starts the countdown from what the server says.
  // If the investigation is already over, the clock shows 00:00.
  startTimer(investigation: Investigation) {
    const total = investigation.timeLimitMinutes * 60;
    const caseNo = pad3(investigation.caseId);
    if (investigation.status === 'IN_PROGRESS') {
      this.timer.start(investigation.remainingSeconds, total, caseNo);
    } else {
      this.timer.finished(total, caseNo);
    }
  }

  // When the clock hits 0 the server may need a moment to mark the
  // investigation as TIME_OUT, so we ask a few times.
  // Returns true once the server says it is over.
  async waitUntilOver(id: number): Promise<boolean> {
    for (let i = 0; i < 6; i++) {
      try {
        const investigation = await this.refreshInvestigation(id);
        if (investigation.status !== 'IN_PROGRESS') {
          return true;
        }
      } catch {
        return false;
      }
      await wait(1000);
    }
    return false;
  }
}
