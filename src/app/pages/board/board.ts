import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { GameService } from '../../core/game.service';
import { Item, TYPE_LABEL } from '../../core/items';
import { TimerService } from '../../core/timer.service';
import { ToastService } from '../../core/toast.service';
import { CARD_TILTS, errorMessage, linkKind, pad3, setPageMode } from '../../core/util';

// "Link evidence" page: all the evidence in one place.
// Click a first card, then a second card, and the two are linked.
@Component({
  selector: 'app-board',
  templateUrl: './board.html'
})
export class BoardComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  protected game = inject(GameService);
  private timer = inject(TimerService);
  private toast = inject(ToastService);

  readonly investigationId = Number(this.route.snapshot.paramMap.get('id'));
  readonly typeLabel = TYPE_LABEL;
  readonly firstPick = signal<Item | null>(null);
  readonly sending = signal(false);

  readonly caseNo = computed(() => pad3(this.game.detail()?.summary.id || 0));

  // only real evidence can be linked (not the suspects of the list)
  readonly cards = computed(() => this.game.items().filter(i => i.evidenceId !== null));

  // the links already made, with the titles of the two evidence
  readonly linkList = computed(() => {
    const items = this.game.items();
    const titleOf = (evidenceId: number) => items.find(i => i.evidenceId === evidenceId)?.title || '…';
    return this.game.links().map(link => ({
      kind: linkKind(link),
      from: titleOf(link.fromEvidenceId),
      to: titleOf(link.toEvidenceId),
      message: link.message
    }));
  });

  readonly hint = computed(() => {
    const first = this.firstPick();
    if (first) {
      return `Now click the evidence you want to link with “${first.title}”.`;
    }
    return 'Click a first piece of evidence, then a second one, to link them.';
  });

  private expiredSub?: Subscription;

  async ngOnInit() {
    setPageMode('board');
    try {
      await this.game.loadIfNeeded(this.investigationId);
      const investigation = await this.game.refreshInvestigation(this.investigationId);
      this.game.startTimer(investigation);
    } catch (err) {
      this.toast.show(errorMessage(err), 'c');
      this.router.navigate(['/']);
      return;
    }
    this.expiredSub = this.timer.expired.subscribe(() => this.onTimeUp());
  }

  ngOnDestroy() {
    this.expiredSub?.unsubscribe();
  }

  private async onTimeUp() {
    const over = await this.game.waitUntilOver(this.investigationId);
    if (over) {
      this.toast.show('Time is up!', 'c');
      this.goToAccusation();
    }
  }

  tilt(index: number) {
    return CARD_TILTS[index % CARD_TILTS.length];
  }

  isLinked(item: Item) {
    return this.game.links().some(l => l.fromEvidenceId === item.evidenceId || l.toEvidenceId === item.evidenceId);
  }

  // click on a card
  async pick(item: Item) {
    const first = this.firstPick();

    if (!first) {
      this.firstPick.set(item);
      return;
    }
    if (first.key === item.key) {
      this.firstPick.set(null); // second click on the same card = cancel
      return;
    }
    await this.createLink(first, item);
  }

  private async createLink(a: Item, b: Item) {
    if (this.sending()) {
      return;
    }

    // already linked (in any direction)?
    const alreadyLinked = this.game.links().some(l =>
      (l.fromEvidenceId === a.evidenceId && l.toEvidenceId === b.evidenceId) ||
      (l.fromEvidenceId === b.evidenceId && l.toEvidenceId === a.evidenceId));
    if (alreadyLinked) {
      this.toast.show('These two are already linked.');
      this.firstPick.set(null);
      return;
    }

    this.sending.set(true);
    try {
      const link = await this.api.link(this.investigationId, a.evidenceId!, b.evidenceId!);
      this.game.addLink(link);
      const kind = linkKind(link);
      this.toast.show(link.message, kind === 'p' ? '' : kind);
    } catch (err: any) {
      this.toast.show(errorMessage(err), 'c');
      // 409 = the investigation is over (time out), so go to the result
      if (err?.status === 409) {
        const investigation = await this.game.refreshInvestigation(this.investigationId).catch(() => null);
        if (investigation && investigation.status !== 'IN_PROGRESS') {
          this.timer.zero();
          this.goToAccusation();
        }
      }
    } finally {
      this.firstPick.set(null);
      this.sending.set(false);
    }
  }

  backToBook() {
    this.router.navigate(['/investigation', this.investigationId]);
  }

  goToAccusation() {
    this.router.navigate(['/investigation', this.investigationId, 'accuse']);
  }
}
