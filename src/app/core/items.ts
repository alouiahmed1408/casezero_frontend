import { CaseDetail, EvidenceDto, SuspectDto } from './models';

// The backend sends evidence (photo, document, ...). The book page needs
// a bit more than that (which section, which icon, the lines of text, ...),
// so each evidence is converted to an "Item" here.

export type ItemType = 'photo' | 'doc' | 'tel' | 'hand' | 'call' | 'vid' | 'badge' | 'suspect' | 'time';
export type SectionId = 'photos' | 'documents' | 'messages' | 'calls' | 'videos' | 'badges' | 'suspects' | 'timeline';

export interface Item {
  key: string; // "e12" for evidence 12, "s3" for suspect 3
  evidenceId: number | null; // null when it is a suspect without evidence
  type: ItemType;
  section: SectionId;
  icon: string;
  title: string;
  teaser: string; // short text shown on the card
  body: string; // full text
  scene: string; // name of the svg drawing used as a picture
  image: string | null;
  fileUrl: string | null;
  isVideoFile: boolean;
  caption: string;
  lines: string[]; // for documents
  handwriting: string; // for letters
  telegramNo: string;
  seconds: number; // length of a call
  rows: string[][]; // for badges and timelines: [time, text]
  role: string;
  description: string;
  alibi: string;
  portrait: string; // name of the svg portrait
  canLink: boolean;
}

export const SECTION_ORDER: SectionId[] = [
  'photos', 'documents', 'messages', 'calls', 'videos', 'badges', 'suspects', 'timeline'
];

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
  photo: 'Photograph', doc: 'Document', tel: 'Telegram', hand: 'Letter', call: 'Phone call',
  vid: 'Video', badge: 'Access pass', suspect: 'Suspect', time: 'Timeline'
};

const SCENES = ['scn-workshop', 'scn-tower', 'scn-boot', 'scn-alley'];
const IMAGE_FILE = /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i;
const VIDEO_FILE = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;

// splits a text in lines and removes the empty ones
function splitLines(text: string | null): string[] {
  const result: string[] = [];
  for (const line of (text || '').split(/\r?\n/)) {
    if (line.trim() !== '') {
      result.push(line.trim());
    }
  }
  return result;
}

// "21:30 | Gate passed" -> ["21:30", "Gate passed"]
function splitRows(text: string | null): string[][] {
  return splitLines(text).map(line => {
    const bar = line.indexOf('|');
    if (bar < 0) {
      return ['', line];
    }
    return [line.slice(0, bar).trim(), line.slice(bar + 1).trim()];
  });
}

function shorten(text: string, max = 120): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

// an item with default values, the functions below fill what they need
function emptyItem(key: string, type: ItemType, section: SectionId, icon: string, title: string): Item {
  return {
    key, evidenceId: null, type, section, icon, title,
    teaser: '', body: '', scene: SCENES[0], image: null, fileUrl: null, isVideoFile: false,
    caption: title, lines: [], handwriting: '', telegramNo: '', seconds: 20, rows: [],
    role: '', description: '', alibi: '', portrait: 'por-1', canLink: true
  };
}

function itemFromEvidence(e: EvidenceDto): Item {
  const content = e.content || '';
  const firstLine = splitLines(content)[0] || '';

  // common part for every type
  const make = (type: ItemType, section: SectionId, icon: string): Item => {
    const item = emptyItem('e' + e.id, type, section, icon, e.title);
    item.evidenceId = e.id;
    item.teaser = e.teaser || shorten(firstLine) || e.title;
    item.scene = SCENES[e.id % SCENES.length];
    item.fileUrl = e.fileUrl;
    item.body = content;
    return item;
  };

  if (e.type === 'PHOTO') {
    const item = make('photo', 'photos', 'i-photo');
    item.image = e.fileUrl;
    return item;
  }

  if (e.type === 'DOCUMENT') {
    const item = make('doc', 'documents', 'i-doc');
    item.lines = splitLines(content);
    if (item.lines.length === 0) {
      item.lines = ['See the attached file.'];
    }
    if (e.fileUrl && IMAGE_FILE.test(e.fileUrl)) {
      item.image = e.fileUrl;
    }
    return item;
  }

  if (e.type === 'MESSAGE') {
    // old telegrams are written with the word STOP, other messages are handwritten letters
    if (/\bSTOP\b/.test(content)) {
      const item = make('tel', 'messages', 'i-msg');
      item.telegramNo = 'Nº ' + (1000 + e.id);
      return item;
    }
    const item = make('hand', 'messages', 'i-msg');
    item.handwriting = content || e.title;
    item.body = '';
    return item;
  }

  if (e.type === 'CALL') {
    const item = make('call', 'calls', 'i-call');
    // fake duration based on the length of the text, between 12 and 59 seconds
    item.seconds = Math.min(59, Math.max(12, Math.round(content.length / 12)));
    return item;
  }

  if (e.type === 'VIDEO') {
    const item = make('vid', 'videos', 'i-video');
    item.isVideoFile = !!e.fileUrl && VIDEO_FILE.test(e.fileUrl);
    if (e.fileUrl && IMAGE_FILE.test(e.fileUrl)) {
      item.image = e.fileUrl;
    }
    return item;
  }

  if (e.type === 'BADGE') {
    const item = make('badge', 'badges', 'i-badge');
    item.rows = splitRows(content).filter(row => row[0] !== '');
    return item;
  }

  if (e.type === 'SUSPECT_PROFILE') {
    // line 1 = role, line 2 = description, line 3 = alibi
    const item = make('suspect', 'suspects', 'i-suspect');
    const l = splitLines(content);
    item.role = l[0] || 'Person of interest';
    item.description = l[1] || '';
    item.alibi = (l[2] || '').replace(/^alibi\s*[:\-]?\s*/i, '');
    item.portrait = 'por-' + (1 + (e.id % 3));
    item.image = e.fileUrl;
    item.teaser = e.teaser || shorten(item.description || item.role);
    return item;
  }

  // TIMELINE
  const item = make('time', 'timeline', 'i-time');
  item.rows = splitRows(content);
  return item;
}

// a suspect that has no evidence card of its own
function itemFromSuspect(s: SuspectDto): Item {
  const item = emptyItem('s' + s.id, 'suspect', 'suspects', 'i-suspect', s.name);
  item.role = s.role || 'Person of interest';
  item.description = s.description || '';
  item.alibi = s.alibi || '';
  item.portrait = 'por-' + (1 + (s.id % 3));
  item.image = s.imageUrl;
  item.teaser = shorten(item.description || item.role);
  item.canLink = false; // only real evidence can be linked
  return item;
}

export function buildItems(detail: CaseDetail): Item[] {
  const items = detail.evidences.map(itemFromEvidence);

  // if the case has no suspect evidence, show the suspects list instead
  const hasSuspectCards = items.some(item => item.type === 'suspect');
  if (!hasSuspectCards) {
    for (const suspect of detail.suspects) {
      items.push(itemFromSuspect(suspect));
    }
  }
  return items;
}
