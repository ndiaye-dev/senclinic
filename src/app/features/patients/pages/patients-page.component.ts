import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import type { Medecin } from '../../../core/models/medecin.model';
import type { Patient } from '../../../core/models/patient.model';
import type { RendezVous } from '../../../core/models/rendez-vous.model';
import { MedecinsService } from '../../../core/services/medecins.service';
import { PatientsService } from '../../../core/services/patients.service';
import { RendezVousService } from '../../../core/services/rendez-vous.service';

@Component({
  selector: 'app-patients-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './patients-page.component.html',
  styleUrl: './patients-page.component.scss'
})
export class PatientsPageComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly patientsService = inject(PatientsService);
  private readonly medecinsService = inject(MedecinsService);
  private readonly rendezVousService = inject(RendezVousService);

  readonly patients = signal<Patient[]>([]);
  readonly medecins = signal<Medecin[]>([]);
  readonly rendezVous = signal<RendezVous[]>([]);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');

  readonly showForm = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly submitAttempted = signal(false);

  readonly searchTerm = signal('');
  readonly statutFilter = signal<'tous' | Patient['statut']>('tous');
  readonly villeFilter = signal('toutes');
  readonly selectedPatientIds = signal<number[]>([]);
  readonly currentPage = signal(1);
  readonly pageSize = signal(8);

  readonly form = this.fb.group({
    numero_dossier: ['', [Validators.required, Validators.minLength(4)]],
    nom: ['', [Validators.required, Validators.minLength(2)]],
    prenom: ['', [Validators.required, Validators.minLength(2)]],
    date_naissance: ['', Validators.required],
    sexe: ['Homme' as Patient['sexe'], Validators.required],
    groupe_sanguin: ['O+'],
    poids: [60, [Validators.min(1), Validators.max(300)]],
    telephone: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s-]{9,18}$/)]],
    adresse: ['', [Validators.minLength(5)]],
    email: ['', [Validators.email]],
    numero_securite_sociale: ['', [Validators.minLength(8)]],
    allergies: ['Aucune'],
    antecedents_medicaux: ['Aucun'],
    traitements_cours: ['Aucun'],
    medecin_traitant: [1, [Validators.required, Validators.min(1)]],
    statut: ['actif' as Patient['statut'], Validators.required]
  });

  readonly filteredPatients = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const statut = this.statutFilter();
    const ville = this.villeFilter();

    return this.patients().filter((patient) => {
      const searchableText = `${patient.numero_dossier} ${patient.nom} ${patient.prenom} ${patient.telephone}`.toLowerCase();
      const searchMatch = !term || searchableText.includes(term);
      const statutMatch = statut === 'tous' || patient.statut === statut;
      const villeMatch = ville === 'toutes' || this.extractCity(patient.adresse) === ville;
      return searchMatch && statutMatch && villeMatch;
    });
  });

  readonly totalPatients = computed(() => this.patients().length);
  readonly totalPatientsActifs = computed(() => this.patients().filter((patient) => patient.statut === 'actif').length);
  readonly totalPatientsInactifs = computed(() => this.patients().filter((patient) => patient.statut !== 'actif').length);
  readonly totalPatientsKpi = computed(() => this.totalPatients());
  readonly totalPatientsActifsKpi = computed(() => this.totalPatientsActifs());
  readonly totalPatientsInactifsKpi = computed(() => this.totalPatientsInactifs());
  readonly tauxPatientsActifs = computed(() => {
    const total = this.totalPatients();
    if (total === 0) {
      return 0;
    }

    return Math.round((this.totalPatientsActifs() / total) * 100);
  });
  readonly nouveauxCeMois = computed(() => {
    const month = this.currentMonthTokens().current;
    return this.newPatientsByMonth(month.year, month.month).size;
  });
  readonly nouveauxMoisPrecedent = computed(() => {
    const month = this.currentMonthTokens().previous;
    return this.newPatientsByMonth(month.year, month.month).size;
  });
  readonly tendanceNouveauxCeMois = computed(() => {
    const current = this.nouveauxCeMois();
    const previous = this.nouveauxMoisPrecedent();

    if (previous === 0) {
      if (current === 0) {
        return '0%';
      }

      return 'Nouveau';
    }

    const change = Math.round(((current - previous) / previous) * 100);
    const sign = change > 0 ? '+' : '';
    return `${sign}${change}%`;
  });
  readonly nouveauxCeMoisKpi = computed(() => this.nouveauxCeMois());
  readonly tendanceNouveauxCeMoisKpi = computed(() => this.tendanceNouveauxCeMois());
  readonly tauxPatientsActifsKpi = computed(() => `${this.tauxPatientsActifs()}%`);

  readonly availableCities = computed(() => {
    const cities = new Set(this.patients().map((patient) => this.extractCity(patient.adresse)));
    return Array.from(cities).sort((a, b) => a.localeCompare(b, 'fr'));
  });

  readonly lastRdvByPatient = computed<Record<number, string>>(() => {
    const map: Record<number, string> = {};

    for (const rdv of this.rendezVous()) {
      const currentDate = new Date(`${rdv.date_rdv}T${rdv.heure_rdv}:00`).getTime();
      const existing = map[rdv.patient_id];
      const existingDate = existing ? new Date(existing).getTime() : Number.NEGATIVE_INFINITY;

      if (currentDate >= existingDate) {
        map[rdv.patient_id] = `${rdv.date_rdv}T${rdv.heure_rdv}:00`;
      }
    }

    return map;
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredPatients().length / this.pageSize())));

  readonly pageNumbers = computed(() =>
    Array.from({ length: this.totalPages() }, (_, index) => index + 1)
  );

  readonly paginatedPatients = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredPatients().slice(start, start + this.pageSize());
  });

  readonly pageRangeStart = computed(() => {
    if (this.filteredPatients().length === 0) {
      return 0;
    }

    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  readonly pageRangeEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.filteredPatients().length)
  );

  readonly allCurrentPageSelected = computed(() => {
    const page = this.paginatedPatients();
    const selectedIds = this.selectedPatientIds();

    return page.length > 0 && page.every((patient) => selectedIds.includes(patient.id));
  });

  constructor() {
    effect(() => {
      const total = this.totalPages();
      if (this.currentPage() > total) {
        this.currentPage.set(total);
      }
    });

    effect(() => {
      const visibleIds = new Set(this.filteredPatients().map((patient) => patient.id));
      this.selectedPatientIds.update((ids) => ids.filter((id) => visibleIds.has(id)));
    });

    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    forkJoin({
      patients: this.patientsService.list(),
      medecins: this.medecinsService.list(),
      rendezVous: this.rendezVousService.list()
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ patients, medecins, rendezVous }) => {
          this.patients.set(patients);
          this.medecins.set(medecins);
          this.rendezVous.set(rendezVous);
          this.selectedPatientIds.set([]);

          if (!medecins.some((medecin) => medecin.id === this.form.controls.medecin_traitant.value)) {
            this.form.controls.medecin_traitant.setValue(medecins[0]?.id ?? 1);
          }
        },
        error: (error: Error) => this.errorMessage.set(error.message || 'Chargement des patients impossible.')
      });
  }

  getMedecinNom(id: number): string {
    const medecin = this.medecins().find((item) => item.id === id);
    return medecin ? `Dr ${medecin.prenom} ${medecin.nom}` : 'Non assigne';
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(1);
  }

  onStatutFilter(value: string): void {
    this.statutFilter.set(value as 'tous' | Patient['statut']);
    this.currentPage.set(1);
  }

  onVilleFilter(value: string): void {
    this.villeFilter.set(value);
    this.currentPage.set(1);
  }

  toggleSelectAllCurrentPage(checked: boolean): void {
    const currentPageIds = this.paginatedPatients().map((patient) => patient.id);

    if (checked) {
      this.selectedPatientIds.update((ids) => Array.from(new Set([...ids, ...currentPageIds])));
      return;
    }

    this.selectedPatientIds.update((ids) => ids.filter((id) => !currentPageIds.includes(id)));
  }

  togglePatientSelection(patientId: number, checked: boolean): void {
    if (checked) {
      this.selectedPatientIds.update((ids) => Array.from(new Set([...ids, patientId])));
      return;
    }

    this.selectedPatientIds.update((ids) => ids.filter((id) => id !== patientId));
  }

  isPatientSelected(patientId: number): boolean {
    return this.selectedPatientIds().includes(patientId);
  }

  exportPatients(): void {
    const headers = [
      'numero_dossier',
      'nom',
      'prenom',
      'telephone',
      'email',
      'ville',
      'medecin_referent',
      'dernier_rdv',
      'groupe_sanguin',
      'assurance',
      'statut'
    ];

    const lines = this.filteredPatients().map((patient) => [
      patient.numero_dossier,
      patient.nom,
      patient.prenom,
      patient.telephone,
      patient.email,
      this.extractCity(patient.adresse),
      this.getMedecinNom(patient.medecin_traitant),
      this.getLastRdvLabel(patient.id),
      patient.groupe_sanguin,
      this.getAssuranceLabel(patient),
      this.getStatutLabel(patient.statut)
    ]);

    const csvRows = [headers, ...lines].map((row) =>
      row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')
    );

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `patients-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  openCreateForm(): void {
    this.submitAttempted.set(false);
    this.editingId.set(null);
    this.form.reset({
      numero_dossier: '',
      nom: '',
      prenom: '',
      date_naissance: '',
      sexe: 'Homme',
      groupe_sanguin: 'O+',
      poids: 60,
      telephone: '',
      adresse: '',
      email: '',
      numero_securite_sociale: '',
      allergies: 'Aucune',
      antecedents_medicaux: 'Aucun',
      traitements_cours: 'Aucun',
      medecin_traitant: this.medecins()[0]?.id ?? 1,
      statut: 'actif'
    });
    this.showForm.set(true);
  }

  openEditForm(patient: Patient): void {
    this.submitAttempted.set(false);
    this.editingId.set(patient.id);
    this.form.setValue({
      numero_dossier: patient.numero_dossier,
      nom: patient.nom,
      prenom: patient.prenom,
      date_naissance: patient.date_naissance,
      sexe: patient.sexe,
      groupe_sanguin: patient.groupe_sanguin,
      poids: patient.poids,
      telephone: patient.telephone,
      adresse: patient.adresse,
      email: patient.email,
      numero_securite_sociale: patient.numero_securite_sociale,
      allergies: patient.allergies,
      antecedents_medicaux: patient.antecedents_medicaux,
      traitements_cours: patient.traitements_cours,
      medecin_traitant: patient.medecin_traitant,
      statut: patient.statut
    });
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.submitAttempted.set(false);
    this.showForm.set(false);
    this.editingId.set(null);
  }

  submit(): void {
    this.submitAttempted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');

    const payload = this.form.getRawValue();
    const id = this.editingId();
    const request$ = id ? this.patientsService.update(id, payload) : this.patientsService.create(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.submitAttempted.set(false);
        this.cancelForm();
        this.loadData();
      },
      error: (error: Error) => this.errorMessage.set(error.message || 'Erreur lors de la sauvegarde du patient.')
    });
  }

  deletePatient(id: number): void {
    if (!confirm('Confirmer la suppression du patient ?')) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.patientsService
      .delete(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.selectedPatientIds.update((ids) => ids.filter((patientId) => patientId !== id));
          this.loadData();
        },
        error: (error: Error) => this.errorMessage.set(error.message || 'Suppression impossible.')
      });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) {
      return;
    }

    this.currentPage.set(page);
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return Boolean(control && control.invalid && (control.touched || this.submitAttempted()));
  }

  getFieldError(controlName: string): string {
    const control = this.form.get(controlName);
    const errors = control?.errors;

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
      return 'Format invalide.';
    }

    if (errors['minlength']) {
      const requiredLength = errors['minlength']['requiredLength'];
      return `Minimum ${requiredLength} caracteres.`;
    }

    if (errors['min']) {
      return `Valeur minimale: ${errors['min']['min']}.`;
    }

    if (errors['max']) {
      return `Valeur maximale: ${errors['max']['max']}.`;
    }

    return 'Valeur invalide.';
  }

  getPatientInitials(patient: Patient): string {
    const first = patient.prenom.charAt(0).toUpperCase();
    const last = patient.nom.charAt(0).toUpperCase();
    return `${first}${last}`;
  }

  getAge(dateNaissance: string): number {
    const birth = new Date(dateNaissance);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age -= 1;
    }

    return Math.max(age, 0);
  }

  formatBirthDate(date: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(date));
  }

  getLastRdvLabel(patientId: number): string {
    const isoDate = this.lastRdvByPatient()[patientId];
    if (!isoDate) {
      return '-';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(new Date(isoDate));
  }

  getAssuranceLabel(patient: Patient): string {
    const assurances = ['IPRES', 'CSS', 'Privee'];
    return assurances[(patient.id - 1) % assurances.length];
  }

  extractCity(adresse: string): string {
    if (!adresse.trim()) {
      return '-';
    }

    const segments = adresse.split(',');
    return segments.at(-1)?.trim() || adresse.trim();
  }

  getStatutLabel(statut: Patient['statut']): string {
    if (statut === 'hospitalise') {
      return 'Hospitalise';
    }

    if (statut === 'inactif') {
      return 'Inactif';
    }

    return 'Actif';
  }

  getMedecinInitials(id: number): string {
    const medecin = this.medecins().find((item) => item.id === id);
    if (!medecin) {
      return 'DR';
    }

    return `${medecin.prenom.charAt(0)}${medecin.nom.charAt(0)}`.toUpperCase();
  }

  getMedecinVille(id: number): string {
    const sites = ['Dakar', 'Dakar', 'Thies', 'Saint-Louis', 'Kaolack', 'Ziguinchor'];
    return sites[(id - 1 + sites.length) % sites.length];
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  private currentMonthTokens(): {
    current: { year: number; month: number };
    previous: { year: number; month: number };
  } {
    const now = new Date();
    const current = { year: now.getFullYear(), month: now.getMonth() + 1 };
    const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previous = { year: previousDate.getFullYear(), month: previousDate.getMonth() + 1 };

    return { current, previous };
  }

  private newPatientsByMonth(year: number, month: number): Set<number> {
    const firstSeenByPatient = new Map<number, string>();

    for (const rdv of this.rendezVous()) {
      const firstSeen = firstSeenByPatient.get(rdv.patient_id);
      if (!firstSeen || rdv.date_rdv < firstSeen) {
        firstSeenByPatient.set(rdv.patient_id, rdv.date_rdv);
      }
    }

    const ids = new Set<number>();
    const token = `${year}-${String(month).padStart(2, '0')}`;

    for (const [patientId, firstDate] of firstSeenByPatient.entries()) {
      if (firstDate.startsWith(token)) {
        ids.add(patientId);
      }
    }

    return ids;
  }
}
