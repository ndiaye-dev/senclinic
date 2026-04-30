import { computed, Injectable, signal } from '@angular/core';
import { Observable, of, switchMap, throwError } from 'rxjs';
import type { SessionUser, UserRole } from '../models/auth.model';
import { UtilisateursService } from './utilisateurs.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'senclinic_session';
  private readonly currentUserSignal = signal<SessionUser | null>(this.readSession());

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  constructor(private readonly utilisateursService: UtilisateursService) {}

  login(email: string, motDePasse: string): Observable<SessionUser> {
    return this.utilisateursService.findByCredentials(email, motDePasse).pipe(
      switchMap((user) => {
        if (!user || user.statut !== 'actif') {
          return throwError(() => new Error('Identifiants invalides ou compte inactif.'));
        }

        const sessionUser: SessionUser = {
          id: user.id,
          nom: user.nom,
          prenom: user.prenom,
          email: user.email,
          role: user.role
        };

        this.currentUserSignal.set(sessionUser);
        localStorage.setItem(this.storageKey, JSON.stringify(sessionUser));
        return of(sessionUser);
      })
    );
  }

  logout(): void {
    this.currentUserSignal.set(null);
    localStorage.removeItem(this.storageKey);
  }

  hasRole(allowedRoles: UserRole[]): boolean {
    const user = this.currentUserSignal();
    return !!user && allowedRoles.includes(user.role);
  }

  updateSessionUser(patch: Partial<SessionUser>): void {
    const user = this.currentUserSignal();
    if (!user) {
      return;
    }

    const updatedUser: SessionUser = {
      ...user,
      ...patch
    };

    this.currentUserSignal.set(updatedUser);
    localStorage.setItem(this.storageKey, JSON.stringify(updatedUser));
  }

  private readSession(): SessionUser | null {
    const rawSession = localStorage.getItem(this.storageKey);

    if (!rawSession) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawSession) as SessionUser;
      if (!parsed.email || !parsed.role) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }
}
