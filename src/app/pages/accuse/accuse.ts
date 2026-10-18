import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { GameService } from '../../core/game.service';
import { GuestService } from '../../core/guest.service';
import { OptionCategory, ResultDto, SuspectDto } from '../../core/models';
import { TimerService } from '../../core/timer.service';
import { ToastService } from '../../core/toast.service';
import { errorMessage, pad3, setPageMode } from '../../core/util';

// the three answers (besides the suspect) the player has to give
type FieldKey = 'motive' | 'method' | 'weapon';

const FIELDS: { key: FieldKey; label: string; category: OptionCategory }[] = [
  { key: 'motive', label: 'The Motive', category: 'MOTIVE' },
  { key: 'method', label: 'The Method', category: 'METHOD' },
  { key: 'weapon', label: 'The Weapon', category: 'WEAPON' }
];

// one line of the verdict: the answer and if it was right
interface VerdictRow {
  label: string;
  correct: boolean;
  suspect: SuspectDto | null;
  text: string;
}

interface Verdict {
  stamp: string; // CASE CLOSED / UNSOLVED / TIME OUT
  rows: VerdictRow[];
  score: number;
  total: number;
  perfect: boolean;
  timeout: boolean;
  explanation: string | null;
}

// Accusation page: the player picks the culprit, the motive, the method
// and the weapon, then sees the verdict.
@Component({
  selector: 'app-accuse',
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

  readonly investigationId = Number(this.route.snapshot.paramMap.get('id'));
  readonly fields = FIELDS;
  readonly suspects = computed(() => this.game.detail()?.suspects || []);
  readonly caseNo = computed(() => pad3(this.game.detail()?.summary.id || 0));

  readonly openPicker = signal<string | null>(null); // which dropdown is open
  readonly chosenSuspect = signal<SuspectDto | null>(null);
  readonly chosen = signal<Record<string, string>>({}); // answers picked in a dropdown
  readonly typed = signal<Record<string, string>>({}); // answers typed in a text box
  readonly shake = signal(false);
  readonly verdict = signal<Verdict | null>(null);
  readonly sending = signal(false);

  private expiredSub?: Subscription;

  async ngOnInit() {
    setPageMode('accuse');
    try {
      await this.game.loadIfNeeded(this.investigationId);
      const investigation = await this.game.refreshInvestigation(this.investigationId);
      this.game.startTimer(investigation);
      if (investigation.status !== 'IN_PROGRESS') {
        // already finished: show the saved result
        await this.showSavedResult();
      }
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
      await this.showSavedResult();
    }
  }

  // the answers of the case, if the case has multiple choice for this field
  optionsOf(category: OptionCategory) {
    return (this.game.detail()?.answerOptions || []).filter(o => o.category === category);
  }

  // the answer for a field: from the dropdown if there is one, else from the text box
  answerOf(field: { key: FieldKey; category: OptionCategory }) {
    if (this.optionsOf(field.category).length > 0) {
      return this.chosen()[field.key] || '';
    }
    return (this.typed()[field.key] || '').trim();
  }

  // ---------- verdict ----------

  // shows the verdict from what the server saved (used after a time out or a reload)
  private async showSavedResult() {
    const result = await this.api.getResult(this.investigationId);
    const solution = result.solution;
    const culprit = this.suspects().find(s => s.id === solution.guiltySuspectId) || null;

    const rows: VerdictRow[] = [
      { label: 'The Accused', correct: result.suspectCorrect === true, suspect: culprit, text: solution.guiltySuspectName || '' },
      { label: 'The Motive', correct: result.motiveCorrect === true, suspect: null, text: solution.motive },
      { label: 'The Method', correct: result.methodCorrect === true, suspect: null, text: solution.method },
      { label: 'The Weapon', correct: result.weaponCorrect === true, suspect: null, text: solution.weapon }
    ];
    this.showVerdict(result, rows);
  }

  private showVerdict(result: ResultDto, rows: VerdictRow[]) {
    const perfect = result.status === 'SOLVED';
    const timeout = result.status === 'TIME_OUT';

    if (perfect) {
      // remember it so the folder shows the CLOSED stamp
      const caseId = this.game.detail()?.summary.id;
      if (caseId) {
        this.guest.markSolved(caseId);
      }
    }

    if (timeout) {
      this.timer.zero();
    } else {
      this.timer.stop();
    }

    let stamp = 'UNSOLVED';
    if (perfect) {
      stamp = 'CASE CLOSED';
    } else if (timeout) {
      stamp = 'TIME OUT';
    }

    this.verdict.set({
      stamp,
      rows,
      score: rows.filter(r => r.correct).length,
      total: rows.length,
      perfect,
      timeout,
      explanation: result.solution.explanation
    });
  }

  // ---------- the form ----------

  togglePicker(name: string, e: Event) {
    e.stopPropagation(); // otherwise the document click closes it right away
    this.openPicker.set(this.openPicker() === name ? null : name);
  }

  pickSuspect(suspect: SuspectDto, e: Event) {
    e.stopPropagation();
    this.chosenSuspect.set(suspect);
    this.openPicker.set(null);
  }

  pickAnswer(key: string, value: string, e: Event) {
    e.stopPropagation();
    this.chosen.update(old => ({ ...old, [key]: value }));
    this.openPicker.set(null);
  }

  typeAnswer(key: string, value: string) {
    this.typed.update(old => ({ ...old, [key]: value }));
  }

  // click anywhere else closes the dropdowns
  @HostListener('document:click')
  closePickers() {
    this.openPicker.set(null);
  }

  async submit() {
    const suspect = this.chosenSuspect();
    const answers = FIELDS.map(f => ({ label: f.label, value: this.answerOf(f) }));
    const missingAnswer = answers.some(a => a.value === '');

    if (!suspect || missingAnswer) {
      // restart the shake animation of the button
      this.shake.set(false);
      setTimeout(() => this.shake.set(true), 20);
      this.toast.show('Please fill in every field before accusing.', 'c');
      return;
    }
    if (this.sending()) {
      return;
    }

    this.sending.set(true);
    try {
      const result = await this.api.accuse(this.investigationId, {
        suspectId: suspect.id,
        motive: answers[0].value,
        method: answers[1].value,
        weapon: answers[2].value
      });

      const rows: VerdictRow[] = [
        { label: 'The Accused', correct: result.suspectCorrect === true, suspect, text: suspect.name },
        { label: answers[0].label, correct: result.motiveCorrect === true, suspect: null, text: answers[0].value },
        { label: answers[1].label, correct: result.methodCorrect === true, suspect: null, text: answers[1].value },
        { label: answers[2].label, correct: result.weaponCorrect === true, suspect: null, text: answers[2].value }
      ];
      this.showVerdict(result, rows);

      if (result.status === 'SOLVED') {
        this.toast.show('Case solved! It is now marked as closed.', 'm');
      }
      await this.game.refreshInvestigation(this.investigationId);
    } catch (err: any) {
      this.toast.show(errorMessage(err), 'c');
      // 409 = the time ran out while the player was filling the form
      if (err?.status === 409) {
        const investigation = await this.game.refreshInvestigation(this.investigationId).catch(() => null);
        if (investigation && investigation.status !== 'IN_PROGRESS') {
          await this.showSavedResult().catch(() => undefined);
        }
      }
    } finally {
      this.sending.set(false);
    }
  }

  backToCase() {
    this.router.navigate(['/investigation', this.investigationId]);
  }

  backToCases() {
    this.router.navigate(['/']);
  }
}
