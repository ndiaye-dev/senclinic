import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getDefaultRouteForRole } from '../config/role-access';
import type { UserRole } from '../models/auth.model';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = (route.data?.['roles'] as readonly UserRole[] | undefined) ?? [];

  if (allowedRoles.length === 0 || authService.hasRole([...allowedRoles])) {
    return true;
  }

  return router.createUrlTree([getDefaultRouteForRole(authService.currentUser()?.role)]);
};
