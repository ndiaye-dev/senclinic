import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, timeout } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loadingState = signal(false);
  readonly errorMessage = signal('');

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    mot_de_passe: ['', [Validators.required, Validators.minLength(6)]]
  });

  readonly demoAccounts = [
    { role: 'Administrateur', email: 'admin@senclinic.sn', mot_de_passe: 'admin123' },
    { role: 'Medecin', email: 'medecin@senclinic.sn', mot_de_passe: 'medecin123' },
    { role: 'Secretaire', email: 'secretaire@senclinic.sn', mot_de_passe: 'secretaire123' }
  ];

  constructor() {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/tableau-de-bord']);
    }
  }

  useDemoAccount(email: string, motDePasse: string): void {
    this.form.patchValue({ email, mot_de_passe: motDePasse });
    this.errorMessage.set('');
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loadingState.set(true);
    this.errorMessage.set('');
    const watchdogId = window.setTimeout(() => {
      if (this.loadingState()) {
        this.loadingState.set(false);
        this.errorMessage.set('Connexion impossible. Vérifiez vos identifiants et réessayez.');
      }
    }, 6000);

    const formValue = this.form.getRawValue();
    let loginRequest$!: ReturnType<AuthService['login']>;

    try {
      loginRequest$ = this.authService.login(formValue.email, formValue.mot_de_passe);
    } catch (error) {
      window.clearTimeout(watchdogId);
      this.loadingState.set(false);
      this.errorMessage.set(error instanceof Error ? error.message : 'Connexion impossible. Réessayez.');
      return;
    }

    loginRequest$
      .pipe(
        timeout(5000),
        finalize(() => {
          window.clearTimeout(watchdogId);
          this.loadingState.set(false);
        })
      )
      .subscribe({
        next: () => {
          void this.router.navigate(['/tableau-de-bord']);
        },
        error: (error: unknown) => {
          this.errorMessage.set(error instanceof Error ? error.message : 'Connexion impossible. Réessayez.');
        }
      });
  }
}
