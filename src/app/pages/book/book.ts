import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { GameService } from '../../core/game.service';
import { Item, SECTIONS, SECTION_ORDER, SectionId, TYPE_LABEL } from '../../core/items';
import { TimerService } from '../../core/timer.service';
import { ToastService } from '../../core/toast.service';
import { CARD_TILTS, LinkKind, errorMessage, linkKind, pad3, setPageMode } from '../../core/util';

// how many cards we show on the left page, so the text is never cut
const CARDS_PER_PAGE = 4;

// The book page: evidence cards on the left, the selected evidence on the right.
// (Linking two pieces of evidence is done in the "Link evidence" page.)
@Component({
  selector: 'app-book',
  templateUrl: './book.html'
})
export class BookComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected game = inject(GameService);
  private timer = inject(TimerService);
  private toast = inject(ToastService);

  readonly investigationId = Number(this.route.snapshot.paramMap.get('id'));
  readonly sectionOrder = SECTION_ORDER;
  readonly sections = SECTIONS;
  readonly typeLabel = TYPE_LABEL;

  // "section" changes right away (highlight of the tab),
  // "shownSection" changes in the middle of the page flip animation
  readonly section = signal<SectionId>('photos');
  readonly shownSection = signal<SectionId>('photos');
  readonly page = signal(0); // page of cards inside the section
  readonly selectedKey = signal<string | null>(null);
  readonly zoomed = signal<Item | null>(null); // the picture shown big
  readonly flip = signal(false);
  readonly sweep = signal(false);
  readonly loaded = signal(false);

  // phonograph (audio player for the calls)
  readonly playing = signal(false);
  readonly playSeconds = signal(0);

  readonly sectionItems = computed(() => this.game.items().filter(i => i.section === this.shownSection()));
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.sectionItems().length / CARDS_PER_PAGE)));
  readonly pageItems = computed(() => {
    const start = this.page() * CARDS_PER_PAGE;
    return this.sectionItems().slice(start, start + CARDS_PER_PAGE);
  });
  readonly selected = computed(() => this.game.items().find(i => i.key === this.selectedKey()) || null);
  readonly caseTitle = computed(() => this.game.detail()?.summary.title || '');
  readonly caseSynopsis = computed(() => this.game.detail()?.summary.synopsis || '');
  readonly caseNo = computed(() => pad3(this.game.detail()?.summary.id || 0));

  // the links of the selected card, shown under its details
  readonly linkedItems = computed(() => {
    const item = this.selected();
    if (!item || item.evidenceId === null) {
      return [];
    }
    const result: { kind: LinkKind; title: string }[] = [];
    for (const link of this.game.links()) {
      if (link.fromEvidenceId !== item.evidenceId && link.toEvidenceId !== item.evidenceId) {
        continue;
      }
      const otherId = link.fromEvidenceId === item.evidenceId ? link.toEvidenceId : link.fromEvidenceId;
      const other = this.game.items().find(i => i.evidenceId === otherId);
      result.push({ kind: linkKind(link), title: other?.title || '…' });
    }
    return result;
  });

  private expiredSub?: Subscription;
  private playInterval: ReturnType<typeof setInterval> | null = null;
  private audio: HTMLAudioElement | null = null;

  async ngOnInit() {
    setPageMode('book');
    try {
      await this.game.load(this.investigationId);
      this.game.startTimer(this.game.investigation()!);
      this.loaded.set(true);
    } catch (err) {
      this.toast.show(errorMessage(err), 'c');
      this.router.navigate(['/']);
      return;
    }
    this.expiredSub = this.timer.expired.subscribe(() => this.onTimeUp());
  }

  ngOnDestroy() {
    this.expiredSub?.unsubscribe();
    this.stopAudio();
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

  // the small "✓ 2" / "✕ 1" label on a card
  linkBadge(item: Item): { cls: string; text: string } | null {
    if (item.evidenceId === null) {
      return null;
    }
    const related = this.game.links().filter(l =>
      (l.fromEvidenceId === item.evidenceId || l.toEvidenceId === item.evidenceId) && l.result !== 'NONE');
    if (related.length === 0) {
      return null;
    }
    const hasContradiction = related.some(l => l.result === 'CONTRADICTION');
    return {
      cls: hasContradiction ? 'c' : 'm',
      text: (hasContradiction ? '✕ ' : '✓ ') + related.length
    };
  }

  // ---------- sections and pages ----------

  setSection(id: SectionId) {
    if (id === this.section()) {
      return;
    }
    this.section.set(id);

    // restart the flip animation
    this.flip.set(false);
    this.sweep.set(false);
    setTimeout(() => {
      this.flip.set(true);
      this.sweep.set(true);
    }, 20);

    // swap the content when the page is half turned
    setTimeout(() => {
      this.shownSection.set(id);
      this.page.set(0);
      const current = this.selected();
      if (current && current.section !== id) {
        this.selectedKey.set(null);
        this.stopAudio();
      }
    }, 250);

    setTimeout(() => this.flip.set(false), 580);
  }

  // direction: 1 = next section, -1 = previous (loops around)
  turn(direction: number) {
    const count = SECTION_ORDER.length;
    const index = SECTION_ORDER.indexOf(this.section());
    this.setSection(SECTION_ORDER[(index + direction + count) % count]);
  }

  // direction: 1 = next page of cards, -1 = previous
  changePage(direction: number) {
    const next = this.page() + direction;
    if (next >= 0 && next < this.pageCount()) {
      this.page.set(next);
    }
  }

  select(key: string) {
    this.stopAudio();
    this.selectedKey.set(key);
  }

  // go back to the text about the case
  showSummary() {
    this.stopAudio();
    this.selectedKey.set(null);
  }

  // ---------- big picture ----------

  zoom(item: Item) {
    this.zoomed.set(item);
  }

  closeZoom() {
    this.zoomed.set(null);
  }

  // ---------- navigation ----------

  backToCases() {
    this.router.navigate(['/']);
  }

  goToBoard() {
    this.router.navigate(['/investigation', this.investigationId, 'board']);
  }

  goToAccusation() {
    this.router.navigate(['/investigation', this.investigationId, 'accuse']);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      // Escape closes the big picture first
      if (this.zoomed()) {
        this.closeZoom();
      } else {
        this.backToCases();
      }
    } else if (!this.zoomed() && e.key === 'ArrowRight') {
      this.turn(1);
    } else if (!this.zoomed() && e.key === 'ArrowLeft') {
      this.turn(-1);
    }
  }

  // ---------- phonograph (calls) ----------

  // length of the recording: real one if the audio is loaded, else the fake one
  audioLength(item: Item) {
    const real = this.audio?.duration;
    return real && isFinite(real) ? Math.floor(real) : item.seconds;
  }

  timeLabel(item: Item) {
    const now = String(this.playSeconds()).padStart(2, '0');
    const end = String(this.audioLength(item)).padStart(2, '0');
    return `0:${now} / 0:${end}`;
  }

  progressPercent(item: Item) {
    return (this.playSeconds() / Math.max(1, this.audioLength(item))) * 100;
  }

  togglePlay(item: Item) {
    if (this.playing()) {
      this.stopAudio();
      return;
    }
    this.playing.set(true);
    this.playSeconds.set(0);

    if (item.fileUrl) {
      this.audio = new Audio(item.fileUrl);
      this.audio.onended = () => this.stopAudio();
      this.audio.play().catch(() => this.toast.show('The audio could not be loaded.', 'c'));
    }

    this.playInterval = setInterval(() => {
      const next = this.playSeconds() + 1;
      // without a real audio file we stop at the fake duration
      if (!this.audio && next >= item.seconds) {
        this.stopAudio();
        return;
      }
      this.playSeconds.set(next);
    }, 1000);
  }

  stopAudio() {
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.playing.set(false);
    this.playSeconds.set(0);
  }
}
