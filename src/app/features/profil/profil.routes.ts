import { Routes } from '@angular/router';

export const PROFIL_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/profil-page.component').then((m) => m.ProfilPageComponent)
  }
];
