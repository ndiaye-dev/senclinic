import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { ROLE_ALLOWED_SECTIONS } from './core/config/role-access';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/pages/login-page.component').then((m) => m.LoginPageComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'tableau-de-bord'
      },
      {
        path: 'tableau-de-bord',
        canActivate: [roleGuard],
        data: { roles: ROLE_ALLOWED_SECTIONS.all },
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES)
      },
      {
        path: 'patients',
        canActivate: [roleGuard],
        data: { roles: ROLE_ALLOWED_SECTIONS.all },
        loadChildren: () => import('./features/patients/patients.routes').then((m) => m.PATIENTS_ROUTES)
      },
      {
        path: 'rendez-vous',
        canActivate: [roleGuard],
        data: { roles: ROLE_ALLOWED_SECTIONS.all },
        loadChildren: () => import('./features/rendez-vous/rendez-vous.routes').then((m) => m.RENDEZ_VOUS_ROUTES)
      },
      {
        path: 'consultations',
        canActivate: [roleGuard],
        data: { roles: ROLE_ALLOWED_SECTIONS.consultations },
        loadChildren: () => import('./features/consultations/consultations.routes').then((m) => m.CONSULTATIONS_ROUTES)
      },
      {
        path: 'medecins',
        canActivate: [roleGuard],
        data: { roles: ROLE_ALLOWED_SECTIONS.all },
        loadChildren: () => import('./features/medecins/medecins.routes').then((m) => m.MEDECINS_ROUTES)
      },
      {
        path: 'utilisateurs',
        canActivate: [roleGuard],
        data: { roles: ROLE_ALLOWED_SECTIONS.utilisateurs },
        loadChildren: () => import('./features/utilisateurs/utilisateurs.routes').then((m) => m.UTILISATEURS_ROUTES)
      },
      {
        path: 'profil',
        loadChildren: () => import('./features/profil/profil.routes').then((m) => m.PROFIL_ROUTES)
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
