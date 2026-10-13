import { CaseDetail, EvidenceDto, EvidenceType, SuspectDto } from './models';

export type ItemType = 'photo' | 'doc' | 'tel' | 'hand' | 'call' | 'vid' | 'badge' | 'suspect' | 'time';
export type SectionId = 'photos' | 'documents' | 'messages' | 'calls' | 'videos' | 'badges' | 'suspects' | 'timeline';

export interface Item {
  key: string;
  evId: number | null;
  type: ItemType;
  section: SectionId;
  icon: string;
  title: string;
  tease: string;
  body: string;
  scene: string;
  img: string | null;
  fileUrl: string | null;
  videoFile: boolean;
  cap: string;
  lines: string[];
  hand: string;
  wireNo: string;
  dur: number;
  rows: string[][];
  role: string;
  desc: string;
  alibi: string;
  por: string;
  linkable: boolean;
}

export const SEC_ORDER: SectionId[] = ['photos', 'documents', 'messages', 'calls', 'videos', 'badges', 'suspects', 'timeline'];

export const SECTIONS: Record<SectionId, { label: string; color: string; icon: string }> = {
  photos: { label: 'Photographs', color: '#D76A00', icon: 'i-photo' },
  documents: { label: 'Documents', color: '#B82E00', icon: 'i-doc' },
  messages: { label: 'Messages', color: '#D76A00', icon: 'i-msg' },
  calls: { label: 'Calls', color: '#7F4816', icon: 'i-call' },
  videos: { label: 'Videos', color: '#B82E00', icon: 'i-video' },
  badges: { label: 'Badges', color: '#D76A00', icon: 'i-badge' },
  suspects: { label: 'Suspects', color: '#B82E00', icon: 'i-suspect' },
  timeline: { label: 'Timeline', color: '#7F4816', icon: 'i-time' }
};

export const TYPE_LABEL: Record<ItemType, string> = {
  photo: 'Photograph', doc: 'Document', tel: 'Telegram', hand: 'Letter', call: 'Phonograph',
  vid: 'Kinetoscope', badge: 'Brass Pass', suspect: 'Suspect', time: 'Timeline'
};

const SCENES = ['scn-workshop', 'scn-tower', 'scn-boot', 'scn-alley'];
const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i;
const VIDEO_RE = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;

const lines = (text: string | null) => (text || '').split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

const rowsOf = (text: string | null) =>
  lines(text).map(l => {
    const i = l.indexOf('|');
    return i < 0 ? ['', l] : [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  });

const blank = (key: string, type: ItemType, section: SectionId, icon: string, title: string): Item => ({
  key, evId: null, type, section, icon, title, tease: '', body: '', scene: SCENES[0], img: null, fileUrl: null,
  videoFile: false, cap: title, lines: [], hand: '', wireNo: '', dur: 20, rows: [], role: '', desc: '', alibi: '',
  por: 'por-1', linkable: true
});

const shorten = (s: string, n = 78) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

function fromEvidence(e: EvidenceDto): Item {
  const content = e.content || '';
  const first = lines(content)[0] || '';
  const tease = e.teaser || shorten(first) || e.title;
  const scene = SCENES[e.id % SCENES.length];
  const common = (type: ItemType, section: SectionId, icon: string): Item => ({
    ...blank('e' + e.id, type, section, icon, e.title),
    evId: e.id, tease, scene, fileUrl: e.fileUrl, body: content
  });
  switch (e.type as EvidenceType) {
    case 'PHOTO': {
      const it = common('photo', 'photos', 'i-photo');
      it.img = e.fileUrl;
      return it;
    }
    case 'DOCUMENT': {
      const it = common('doc', 'documents', 'i-doc');
      it.lines = lines(content).length ? lines(content) : ['See the attached document.'];
      it.img = e.fileUrl && IMAGE_RE.test(e.fileUrl) ? e.fileUrl : null;
      return it;
    }
    case 'MESSAGE': {
      if (/\bSTOP\b/.test(content)) {
        const it = common('tel', 'messages', 'i-msg');
        it.wireNo = 'Nº ' + (1000 + e.id);
        return it;
      }
      const it = common('hand', 'messages', 'i-msg');
      it.hand = content || e.title;
      it.body = 'Filed by the Bureau.';
      return it;
    }
    case 'CALL': {
      const it = common('call', 'calls', 'i-call');
      it.dur = Math.min(59, Math.max(12, Math.round(content.length / 12)));
      return it;
    }
    case 'VIDEO': {
      const it = common('vid', 'videos', 'i-video');
      it.videoFile = !!e.fileUrl && VIDEO_RE.test(e.fileUrl);
      it.img = e.fileUrl && IMAGE_RE.test(e.fileUrl) ? e.fileUrl : null;
      return it;
    }
    case 'BADGE': {
      const it = common('badge', 'badges', 'i-badge');
      it.rows = rowsOf(content).filter(r => r[0]);
      return it;
    }
    case 'SUSPECT_PROFILE': {
      const it = common('suspect', 'suspects', 'i-suspect');
      const l = lines(content);
      it.role = l[0] || 'Person of interest';
      it.desc = l[1] || '';
      it.alibi = (l[2] || '').replace(/^alibi\s*[:\-]?\s*/i, '');
      it.por = 'por-' + (1 + (e.id % 3));
      it.img = e.fileUrl;
      it.tease = e.teaser || shorten(it.desc || it.role);
      return it;
    }
    default: {
      const it = common('time', 'timeline', 'i-time');
      it.rows = rowsOf(content);
      return it;
    }
  }
}

function fromSuspect(s: SuspectDto): Item {
  const it = blank('s' + s.id, 'suspect', 'suspects', 'i-suspect', s.name);
  it.role = s.role || 'Person of interest';
  it.desc = s.description || '';
  it.alibi = s.alibi || '';
  it.por = 'por-' + (1 + (s.id % 3));
  it.img = s.imageUrl;
  it.tease = shorten(it.desc || it.role);
  it.linkable = false;
  return it;
}

export function buildItems(detail: CaseDetail): Item[] {
  const items = detail.evidences.map(fromEvidence);
  if (!items.some(i => i.type === 'suspect')) {
    detail.suspects.forEach(s => items.push(fromSuspect(s)));
  }
  return items;
}
