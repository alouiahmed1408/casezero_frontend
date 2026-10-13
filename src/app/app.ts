import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TimerService } from './core/timer.service';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html'
})
export class App {
  protected timer = inject(TimerService);
  protected toast = inject(ToastService);
}
