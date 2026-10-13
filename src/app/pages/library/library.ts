import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { GuestService } from '../../core/guest.service';
import { CaseSummary } from '../../core/models';
import { TimerService } from '../../core/timer.service';
import { ToastService } from '../../core/toast.service';
import { UiService } from '../../core/ui.service';
import { FOLDER_ROTS, errorMessage, fmt, pad3, range } from '../../core/util';

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
  private ui = inject(UiService);
  private timer = inject(TimerService);

  readonly cases = signal<CaseSummary[]>([]);
  readonly solved = signal<number[]>([]);
  readonly picked = signal<CaseSummary | null>(null);
  readonly stage = signal<'' | 'enter' | 'opening' | 'done'>('');
  readonly starting = signal(false);
  readonly dots = range(5);

  private searchHandle: ReturnType<typeof setTimeout> | null = null;
  private seq: ReturnType<typeof setTimeout>[] = [];
  private query = '';

  protected readonly pad3 = pad3;
  protected readonly fmt = fmt;

  async ngOnInit() {
    this.ui.setMode('lib');
    this.timer.stop();
    this.solved.set(this.guest.solvedIds());
    await this.reload();
  }

  ngOnDestroy() {
    this.clearSeq();
  }

  async reload() {
    try {
      this.cases.set(await this.api.listCases(this.query));
    } catch (err) {
      this.toast.show(errorMessage(err), 'c');
    }
  }

  onSearch(value: string) {
    this.query = value;
    if (this.searchHandle) {
      clearTimeout(this.searchHandle);
    }
    this.searchHandle = setTimeout(() => this.reload(), 250);
  }

  rot(i: number) {
    return FOLDER_ROTS[i % FOLDER_ROTS.length];
  }

  stampAngle(c: CaseSummary) {
    return -(5 + ((c.id * 37) % 60) / 10);
  }

  isClosed(c: CaseSummary) {
    return this.solved().includes(c.id);
  }

  soon(msg: string) {
    this.toast.show(msg);
  }

  open(c: CaseSummary) {
    this.picked.set(c);
    this.clearSeq();
    this.stage.set('');
    setTimeout(() => this.stage.set('enter'), 20);
    this.seq.push(setTimeout(() => this.stage.set('opening'), 970));
    this.seq.push(setTimeout(() => this.toFrame3(), 1970));
  }

  toFrame3() {
    this.clearSeq();
    this.stage.set('done');
  }

  close() {
    this.clearSeq();
    this.picked.set(null);
    this.stage.set('');
  }

  caption() {
    const s = this.stage();
    if (s === 'done') {
      return 'Frame III — the case opens · press the seal';
    }
    if (s === 'opening') {
      return 'Frame II — the cover falls open';
    }
    return 'Frame I — the dossier is lifted';
  }

  wrapClick() {
    if (this.stage() !== 'done') {
      this.toFrame3();
    }
  }

  async enterBook(event: Event) {
    event.stopPropagation();
    const c = this.picked();
    if (!c || this.starting()) {
      return;
    }
    this.starting.set(true);
    try {
      const playerId = await this.guest.playerId();
      const investigation = await this.api.startInvestigation(playerId, c.id);
      this.close();
      this.toast.show('The book is open. Nine o’clock and all’s well… for now.');
      await this.router.navigate(['/investigation', investigation.id]);
    } catch (err: any) {
      if (err?.status === 404) {
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
      this.close();
    }
  }

  private clearSeq() {
    this.seq.forEach(clearTimeout);
    this.seq = [];
  }
}
