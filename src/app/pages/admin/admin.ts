import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ADMIN_ID } from '../../core/config';
import { GuestService } from '../../core/guest.service';
import { CaseCreateBody, CaseSummary, EvidenceType, LinkResult, OptionCategory } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UiService } from '../../core/ui.service';
import { errorMessage, fmt, pad3, range } from '../../core/util';

interface EvRow {
  type: string;
  title: string;
  body: string;
  url: string;
  guilty: boolean;
}

interface RelRow {
  from: number;
  to: number;
  type: string;
  message: string;
}

export const EVT: [string, string][] = [
  ['photo', 'Photo'], ['doc', 'Document'], ['message', 'Message'], ['call', 'Call'],
  ['video', 'Video'], ['badge', 'Badge'], ['suspect', 'Suspect profile'], ['time', 'Timeline']
];

const EVH: Record<string, string> = {
  photo: 'Describe what the photograph shows…',
  doc: 'The document’s text — one line per row…',
  message: 'The text of the telegram or letter…',
  call: 'Transcript of the call…',
  video: 'Describe what the reel shows…',
  badge: 'One entry per line: 21:30 | Gate passed',
  suspect: 'Line 1: role · age\nLine 2: motives, personality…\nLine 3: Alibi in their own words',
  time: 'One entry per line: 21:30 | The watchman passes'
};

const EVT_TITLE: Record<string, string> = {
  photo: 'Photograph', doc: 'Document', message: 'Message', call: 'Call', video: 'Video',
  badge: 'Brass pass', suspect: 'Suspect', time: 'Timeline'
};

const TYPE_MAP: Record<string, EvidenceType> = {
  photo: 'PHOTO', doc: 'DOCUMENT', message: 'MESSAGE', call: 'CALL', video: 'VIDEO',
  badge: 'BADGE', suspect: 'SUSPECT_PROFILE', time: 'TIMELINE'
};

const lines = (text: string) => text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

@Component({
  selector: 'app-admin',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin.html'
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  private guest = inject(GuestService);
  private toast = inject(ToastService);
  private ui = inject(UiService);
  private router = inject(Router);

  readonly registry = signal<CaseSummary[]>([]);
  readonly solved = signal<number[]>([]);
  readonly sending = signal(false);
  readonly dots = range(5);
  readonly evt = EVT;
  readonly levels = [1, 2, 3, 4, 5];

  stamp = '';
  title = '';
  synopsis = '';
  difficulty = 3;
  timeLimit = 20;
  tutorial = false;
  motive = '';
  method = '';
  weapon = '';
  explanation = '';
  optMotive = '';
  optMethod = '';
  optWeapon = '';
  rows: EvRow[] = [];
  rels: RelRow[] = [];

  protected readonly pad3 = pad3;
  protected readonly fmt = fmt;

  async ngOnInit() {
    this.ui.setMode('admin');
    this.solved.set(this.guest.solvedIds());
    await this.loadRegistry();
  }

  async loadRegistry() {
    try {
      this.registry.set(await this.api.listCases());
    } catch (err) {
      this.toast.show(errorMessage(err), 'c');
    }
  }

  nextId() {
    return this.registry().reduce((m, c) => Math.max(m, c.id), 0) + 1;
  }

  isClosed(c: CaseSummary) {
    return this.solved().includes(c.id);
  }

  placeholder(type: string) {
    return EVH[type];
  }

  urlPlaceholder(type: string) {
    return type === 'call' ? 'Audio URL (optional)' : type === 'suspect' ? 'Portrait URL (optional)' : type === 'video' ? 'Video or poster URL (optional)' : 'Image URL (optional)';
  }

  showUrl(type: string) {
    return ['photo', 'video', 'call', 'suspect'].includes(type);
  }

  addRow(type: string) {
    this.rows.push({ type, title: '', body: '', url: '', guilty: false });
  }

  removeRow(i: number) {
    this.rows.splice(i, 1);
  }

  validRows() {
    return this.rows.filter(r => r.title.trim() || r.body.trim() || r.url.trim());
  }

  rowTitle(r: EvRow) {
    return r.title.trim() || EVT_TITLE[r.type];
  }

  addRel() {
    this.rels.push({ from: 0, to: Math.min(1, Math.max(0, this.validRows().length - 1)), type: 'MATCH', message: '' });
  }

  removeRel(i: number) {
    this.rels.splice(i, 1);
  }

  back() {
    this.router.navigate(['/']);
  }

  soon() {
    this.toast.show('This ledger will be opened in a later sprint.');
  }

  private optionsFor(category: OptionCategory, correct: string, extra: string) {
    const others = lines(extra).filter(o => o.toLowerCase() !== correct.toLowerCase());
    if (!others.length) {
      return [];
    }
    return [correct, ...others].map(text => ({ category, text }));
  }

  private build(): CaseCreateBody | null {
    const title = this.title.trim();
    const motive = this.motive.trim();
    const method = this.method.trim();
    const weapon = this.weapon.trim();
    if (!title) {
      this.toast.show('A case without a name cannot be filed, Administrator.', 'c');
      return null;
    }
    if (!motive || !method || !weapon) {
      this.toast.show('The Solution is the Bureau’s answer key — motive, method and weapon are required.', 'c');
      return null;
    }
    const valid = this.validRows();
    if (!valid.length) {
      this.toast.show('File at least one piece of evidence, Administrator.', 'c');
      return null;
    }
    const suspectRows = valid.filter(r => r.type === 'suspect');
    if (!suspectRows.length) {
      this.toast.show('Add at least one suspect, Administrator.', 'c');
      return null;
    }
    if (suspectRows.filter(r => r.guilty).length !== 1) {
      this.toast.show('Mark exactly one suspect as the guilty party.', 'c');
      return null;
    }
    const rels = this.rels.filter(r => r.from !== r.to && r.from < valid.length && r.to < valid.length);
    return {
      title,
      synopsis: this.synopsis.trim() || 'No synopsis filed — the clerk was feeling terse that day.',
      stamp: this.stamp.trim() || null,
      difficulty: Number(this.difficulty),
      timeLimit: Math.max(1, Number(this.timeLimit) || 20),
      tutorial: this.tutorial,
      motive,
      method,
      weapon,
      explanation: this.explanation.trim() || null,
      evidences: valid.map(r => {
        const body = r.body.trim();
        return {
          title: this.rowTitle(r).slice(0, 150),
          teaser: (lines(body)[0] || '').slice(0, 70) || null,
          content: body || (r.type === 'suspect' ? this.rowTitle(r) : null),
          fileUrl: r.url.trim() || null,
          type: TYPE_MAP[r.type]
        };
      }),
      suspects: suspectRows.map(r => {
        const l = lines(r.body);
        return {
          name: this.rowTitle(r).slice(0, 100),
          role: l[0] || null,
          description: l[1] || null,
          alibi: (l[2] || '').replace(/^alibi\s*[:\-]?\s*/i, '') || null,
          imageUrl: r.url.trim() || null,
          guilty: r.guilty
        };
      }),
      relations: rels.map(r => ({
        fromIndex: Number(r.from),
        toIndex: Number(r.to),
        type: r.type as LinkResult,
        message: r.message.trim() || null
      })),
      answerOptions: [
        ...this.optionsFor('MOTIVE', motive, this.optMotive),
        ...this.optionsFor('METHOD', method, this.optMethod),
        ...this.optionsFor('WEAPON', weapon, this.optWeapon)
      ]
    };
  }

  async submit(event: Event) {
    event.preventDefault();
    const body = this.build();
    if (!body || this.sending()) {
      return;
    }
    this.sending.set(true);
    try {
      const created = await this.api.addCase(ADMIN_ID, body);
      this.toast.show(`Case Nº ${pad3(created.id)} — “${created.title}” — is filed on the desk.`, 'm');
      this.reset();
      await this.loadRegistry();
    } catch (err) {
      this.toast.show(errorMessage(err), 'c');
    } finally {
      this.sending.set(false);
    }
  }

  private reset() {
    this.stamp = '';
    this.title = '';
    this.synopsis = '';
    this.difficulty = 3;
    this.timeLimit = 20;
    this.tutorial = false;
    this.motive = '';
    this.method = '';
    this.weapon = '';
    this.explanation = '';
    this.optMotive = '';
    this.optMethod = '';
    this.optWeapon = '';
    this.rows = [];
    this.rels = [];
  }
}
