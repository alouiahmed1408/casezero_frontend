import { Routes } from '@angular/router';
import { AccuseComponent } from './pages/accuse/accuse';
import { AdminComponent } from './pages/admin/admin';
import { BoardComponent } from './pages/board/board';
import { BookComponent } from './pages/book/book';
import { LibraryComponent } from './pages/library/library';

export const routes: Routes = [
  { path: '', component: LibraryComponent },
  { path: 'admin', component: AdminComponent },
  { path: 'investigation/:id', component: BookComponent },
  { path: 'investigation/:id/board', component: BoardComponent },
  { path: 'investigation/:id/accuse', component: AccuseComponent },
  { path: '**', redirectTo: '' }
];
