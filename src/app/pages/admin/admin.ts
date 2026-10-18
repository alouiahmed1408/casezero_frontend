import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { ADMIN_ID } from '../../core/config';
import { GuestService } from '../../core/guest.service';
import { CaseCreateBody, CaseSummary, EvidenceType, LinkResult, OptionCategory } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage, formatTime, pad3, range, setPageMode } from '../../core/util';

// one evidence (or suspect) line of the form
interface EvidenceRow {
  type: string;
  title: string;
  body: string;
  url: string;
  guilty: boolean;
}

// one link between two evidences of the form (indexes in the rows list)
interface LinkRow {
  from: number;
  to: number;
  type: string;
  message: string;
}

// [value in the form, label shown in the dropdown]
const EVIDENCE_TYPES: [string, string][] = [
  ['photo', 'Photo'], ['doc', 'Document'], ['message', 'Message'], ['call', 'Call'],
  ['video', 'Video'], ['badge', 'Access pass'], ['suspect', 'Suspect profile'], ['time', 'Timeline']
];

// help text in the big text box, depends on the type
const BODY_HINTS: Record<string, string> = {
  photo: 'Describe what the photo shows…',
  doc: 'Text of the document, one line per row…',
  message: 'Text of the telegram or letter…',
  call: 'Transcript of the call…',
  video: 'Describe what the video shows…',
  badge: 'One entry per line, like: 21:30 | Gate passed',
  suspect: 'Line 1: role and age\nLine 2: description\nLine 3: alibi',
  time: 'One entry per line, like: 21:30 | The watchman passes'
};

const DEFAULT_TITLES: Record<string, string> = {
  photo: 'Photograph', doc: 'Document', message: 'Message', call: 'Call', video: 'Video',
  badge: 'Access pass', suspect: 'Suspect', time: 'Timeline'
};

// form value -> value the backend expects
const BACKEND_TYPES: Record<string, EvidenceType> = {
  photo: 'PHOTO', doc: 'DOCUMENT', message: 'MESSAGE', call: 'CALL', video: 'VIDEO',
  badge: 'BADGE', suspect: 'SUSPECT_PROFILE', time: 'TIMELINE'
};

// splits a text in lines and removes the empty ones
function splitLines(text: string): string[] {
  return text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
}

// Admin page: a form to add a new case + the list of existing cases
@Component({
  selector: 'app-admin',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin.html'
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  private guest = inject(GuestService);
  private toast = inject(ToastService);
  private router = inject(Router);

  readonly cases = signal<CaseSummary[]>([]);
  readonly solvedIds = signal<number[]>([]);
  readonly sending = signal(false);
  readonly dots = range(5);
  readonly evidenceTypes = EVIDENCE_TYPES;
  readonly levels = [1, 2, 3, 4, 5];

  // form fields
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
  otherMotives = ''; // one per line
  otherMethods = '';
  otherWeapons = '';
  rows: EvidenceRow[] = [];
  linkRows: LinkRow[] = [];

  protected readonly pad3 = pad3;
  protected readonly formatTime = formatTime;

  async ngOnInit() {
    setPageMode('admin');
    this.solvedIds.set(this.guest.solvedIds());
    await this.loadCases();
  }

  async loadCases() {
    try {
      this.cases.set(await this.api.listCases());
    } catch (err) {
      this.toast.show(errorMessage(err), 'c');
    }
  }

  // the id the new case will probably get (only for display)
  nextId() {
    let highest = 0;
    for (const c of this.cases()) {
      if (c.id > highest) {
        highest = c.id;
      }
    }
    return highest + 1;
  }

  isClosed(c: CaseSummary) {
    return this.solvedIds().includes(c.id);
  }

  bodyHint(type: string) {
    return BODY_HINTS[type];
  }

  urlHint(type: string) {
    if (type === 'call') {
      return 'Audio URL (optional)';
    }
    if (type === 'suspect') {
      return 'Portrait URL (optional)';
    }
    if (type === 'video') {
      return 'Video or poster URL (optional)';
    }
    return 'Image URL (optional)';
  }

  // only these types can have a file
  showUrl(type: string) {
    return ['photo', 'video', 'call', 'suspect'].includes(type);
  }

  addRow(type: string) {
    this.rows.push({ type, title: '', body: '', url: '', guilty: false });
  }

  removeRow(index: number) {
    this.rows.splice(index, 1);
  }

  // rows that are not completely empty
  filledRows() {
    return this.rows.filter(r => r.title.trim() || r.body.trim() || r.url.trim());
  }

  rowTitle(row: EvidenceRow) {
    return row.title.trim() || DEFAULT_TITLES[row.type];
  }

  addLink() {
    const last = Math.max(0, this.filledRows().length - 1);
    this.linkRows.push({ from: 0, to: Math.min(1, last), type: 'MATCH', message: '' });
  }

  removeLink(index: number) {
    this.linkRows.splice(index, 1);
  }

  backToCases() {
    this.router.navigate(['/']);
  }

  showMessage(message: string) {
    this.toast.show(message);
  }

  // If the admin typed other choices, the player gets a multiple choice
  // (the right answer + the other ones). Otherwise the player types the answer.
  private makeOptions(category: OptionCategory, correct: string, others: string) {
    const wrong = splitLines(others).filter(o => o.toLowerCase() !== correct.toLowerCase());
    if (wrong.length === 0) {
      return [];
    }
    return [correct, ...wrong].map(text => ({ category, text }));
  }

  // checks the form and builds what we send to the backend, null if something is missing
  private buildBody(): CaseCreateBody | null {
    const title = this.title.trim();
    const motive = this.motive.trim();
    const method = this.method.trim();
    const weapon = this.weapon.trim();

    if (!title) {
      this.toast.show('Please enter a title.', 'c');
      return null;
    }
    if (!motive || !method || !weapon) {
      this.toast.show('Motive, method and weapon are required.', 'c');
      return null;
    }
    const filled = this.filledRows();
    if (filled.length === 0) {
      this.toast.show('Add at least one piece of evidence.', 'c');
      return null;
    }
    const suspectRows = filled.filter(r => r.type === 'suspect');
    if (suspectRows.length === 0) {
      this.toast.show('Add at least one suspect.', 'c');
      return null;
    }
    if (suspectRows.filter(r => r.guilty).length !== 1) {
      this.toast.show('Mark exactly one suspect as guilty.', 'c');
      return null;
    }

    // ignore links that point to a row that does not exist or to itself
    const validLinks = this.linkRows.filter(l => l.from !== l.to && l.from < filled.length && l.to < filled.length);

    return {
      title,
      synopsis: this.synopsis.trim() || 'No synopsis.',
      stamp: this.stamp.trim() || null,
      difficulty: Number(this.difficulty),
      timeLimit: Math.max(1, Number(this.timeLimit) || 20),
      tutorial: this.tutorial,
      motive,
      method,
      weapon,
      explanation: this.explanation.trim() || null,
      evidences: filled.map(row => {
        const body = row.body.trim();
        return {
          title: this.rowTitle(row).slice(0, 150),
          teaser: (splitLines(body)[0] || '').slice(0, 70) || null,
          content: body || (row.type === 'suspect' ? this.rowTitle(row) : null),
          fileUrl: row.url.trim() || null,
          type: BACKEND_TYPES[row.type]
        };
      }),
      suspects: suspectRows.map(row => {
        // line 1 = role, line 2 = description, line 3 = alibi
        const l = splitLines(row.body);
        return {
          name: this.rowTitle(row).slice(0, 100),
          role: l[0] || null,
          description: l[1] || null,
          alibi: (l[2] || '').replace(/^alibi\s*[:\-]?\s*/i, '') || null,
          imageUrl: row.url.trim() || null,
          guilty: row.guilty
        };
      }),
      relations: validLinks.map(l => ({
        fromIndex: Number(l.from),
        toIndex: Number(l.to),
        type: l.type as LinkResult,
        message: l.message.trim() || null
      })),
      answerOptions: [
        ...this.makeOptions('MOTIVE', motive, this.otherMotives),
        ...this.makeOptions('METHOD', method, this.otherMethods),
        ...this.makeOptions('WEAPON', weapon, this.otherWeapons)
      ]
    };
  }

  async submit(event: Event) {
    event.preventDefault();
    const body = this.buildBody();
    if (!body || this.sending()) {
      return;
    }
    this.sending.set(true);
    try {
      const created = await this.api.addCase(ADMIN_ID, body);
      this.toast.show(`Case Nº ${pad3(created.id)} "${created.title}" was saved.`, 'm');
      this.resetForm();
      await this.loadCases();
    } catch (err) {
      this.toast.show(errorMessage(err), 'c');
    } finally {
      this.sending.set(false);
    }
  }

  private resetForm() {
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
    this.otherMotives = '';
    this.otherMethods = '';
    this.otherWeapons = '';
    this.rows = [];
    this.linkRows = [];
  }
}
