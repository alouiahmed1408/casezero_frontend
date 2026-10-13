import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'symref' })
export class SymrefPipe implements PipeTransform {
  transform(id: string): string {
    return '#' + id;
  }
}
