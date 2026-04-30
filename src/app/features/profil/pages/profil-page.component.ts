import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import type { UserRole } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { UtilisateursService } from '../../../core/services/utilisateurs.service';

@Component({
  selector: 'app-profil-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profil-page.component.html',
  styleUrl: './profil-page.component.scss'
})
export class ProfilPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly utilisateursService = inject(UtilisateursService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly activeTab = signal<'profil' | 'parametres'>('profil');
  readonly currentUser = this.authService.currentUser;

  readonly form = this.fb.group({
    nom: ['', [Validators.required, Validators.minLength(2)]],
    prenom: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    telephone: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s]{9,18}$/)]]
  });

  readonly roleLabel = computed(() => {
    const role = this.currentUser()?.role;
    if (role === 'administrateur') {
      return 'Administrateur';
    }
    if (role === 'medecin') {
      return 'Médecin';
    }
    if (role === 'secretaire') {
      return 'Secrétaire';
    }
    return 'Utilisateur';
  });

  readonly userInitials = computed(() => {
    const user = this.currentUser();
    if (!user) {
      return 'SC';
    }
    return `${user.prenom.charAt(0)}${user.nom.charAt(0)}`.toUpperCase();
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab');
      this.activeTab.set(tab === 'parametres' ? 'parametres' : 'profil');
    });
    this.loadProfile();
  }

  loadProfile(): void {
    const user = this.currentUser();
    if (!user) {
      this.errorMessage.set('Session utilisateur introuvable.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.utilisateursService
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (users) => {
          const found = users.find((entry) => entry.id === user.id);
          if (!found) {
            this.errorMessage.set('Profil introuvable.');
            return;
          }

          this.form.reset({
            nom: found.nom,
            prenom: found.prenom,
            email: found.email,
            telephone: found.telephone
          });
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message || 'Erreur de chargement du profil.');
        }
      });
  }

  setTab(tab: 'profil' | 'parametres'): void {
    this.activeTab.set(tab);
  }

  submitProfile(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const user = this.currentUser();
    if (!user) {
      this.errorMessage.set('Session utilisateur introuvable.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.utilisateursService
      .list()
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (users) => {
          const found = users.find((entry) => entry.id === user.id);
          if (!found) {
            this.errorMessage.set('Profil introuvable.');
            return;
          }

          const payload = {
            ...found,
            ...this.form.getRawValue()
          };

          this.saving.set(true);
          this.utilisateursService
            .update(user.id, payload)
            .pipe(finalize(() => this.saving.set(false)))
            .subscribe({
              next: (updated) => {
                this.authService.updateSessionUser({
                  nom: updated.nom,
                  prenom: updated.prenom,
                  email: updated.email
                });
                this.successMessage.set('Profil mis à jour avec succès.');
              },
              error: (error: Error) => {
                this.errorMessage.set(error.message || 'Mise à jour impossible.');
              }
            });
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message || 'Mise à jour impossible.');
        }
      });
  }

  saveSecuritySettings(): void {
    this.successMessage.set('Paramètres de sécurité enregistrés.');
    this.errorMessage.set('');
  }

  isInvalid(controlName: 'nom' | 'prenom' | 'email' | 'telephone'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && control.touched;
  }

  getFieldError(controlName: 'nom' | 'prenom' | 'email' | 'telephone'): string {
    const errors = this.form.controls[controlName].errors;
    if (!errors) {
      return '';
    }

    if (errors['required']) {
      return 'Champ obligatoire.';
    }
    if (errors['email']) {
      return 'Format email invalide.';
    }
    if (errors['pattern']) {
      return 'Format téléphone invalide.';
    }
    if (errors['minlength']) {
      return `Minimum ${errors['minlength']['requiredLength']} caractères.`;
    }

    return 'Valeur invalide.';
  }
}

