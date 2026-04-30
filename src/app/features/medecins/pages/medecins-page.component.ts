import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import type { Medecin } from '../../../core/models/medecin.model';
import { MedecinsService } from '../../../core/services/medecins.service';

type StatusFilter = 'tous' | Medecin['statut'];
type CardTone = 'violet' | 'teal' | 'azure' | 'amber' | 'red';
type ViewMode = 'cards' | 'list';

@Component({
  selector: 'app-medecins-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './medecins-page.component.html',
  styleUrl: './medecins-page.component.scss'
})
export class MedecinsPageComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly medecinsService = inject(MedecinsService);

  readonly medecins = signal<Medecin[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');

  readonly showForm = signal(false);
  readonly editingId = signal<number | null>(null);

  readonly searchTerm = signal('');
  readonly statutFilter = signal<StatusFilter>('tous');
  readonly specialiteFilter = signal('toutes');
  readonly currentPage = signal(1);
  readonly pageSize = 8;
  readonly viewMode = signal<ViewMode>('cards');

  readonly form = this.fb.group({
    numero_ordre: ['', [Validators.required, Validators.minLength(5)]],
    nom: ['', [Validators.required, Validators.minLength(2)]],
    prenom: ['', [Validators.required, Validators.minLength(2)]],
    specialite: ['', [Validators.required, Validators.minLength(3)]],
    telephone: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s]{9,18}$/)]],
    email: ['', [Validators.required, Validators.email]],
    statut: ['actif' as Medecin['statut'], Validators.required]
  });

  readonly availableSpecialites = computed(() =>
    [...new Set(this.medecins().map((medecin) => medecin.specialite))]
      .sort((a, b) => a.localeCompare(b))
  );

  readonly filteredMedecins = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const statut = this.statutFilter();
    const specialite = this.specialiteFilter();

    return this.medecins()
      .filter((medecin) => {
        const searchableText =
          `${medecin.nom} ${medecin.prenom} ${medecin.specialite} ${medecin.numero_ordre} ${medecin.email} ${medecin.telephone}`.toLowerCase();
        const matchesSearch = !term || searchableText.includes(term);
        const matchesStatut = statut === 'tous' || medecin.statut === statut;
        const matchesSpecialite = specialite === 'toutes' || medecin.specialite === specialite;

        return matchesSearch && matchesStatut && matchesSpecialite;
      })
      .sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`));
  });

  readonly totalMedecins = computed(() => this.medecins().length);
  readonly totalActifs = computed(() => this.medecins().filter((medecin) => medecin.statut === 'actif').length);
  readonly totalConges = computed(() => this.medecins().filter((medecin) => medecin.statut === 'conge').length);
  readonly totalInactifs = computed(() => this.medecins().filter((medecin) => medecin.statut === 'inactif').length);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredMedecins().length / this.pageSize)));

  readonly pageNumbers = computed(() =>
    Array.from({ length: this.totalPages() }, (_, index) => index + 1)
  );

  readonly paginatedMedecins = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredMedecins().slice(start, start + this.pageSize);
  });

  readonly pageRangeStart = computed(() => {
    const total = this.filteredMedecins().length;
    if (total === 0) {
      return 0;
    }

    return (this.currentPage() - 1) * this.pageSize + 1;
  });

  readonly pageRangeEnd = computed(() => {
    const total = this.filteredMedecins().length;
    return Math.min(this.currentPage() * this.pageSize, total);
  });

  constructor() {
    effect(() => {
      const total = this.totalPages();
      if (this.currentPage() > total) {
        this.currentPage.set(total);
      }
    });

    this.loadMedecins();
  }

  loadMedecins(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.medecinsService
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (medecins) => this.medecins.set(medecins),
        error: (error: Error) => this.errorMessage.set(error.message || 'Impossible de charger les médecins.')
      });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(1);
  }

  onStatutFilterChange(value: string): void {
    this.statutFilter.set(value as StatusFilter);
    this.currentPage.set(1);
  }

  onSpecialiteFilterChange(value: string): void {
    this.specialiteFilter.set(value);
    this.currentPage.set(1);
  }

  openCreateForm(): void {
    this.editingId.set(null);
    this.form.reset({
      numero_ordre: '',
      nom: '',
      prenom: '',
      specialite: '',
      telephone: '',
      email: '',
      statut: 'actif'
    });
    this.showForm.set(true);
  }

  openEditForm(medecin: Medecin): void {
    this.editingId.set(medecin.id);
    this.form.setValue({
      numero_ordre: medecin.numero_ordre,
      nom: medecin.nom,
      prenom: medecin.prenom,
      specialite: medecin.specialite,
      telephone: medecin.telephone,
      email: medecin.email,
      statut: medecin.statut
    });
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.form.reset({
      numero_ordre: '',
      nom: '',
      prenom: '',
      specialite: '',
      telephone: '',
      email: '',
      statut: 'actif'
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');

    const payload = this.form.getRawValue();
    const id = this.editingId();
    const request$ = id ? this.medecinsService.update(id, payload) : this.medecinsService.create(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.cancelForm();
        this.loadMedecins();
      },
      error: (error: Error) => {
        this.errorMessage.set(error.message || 'Échec lors de la sauvegarde du médecin.');
      }
    });
  }

  deleteMedecin(id: number): void {
    const confirmed = confirm('Voulez-vous supprimer ce médecin ?');
    if (!confirmed) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.medecinsService
      .delete(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.loadMedecins(),
        error: (error: Error) => this.errorMessage.set(error.message || 'Suppression impossible.')
      });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) {
      return;
    }

    this.currentPage.set(page);
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  exportMedecins(): void {
    const rows = this.filteredMedecins().map((medecin) => [
      medecin.numero_ordre,
      `Dr ${medecin.prenom} ${medecin.nom}`,
      medecin.specialite,
      medecin.telephone,
      medecin.email,
      this.getStatusLabel(medecin)
    ]);

    const lines = [
      'Matricule,Médecin,Spécialité,Téléphone,Email,Statut',
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ];

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `medecins-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  getInitials(medecin: Medecin): string {
    return `${medecin.prenom.charAt(0)}${medecin.nom.charAt(0)}`.toUpperCase();
  }

  getStatusLabel(medecin: Medecin): string {
    if (medecin.statut === 'actif') {
      return 'Actif';
    }
    if (medecin.statut === 'conge') {
      return 'En congé';
    }

    return 'Inactif';
  }

  getStatusClass(medecin: Medecin): string {
    return medecin.statut;
  }

  getCardTone(medecin: Medecin): CardTone {
    const tones: CardTone[] = ['violet', 'teal', 'azure', 'amber', 'red'];
    return tones[(medecin.id - 1) % tones.length];
  }

  getMonthlyConsultations(medecin: Medecin): number {
    const base = 18 + ((medecin.id * 17) % 95);
    if (medecin.statut === 'conge') {
      return Math.max(0, Math.round(base * 0.45));
    }
    if (medecin.statut === 'inactif') {
      return 0;
    }

    return base;
  }

  getPatientsSuivis(medecin: Medecin): number {
    const base = 70 + ((medecin.id * 39) % 250);
    if (medecin.statut === 'conge') {
      return Math.round(base * 0.56);
    }
    if (medecin.statut === 'inactif') {
      return 0;
    }

    return base;
  }

  getExperienceAnnees(medecin: Medecin): number {
    const digits = medecin.numero_ordre.replace(/\D/g, '');
    const last = Number(digits.slice(-2)) || medecin.id * 3;
    return 5 + (last % 12);
  }

  getDisponibiliteJours(medecin: Medecin): Array<{ label: string; active: boolean }> {
    const labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const offset = medecin.id % labels.length;
    const activeLimit = medecin.statut === 'actif' ? 5 : medecin.statut === 'conge' ? 2 : 0;
    const activeIndexes = new Set<number>();

    for (let i = 0; i < activeLimit; i += 1) {
      activeIndexes.add((offset + i) % labels.length);
    }

    return labels.map((label, index) => ({
      label,
      active: activeIndexes.has(index)
    }));
  }

  getSalleLabel(medecin: Medecin): string {
    if (medecin.statut === 'inactif') {
      return '-';
    }

    return `Salle ${((medecin.id * 2) % 7) + 1}`;
  }
}
