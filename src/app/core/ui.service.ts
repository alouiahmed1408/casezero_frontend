import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UiService {
  setMode(mode: 'lib' | 'book' | 'accuse' | 'admin') {
    document.body.className = 'mode-' + mode;
  }
}
