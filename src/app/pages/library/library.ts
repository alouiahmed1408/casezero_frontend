import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { GuestService } from '../../core/guest.service';
import { CaseSummary } from '../../core/models';
import { TimerService } from '../../core/timer.service';
import { ToastService } from '../../core/toast.service';
import { FOLDER_TILTS, errorMessage, formatTime, pad3, range, setPageMode } from '../../core/util';

// Home page: the list of cases (folders) and the "opening" animation
@Component({
  selector: 'app-library',
  imports: [RouterLink],
  templateUrl: './library.html'
})
export class LibraryComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private guest = inject(GuestService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private timer = inject(TimerService);

  readonly cases = signal<CaseSummary[]>([]);
  readonly solvedIds = signal<number[]>([]);
  readonly picked = signal<CaseSummary | null>(null); // the case being opened
  // animation steps: '' -> 'enter' -> 'opening' -> 'done'
  readonly step = signal<'' | 'enter' | 'opening' | 'done'>('');
  readonly starting = signal(false);
  readonly dots = range(5); // 5 magnifying glasses for the difficulty

  private searchText = '';
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;
  private animationTimeouts: ReturnType<typeof setTimeout>[] = [];

  protected readonly pad3 = pad3;
  protected readonly formatTime = formatTime;

  async ngOnInit() {
    setPageMode('lib');
    this.timer.stop();
    this.solvedIds.set(this.guest.solvedIds());
    await this.loadCases();
  }

  ngOnDestroy() {
    this.stopAnimation();
  }

  async loadCases() {
    try {
      this.cases.set(await this.api.listCases(this.searchText));
    } catch (err) {
      this.toast.show(errorMessage(err), 'c');
    }
  }

  // wait 250ms after the last key before searching
  onSearch(text: string) {
    this.searchText = text;
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => this.loadCases(), 250);
  }

  tilt(index: number) {
    return FOLDER_TILTS[index % FOLDER_TILTS.length];
  }

  stampAngle(c: CaseSummary) {
    return -(5 + ((c.id * 37) % 60) / 10);
  }

  isClosed(c: CaseSummary) {
    return this.solvedIds().includes(c.id);
  }

  showMessage(message: string) {
    this.toast.show(message);
  }

  // click on a folder: play the opening animation
  openCase(c: CaseSummary) {
    this.picked.set(c);
    this.stopAnimation();
    this.step.set('');
    this.later(() => this.step.set('enter'), 20);
    this.later(() => this.step.set('opening'), 970);
    this.later(() => this.step.set('done'), 1970);
  }

  // click on the background while it plays: jump to the end
  skipAnimation() {
    if (this.step() !== 'done') {
      this.stopAnimation();
      this.step.set('done');
    }
  }

  closeCase() {
    this.stopAnimation();
    this.picked.set(null);
    this.step.set('');
  }

  caption() {
    if (this.step() === 'done') {
      return 'Press the seal to start';
    }
    if (this.step() === 'opening') {
      return 'Opening the case…';
    }
    return 'Getting the case ready…';
  }

  // click on the wax seal: create the investigation and go to the book page
  async startInvestigation(event: Event) {
    event.stopPropagation();
    const c = this.picked();
    if (!c || this.starting()) {
      return;
    }
    this.starting.set(true);
    try {
      const playerId = await this.guest.playerId();
      const investigation = await this.api.startInvestigation(playerId, c.id);
      this.closeCase();
      this.toast.show('Investigation started. Good luck!');
      await this.router.navigate(['/investigation', investigation.id]);
    } catch (err: any) {
      if (err?.status === 404) {
        // the saved player does not exist anymore (database was reset?)
        this.guest.forgetPlayer();
      }
      this.toast.show(errorMessage(err), 'c');
    } finally {
      this.starting.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.picked() && e.key === 'Escape') {
      this.closeCase();
    }
  }

  private later(action: () => void, ms: number) {
    this.animationTimeouts.push(setTimeout(action, ms));
  }

  private stopAnimation() {
    this.animationTimeouts.forEach(t => clearTimeout(t));
    this.animationTimeouts = [];
  }
}
