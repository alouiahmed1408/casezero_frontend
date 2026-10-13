import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { GameService } from '../../core/game.service';
import { GuestService } from '../../core/guest.service';
import { OptionCategory, ResultDto, SuspectDto } from '../../core/models';
import { SymrefPipe } from '../../core/symref.pipe';
import { TimerService } from '../../core/timer.service';
import { ToastService } from '../../core/toast.service';
import { UiService } from '../../core/ui.service';
import { errorMessage, pad3 } from '../../core/util';

type FieldKey = 'motive' | 'method' | 'weapon';

interface VerdictRow {
  label: string;
  ok: boolean;
  suspect: SuspectDto | null;
  text: string;
}

interface Verdict {
  stamp: string;
  rows: VerdictRow[];
  score: number;
  total: number;
  perfect: boolean;
  timeout: boolean;
  explanation: string | null;
}

const FIELDS: { key: FieldKey; label: string; category: OptionCategory }[] = [
  { key: 'motive', label: 'The Motive', category: 'MOTIVE' },
  { key: 'method', label: 'The Method', category: 'METHOD' },
  { key: 'weapon', label: 'The Weapon', category: 'WEAPON' }
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

@Component({
  selector: 'app-accuse',
  imports: [SymrefPipe],
  templateUrl: './accuse.html'
})
export class AccuseComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private game = inject(GameService);
  private guest = inject(GuestService);
  private timer = inject(TimerService);
  private toast = inject(ToastService);
  private ui = inject(UiService);

  readonly id = Number(this.route.snapshot.paramMap.get('id'));
  readonly fields = FIELDS;
  readonly suspects = computed(() => this.game.detail()?.suspects || []);
  readonly caseNo = computed(() => pad3(this.game.detail()?.summary.id || 0));
  readonly open = signal<string | null>(null);
  readonly chosenSuspect = signal<SuspectDto | null>(null);
  readonly chosen = signal<Record<string, string>>({});
  readonly typed = signal<Record<string, string>>({});
  readonly shake = signal(false);
  readonly verdict = signal<Verdict | null>(null);
  readonly sending = signal(false);

  private expiredSub?: Subscription;

  optionsOf(category: OptionCategory) {
    return (this.game.detail()?.answerOptions || []).filter(o => o.category === category);
  }

  async ngOnInit() {
    this.ui.setMode('accuse');
    try {
      await this.game.ensure(this.id);
      const inv = await this.game.refreshInvestigation(this.id);
      const caseNo = pad3(inv.caseId);
      if (inv.status === 'IN_PROGRESS') {
        this.timer.start(inv.remainingSeconds, inv.timeLimitMinutes * 60, caseNo);
      } else {
        this.timer.total.set(inv.timeLimitMinutes * 60);
        this.timer.caseNo.set(caseNo);
        this.timer.freeze(0);
        await this.showStoredResult();
      }
    } catch (err) {
      this.toast.show(errorMessage(err), 'c');
      this.router.navigate(['/']);
      return;
    }
    this.expiredSub = this.timer.expired.subscribe(() => this.onExpired());
  }

  ngOnDestroy() {
    this.expiredSub?.unsubscribe();
  }

  private async onExpired() {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const inv = await this.game.refreshInvestigation(this.id);
        if (inv.status !== 'IN_PROGRESS') {
          this.toast.show('Time is up — the Bureau frowns upon tardiness.', 'c');
          await this.showStoredResult();
          return;
        }
      } catch {
        return;
      }
      await sleep(1000);
    }
  }

  private suspectById(id: number | null) {
    return this.suspects().find(s => s.id === id) || null;
  }

  private async showStoredResult() {
    const result = await this.api.getResult(this.id);
    const sol = result.solution;
    const timeout = result.status === 'TIME_OUT';
    const flags = [result.suspectCorrect, result.motiveCorrect, result.methodCorrect, result.weaponCorrect];
    const rows: VerdictRow[] = [
      { label: 'The Accused', ok: flags[0] === true, suspect: this.suspectById(sol.guiltySuspectId), text: sol.guiltySuspectName || '' },
      { label: 'The Motive', ok: flags[1] === true, suspect: null, text: sol.motive },
      { label: 'The Method', ok: flags[2] === true, suspect: null, text: sol.method },
      { label: 'The Weapon', ok: flags[3] === true, suspect: null, text: sol.weapon }
    ];
    this.finish(result, rows, timeout);
  }

  private finish(result: ResultDto, rows: VerdictRow[], timeout: boolean) {
    const score = rows.filter(r => r.ok).length;
    const perfect = result.status === 'SOLVED';
    if (perfect) {
      const caseId = this.game.detail()?.summary.id;
      if (caseId) {
        this.guest.markSolved(caseId);
      }
    }
    if (timeout) {
      this.timer.freeze(0);
    } else {
      this.timer.stop();
    }
    this.verdict.set({
      stamp: perfect ? 'CASE CLOSED' : timeout ? 'TIME OUT' : 'UNSOLVED',
      rows, score, total: rows.length, perfect, timeout,
      explanation: result.solution.explanation
    });
  }

  toggle(key: string, e: Event) {
    e.stopPropagation();
    this.open.set(this.open() === key ? null : key);
  }

  pickSuspect(s: SuspectDto, e: Event) {
    e.stopPropagation();
    this.chosenSuspect.set(s);
    this.open.set(null);
  }

  pick(key: string, value: string, e: Event) {
    e.stopPropagation();
    this.chosen.update(c => ({ ...c, [key]: value }));
    this.open.set(null);
  }

  type(key: string, value: string) {
    this.typed.update(c => ({ ...c, [key]: value }));
  }

  answer(key: FieldKey, category: OptionCategory) {
    return this.optionsOf(category).length ? (this.chosen()[key] || '') : (this.typed()[key] || '').trim();
  }

  @HostListener('document:click')
  closePickers() {
    this.open.set(null);
  }

  async submit() {
    const suspect = this.chosenSuspect();
    const answers = FIELDS.map(f => ({ ...f, value: this.answer(f.key, f.category) }));
    if (!suspect || answers.some(a => !a.value)) {
      this.shake.set(false);
      setTimeout(() => this.shake.set(true), 20);
      this.toast.show('The form is incomplete, Detective. The magistrate abhors a blank.', 'c');
      return;
    }
    if (this.sending()) {
      return;
    }
    this.sending.set(true);
    try {
      const result = await this.api.accuse(this.id, {
        suspectId: suspect.id,
        motive: answers[0].value,
        method: answers[1].value,
        weapon: answers[2].value
      });
      const flags = [result.motiveCorrect, result.methodCorrect, result.weaponCorrect];
      const rows: VerdictRow[] = [
        { label: 'The Accused', ok: result.suspectCorrect === true, suspect, text: suspect.name },
        ...answers.map((a, i) => ({ label: a.label, ok: flags[i] === true, suspect: null, text: a.value }))
      ];
      this.finish(result, rows, false);
      if (result.status === 'SOLVED') {
        this.toast.show('The Bureau marks this case CLOSED in the registry.', 'm');
      }
      await this.game.refreshInvestigation(this.id);
    } catch (err: any) {
      this.toast.show(errorMessage(err), 'c');
      if (err?.status === 409) {
        const inv = await this.game.refreshInvestigation(this.id).catch(() => null);
        if (inv && inv.status !== 'IN_PROGRESS') {
          await this.showStoredResult().catch(() => undefined);
        }
      }
    } finally {
      this.sending.set(false);
    }
  }

  reopen() {
    this.router.navigate(['/investigation', this.id]);
  }

  archives() {
    this.router.navigate(['/']);
  }
}
