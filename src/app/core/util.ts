import type { LinkDto } from './models';

// small helper functions used in several pages

// 7 -> "007"
export function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

// seconds -> "mm:ss"
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(s / 60)).padStart(2, '0');
  const rest = String(s % 60).padStart(2, '0');
  return minutes + ':' + rest;
}

// [0, 1, 2, ..., n-1], used to repeat things in the templates
export function range(n: number): number[] {
  const list: number[] = [];
  for (let i = 0; i < n; i++) {
    list.push(i);
  }
  return list;
}

// small tilts so the cards and folders don't look too perfect
export const CARD_TILTS = [-1.4, 1.2, -0.8, 1.8, -1.1, 0.9, 1.5, -1.7];
export const FOLDER_TILTS = [-2, 1.5, -1, 2, -1.5, 1, -2.5, 2.5];

export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// turns an http error into a message we can show to the user
export function errorMessage(err: any): string {
  const body = err?.error;
  if (body?.details?.length) {
    return body.message + ': ' + body.details.join(', ');
  }
  if (body?.message) {
    return body.message;
  }
  if (err?.status === 0) {
    return 'Cannot reach the server. Is the backend running?';
  }
  return 'Something went wrong. Please try again.';
}

// sets the class on <body>, the css uses it to change the layout per page
export function setPageMode(mode: 'lib' | 'book' | 'board' | 'accuse' | 'admin') {
  document.body.className = 'mode-' + mode;
}

// 'm' = match (green), 'c' = contradiction (red), 'p' = no link (plain)
export type LinkKind = 'm' | 'c' | 'p';

export function linkKind(link: LinkDto): LinkKind {
  if (link.result === 'MATCH') {
    return 'm';
  }
  if (link.result === 'CONTRADICTION') {
    return 'c';
  }
  return 'p';
}
