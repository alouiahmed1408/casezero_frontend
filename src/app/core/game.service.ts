import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Item, buildItems } from './items';
import { CaseDetail, Investigation, LinkDto } from './models';

@Injectable({ providedIn: 'root' })
export class GameService {
  private api = inject(ApiService);

  readonly investigation = signal<Investigation | null>(null);
  readonly detail = signal<CaseDetail | null>(null);
  readonly links = signal<LinkDto[]>([]);
  readonly items = computed<Item[]>(() => (this.detail() ? buildItems(this.detail()!) : []));

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

  async ensure(id: number) {
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
}
