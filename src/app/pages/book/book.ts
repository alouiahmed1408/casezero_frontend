import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { GameService } from '../../core/game.service';
import { Item, SECTIONS, SEC_ORDER, SectionId, TYPE_LABEL } from '../../core/items';
import { LinkDto } from '../../core/models';
import { SymrefPipe } from '../../core/symref.pipe';
import { TimerService } from '../../core/timer.service';
import { ToastService } from '../../core/toast.service';
import { UiService } from '../../core/ui.service';
import { ROTS, errorMessage, pad3 } from '../../core/util';

type LinkKind = 'm' | 'c' | 'p';

interface DragState {
  key: string;
  el: HTMLElement;
  sx: number;
  sy: number;
  moved: boolean;
  target: HTMLElement | null;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

@Component({
  selector: 'app-book',
  imports: [SymrefPipe],
  templateUrl: './book.html'
})
export class BookComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  protected game = inject(GameService);
  private timer = inject(TimerService);
  private toast = inject(ToastService);
  private ui = inject(UiService);

  readonly grid = viewChild<ElementRef<HTMLElement>>('grid');
  readonly threads = viewChild<ElementRef<SVGSVGElement>>('threads');

  readonly id = Number(this.route.snapshot.paramMap.get('id'));
  readonly order = SEC_ORDER;
  readonly sections = SECTIONS;
  readonly typeLabel = TYPE_LABEL;
  readonly section = signal<SectionId>('photos');
  readonly shown = signal<SectionId>('photos');
  readonly sel = signal<string | null>(null);
  readonly flip = signal(false);
  readonly sweep = signal(false);
  readonly loaded = signal(false);
  readonly phonoOn = signal(false);
  readonly phonoT = signal(0);

  readonly sectionItems = computed(() => this.game.items().filter(i => i.section === this.shown()));
  readonly selected = computed(() => this.game.items().find(i => i.key === this.sel()) || null);
  readonly caseTitle = computed(() => this.game.detail()?.summary.title || '');
  readonly caseSynopsis = computed(() => this.game.detail()?.summary.synopsis || '');
  readonly caseNo = computed(() => pad3(this.game.detail()?.summary.id || 0));
  readonly ties = computed(() => {
    const it = this.selected();
    if (!it || it.evId === null) {
      return [];
    }
    const items = this.game.items();
    return this.game.links()
      .filter(l => l.fromEvidenceId === it.evId || l.toEvidenceId === it.evId)
      .map(l => {
        const otherId = l.fromEvidenceId === it.evId ? l.toEvidenceId : l.fromEvidenceId;
        return { kind: this.kindOf(l), title: items.find(i => i.evId === otherId)?.title || '…' };
      });
  });

  private expiredSub?: Subscription;
  private phonoHandle: ReturnType<typeof setInterval> | null = null;
  private audio: HTMLAudioElement | null = null;
  private drag: DragState | null = null;
  private tempPath: SVGPathElement | null = null;

  constructor() {
    effect(() => {
      this.game.links();
      this.shown();
      this.game.items();
      this.loaded();
      setTimeout(() => {
        this.drawThreads();
      }, 40);
    });
  }

  async ngOnInit() {
    this.ui.setMode('book');
    try {
      await this.game.load(this.id);
      const inv = this.game.investigation()!;
      const caseNo = pad3(inv.caseId);
      if (inv.status === 'IN_PROGRESS') {
        this.timer.start(inv.remainingSeconds, inv.timeLimitMinutes * 60, caseNo);
      } else {
        this.timer.total.set(inv.timeLimitMinutes * 60);
        this.timer.caseNo.set(caseNo);
        this.timer.freeze(0);
      }
      this.loaded.set(true);
    } catch (err) {
      this.toast.show(errorMessage(err), 'c');
      this.router.navigate(['/']);
      return;
    }
    this.expiredSub = this.timer.expired.subscribe(() => this.onExpired());
  }

  ngOnDestroy() {
    this.expiredSub?.unsubscribe();
    this.stopPhono();
  }

  private async onExpired() {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const inv = await this.game.refreshInvestigation(this.id);
        if (inv.status !== 'IN_PROGRESS') {
          this.toast.show('Time is up — the Bureau frowns upon tardiness.', 'c');
          this.router.navigate(['/investigation', this.id, 'accuse']);
          return;
        }
      } catch {
        return;
      }
      await sleep(1000);
    }
  }

  kindOf(l: LinkDto): LinkKind {
    return l.result === 'MATCH' ? 'm' : l.result === 'CONTRADICTION' ? 'c' : 'p';
  }

  rot(i: number) {
    return ROTS[i % ROTS.length];
  }

  ribbonHeight(i: number) {
    return 196 + (i % 3) * 26;
  }

  sectionNo() {
    return SEC_ORDER.indexOf(this.shown()) + 1;
  }

  knot(it: Item): { cls: string; text: string } | null {
    if (it.evId === null) {
      return null;
    }
    const rel = this.game.links().filter(l => (l.fromEvidenceId === it.evId || l.toEvidenceId === it.evId) && l.result !== 'NONE');
    if (!rel.length) {
      return null;
    }
    const bad = rel.some(l => l.result === 'CONTRADICTION');
    return { cls: bad ? 'c' : 'm', text: (bad ? '✕ ' : '✓ ') + rel.length };
  }

  setSection(id: SectionId) {
    if (id === this.section()) {
      return;
    }
    this.section.set(id);
    this.flip.set(false);
    this.sweep.set(false);
    setTimeout(() => {
      this.flip.set(true);
      this.sweep.set(true);
    }, 20);
    setTimeout(() => {
      this.shown.set(id);
      const cur = this.selected();
      if (cur && cur.section !== id) {
        this.sel.set(null);
        this.stopPhono();
      }
    }, 250);
    setTimeout(() => this.flip.set(false), 580);
  }

  turn(dir: number) {
    const i = SEC_ORDER.indexOf(this.section());
    this.setSection(SEC_ORDER[(i + dir + SEC_ORDER.length) % SEC_ORDER.length]);
  }

  select(key: string) {
    this.stopPhono();
    this.sel.set(key);
  }

  back() {
    this.router.navigate(['/']);
  }

  accuse() {
    this.router.navigate(['/investigation', this.id, 'accuse']);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      this.turn(1);
    }
    if (e.key === 'ArrowLeft') {
      this.turn(-1);
    }
    if (e.key === 'Escape') {
      this.back();
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.drawThreads();
  }

  onPointerDown(e: PointerEvent) {
    const card = (e.target as HTMLElement).closest('.evcard') as HTMLElement | null;
    if (!card) {
      return;
    }
    const key = card.dataset['id']!;
    const it = this.game.items().find(i => i.key === key);
    this.drag = { key, el: card, sx: e.clientX, sy: e.clientY, moved: false, target: null };
    if (it && !it.linkable) {
      return;
    }
    card.setPointerCapture(e.pointerId);
  }

  onPointerMove(e: PointerEvent) {
    const d = this.drag;
    if (!d) {
      return;
    }
    const it = this.game.items().find(i => i.key === d.key);
    if (!it || !it.linkable) {
      return;
    }
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 7) {
      return;
    }
    if (!d.moved) {
      d.moved = true;
      d.el.classList.add('dragging');
    }
    const svg = this.threads()!.nativeElement;
    const gr = svg.getBoundingClientRect();
    const ax = d.el.offsetLeft + d.el.offsetWidth / 2 + 6;
    const ay = d.el.offsetTop + 30 + 6;
    this.drawTemp(ax, ay, e.clientX - gr.left, e.clientY - gr.top);
    const t = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('.evcard') as HTMLElement | null;
    if (d.target && d.target !== t) {
      d.target.classList.remove('drop-hint');
    }
    if (t && t !== d.el) {
      t.classList.add('drop-hint');
      d.target = t;
    } else {
      d.target = null;
    }
  }

  onPointerUp() {
    const d = this.drag;
    if (!d) {
      return;
    }
    if (d.moved) {
      this.clearTemp();
      d.el.classList.remove('dragging');
      if (d.target) {
        d.target.classList.remove('drop-hint');
        this.createLink(d.key, d.target.dataset['id']!);
      }
    } else {
      this.select(d.key);
    }
    this.drag = null;
  }

  onPointerCancel() {
    const d = this.drag;
    if (d) {
      this.clearTemp();
      d.el.classList.remove('dragging');
      d.target?.classList.remove('drop-hint');
      this.drag = null;
    }
  }

  private async createLink(aKey: string, bKey: string) {
    if (aKey === bKey) {
      return;
    }
    const items = this.game.items();
    const a = items.find(i => i.key === aKey);
    const b = items.find(i => i.key === bKey);
    if (!a || !b || a.evId === null || b.evId === null) {
      this.toast.show('Only filed evidence can be tied with a thread.');
      return;
    }
    const tied = this.game.links().some(l =>
      (l.fromEvidenceId === a.evId && l.toEvidenceId === b.evId) || (l.fromEvidenceId === b.evId && l.toEvidenceId === a.evId));
    if (tied) {
      this.toast.show('These two are already tied, Detective.');
      return;
    }
    try {
      const link = await this.api.link(this.id, a.evId, b.evId);
      this.game.addLink(link);
      const kind = this.kindOf(link);
      this.toast.show(link.message, kind === 'p' ? '' : kind);
    } catch (err: any) {
      this.toast.show(errorMessage(err), 'c');
      if (err?.status === 409) {
        const inv = await this.game.refreshInvestigation(this.id).catch(() => null);
        if (inv && inv.status !== 'IN_PROGRESS') {
          this.timer.freeze(0);
          this.router.navigate(['/investigation', this.id, 'accuse']);
        }
      }
    }
  }

  drawThreads() {
    const svgRef = this.threads();
    const gridRef = this.grid();
    if (!svgRef || !gridRef) {
      return;
    }
    const svg = svgRef.nativeElement;
    svg.innerHTML = '';
    this.tempPath = null;
    const centers: Record<string, { x: number; y: number }> = {};
    gridRef.nativeElement.querySelectorAll<HTMLElement>('.evcard').forEach(c => {
      centers[c.dataset['id']!] = { x: c.offsetLeft + c.offsetWidth / 2 + 6, y: c.offsetTop + 30 + 6 };
    });
    const ns = 'http://www.w3.org/2000/svg';
    this.game.links().forEach(l => {
      const A = centers['e' + l.fromEvidenceId];
      const B = centers['e' + l.toEvidenceId];
      if (!A || !B) {
        return;
      }
      const cls = this.kindOf(l);
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2 + Math.min(70, 26 + Math.hypot(B.x - A.x, B.y - A.y) * 0.12);
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', `M ${A.x} ${A.y} Q ${mx} ${my} ${B.x} ${B.y}`);
      p.setAttribute('class', 'th-' + (cls === 'm' ? 'match' : cls === 'c' ? 'contra' : 'plain'));
      svg.appendChild(p);
      if (cls === 'c') {
        const cx = 0.25 * A.x + 0.5 * mx + 0.25 * B.x;
        const cy = 0.25 * A.y + 0.5 * my + 0.25 * B.y;
        const g = document.createElementNS(ns, 'path');
        g.setAttribute('d', `M ${cx - 6} ${cy - 6} l12 12 M ${cx + 6} ${cy - 6} l-12 12`);
        g.setAttribute('stroke', '#6b1400');
        g.setAttribute('stroke-width', '3');
        g.setAttribute('stroke-linecap', 'round');
        svg.appendChild(g);
      }
      [A, B].forEach(P => {
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', String(P.x));
        c.setAttribute('cy', String(P.y));
        c.setAttribute('r', '4.6');
        c.setAttribute('class', 'pin-dot');
        svg.appendChild(c);
      });
    });
  }

  private drawTemp(x1: number, y1: number, x2: number, y2: number) {
    const svg = this.threads()!.nativeElement;
    if (!this.tempPath) {
      this.tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this.tempPath.setAttribute('class', 'th-temp');
      svg.appendChild(this.tempPath);
    }
    this.tempPath.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
  }

  private clearTemp() {
    if (this.tempPath) {
      this.tempPath.remove();
      this.tempPath = null;
    }
  }

  phonoTotal(it: Item) {
    const d = this.audio?.duration;
    return d && isFinite(d) ? Math.floor(d) : it.dur;
  }

  phonoLabel(it: Item) {
    return `0:${String(this.phonoT()).padStart(2, '0')} / 0:${String(this.phonoTotal(it)).padStart(2, '0')}`;
  }

  phonoPercent(it: Item) {
    return (this.phonoT() / Math.max(1, this.phonoTotal(it))) * 100;
  }

  togglePhono(it: Item) {
    if (this.phonoOn()) {
      this.stopPhono();
      return;
    }
    this.phonoOn.set(true);
    this.phonoT.set(0);
    if (it.fileUrl) {
      this.audio = new Audio(it.fileUrl);
      this.audio.onended = () => this.stopPhono();
      this.audio.play().catch(() => this.toast.show('The cylinder will not turn — the recording could not be loaded.', 'c'));
    }
    this.phonoHandle = setInterval(() => {
      const next = this.phonoT() + 1;
      if (!this.audio && next >= it.dur) {
        this.stopPhono();
        return;
      }
      this.phonoT.set(next);
    }, 1000);
  }

  stopPhono() {
    if (this.phonoHandle) {
      clearInterval(this.phonoHandle);
      this.phonoHandle = null;
    }
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.phonoOn.set(false);
    this.phonoT.set(0);
  }
}
