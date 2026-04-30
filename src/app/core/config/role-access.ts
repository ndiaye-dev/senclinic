import type { UserRole } from '../models/auth.model';

export const ROLE_ACCESS_MAP: Record<UserRole, readonly string[]> = {
  administrateur: [
    '/tableau-de-bord',
    '/patients',
    '/rendez-vous',
    '/consultations',
    '/medecins',
    '/utilisateurs',
    '/profil'
  ],
  medecin: ['/tableau-de-bord', '/patients', '/rendez-vous', '/consultations', '/medecins', '/profil'],
  secretaire: ['/tableau-de-bord', '/patients', '/rendez-vous', '/medecins', '/profil']
};

export const ROLE_ALLOWED_SECTIONS = {
  all: ['administrateur', 'medecin', 'secretaire'] as const,
  consultations: ['administrateur', 'medecin'] as const,
  utilisateurs: ['administrateur'] as const
};

export function canAccessRoute(role: UserRole | null | undefined, routePath: string): boolean {
  if (!role) {
    return false;
  }

  const allowedRoutes = ROLE_ACCESS_MAP[role];
  return allowedRoutes.includes(routePath);
}

export function getDefaultRouteForRole(role: UserRole | null | undefined): string {
  if (!role) {
    return '/login';
  }

  return ROLE_ACCESS_MAP[role][0] ?? '/login';
}
