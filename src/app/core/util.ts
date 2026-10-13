export const pad3 = (n: number) => String(n).padStart(3, '0');

export const fmt = (s: number) => {
  const v = Math.max(0, Math.floor(s));
  return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
};

export const range = (n: number) => Array.from({ length: n }, (_, i) => i);

export const ROTS = [-1.4, 1.2, -0.8, 1.8, -1.1, 0.9, 1.5, -1.7];
export const FOLDER_ROTS = [-2, 1.5, -1, 2, -1.5, 1, -2.5, 2.5];

export function errorMessage(err: any): string {
  const body = err?.error;
  if (body?.details?.length) {
    return body.message + ' — ' + body.details.join(' · ');
  }
  if (body?.message) {
    return body.message;
  }
  if (err?.status === 0) {
    return 'The Bureau cannot be reached. Is the backend running on port 8080?';
  }
  return 'Something went wrong at the Bureau.';
}
