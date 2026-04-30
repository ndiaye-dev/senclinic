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

interface CalendarCell {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  items: RendezVous[];
}

@Component({
  selector: 'app-rendez-vous-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './rendez-vous-page.component.html',
  styleUrl: './rendez-vous-page.component.scss'
})
export class RendezVousPageComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly rendezVousService = inject(RendezVousService);
  private readonly patientsService = inject(PatientsService);
  private readonly medecinsService = inject(MedecinsService);

  readonly rendezVous = signal<RendezVous[]>([]);
  readonly patients = signal<Patient[]>([]);
  readonly medecins = signal<Medecin[]>([]);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');

  readonly showForm = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly viewMode = signal<'calendrier' | 'liste'>('calendrier');

  readonly searchTerm = signal('');
  readonly statutFilter = signal<'tous' | RendezVous['statut']>('tous');
  readonly medecinFilter = signal<number | 'tous'>('tous');
  readonly dateFilter = signal('');
  readonly scopeFilter = signal<'tous' | 'aujourdhui' | 'semaine'>('tous');
  readonly currentPage = signal(1);
  readonly pageSize = signal(8);
  readonly weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
  readonly currentMonth = signal(this.toMonthStart(new Date()));
  readonly selectedDateIso = signal(this.formatDateIso(new Date()));

  readonly form = this.fb.group({
    patient_id: [1, [Validators.required, Validators.min(1)]],
    medecin_id: [1, [Validators.required, Validators.min(1)]],
    date_rdv: ['', Validators.required],
    heure_rdv: ['', Validators.required],
    motif: ['', [Validators.required, Validators.minLength(4)]],
    statut: ['planifie' as RendezVous['statut'], Validators.required]
  });

  readonly scopedRendezVous = computed(() => {
    const scope = this.scopeFilter();
    const now = new Date();
    const todayIso = this.formatDateIso(now);

    if (scope === 'aujourdhui') {
      return this.rendezVous().filter((item) => item.date_rdv === todayIso);
    }

    if (scope === 'semaine') {
      const weekStart = this.getWeekStart(now);
      const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
      const startIso = this.formatDateIso(weekStart);
      const endIso = this.formatDateIso(weekEnd);

      return this.rendezVous().filter((item) => item.date_rdv >= startIso && item.date_rdv <= endIso);
    }

    return this.rendezVous();
  });

  readonly calendarFilteredRendezVous = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const statut = this.statutFilter();
    const medecinFilter = this.medecinFilter();

    return this.scopedRendezVous().filter((item) => {
      const patientNom = this.getPatientNom(item.patient_id).toLowerCase();
      const medecinNom = this.getMedecinNom(item.medecin_id).toLowerCase();
      const searchText = `${item.motif} ${patientNom} ${medecinNom} ${item.date_rdv}`.toLowerCase();
      const matchesSearch = !term || searchText.includes(term);
      const matchesStatut = statut === 'tous' || item.statut === statut;
      const matchesMedecin = medecinFilter === 'tous' || item.medecin_id === medecinFilter;
      return matchesSearch && matchesStatut && matchesMedecin;
    });
  });

  readonly filteredRendezVous = computed(() => {
    const dateFilter = this.dateFilter();
    return this.calendarFilteredRendezVous().filter((item) => !dateFilter || item.date_rdv === dateFilter);
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredRendezVous().length / this.pageSize())));

  readonly pageNumbers = computed(() =>
    Array.from({ length: this.totalPages() }, (_, index) => index + 1)
  );

  readonly paginatedRendezVous = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredRendezVous().slice(start, start + this.pageSize());
  });

  readonly pageRangeStart = computed(() => {
    if (this.filteredRendezVous().length === 0) {
      return 0;
    }

    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  readonly pageRangeEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.filteredRendezVous().length)
  );

  readonly totalRendezVous = computed(() => this.filteredRendezVous().length);
  readonly rendezVousAujourdhui = computed(() => {
    const today = this.formatDateIso(new Date());
    return this.filteredRendezVous().filter((item) => item.date_rdv === today).length;
  });
  readonly rendezVousConfirmes = computed(
    () => this.filteredRendezVous().filter((item) => item.statut === 'confirme' || item.statut === 'termine').length
  );
  readonly rendezVousAnnules = computed(() => this.filteredRendezVous().filter((item) => item.statut === 'annule').length);
  readonly tauxConfirmation = computed(() => {
    const total = this.totalRendezVous();
    if (total === 0) {
      return 0;
    }

    return Math.round((this.rendezVousConfirmes() / total) * 100);
  });
  readonly rendezVousByDate = computed(() => {
    const map = new Map<string, RendezVous[]>();

    for (const item of this.calendarFilteredRendezVous()) {
      const row = map.get(item.date_rdv) ?? [];
      row.push(item);
      map.set(item.date_rdv, row);
    }

    for (const list of map.values()) {
      list.sort((a, b) => a.heure_rdv.localeCompare(b.heure_rdv));
    }

    return map;
  });
  readonly calendarMonthLabel = computed(() =>
    new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(this.currentMonth())
  );
  readonly calendarCells = computed<CalendarCell[]>(() => {
    const month = this.currentMonth();
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
    const startDate = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
    const todayIso = this.formatDateIso(new Date());
    const rows: CalendarCell[] = [];
    const byDate = this.rendezVousByDate();

    for (let index = 0; index < totalCells; index += 1) {
      const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + index);
      const iso = this.formatDateIso(cursor);

      rows.push({
        iso,
        day: cursor.getDate(),
        inMonth: cursor.getMonth() === month.getMonth(),
        isToday: iso === todayIso,
        items: byDate.get(iso) ?? []
      });
    }

    return rows;
  });
  readonly selectedDayAppointments = computed(() => this.rendezVousByDate().get(this.selectedDateIso()) ?? []);
  readonly selectedDateLabel = computed(() =>
    new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(this.parseDateIso(this.selectedDateIso()))
  );
  readonly countTous = computed(() => this.rendezVous().length);
  readonly countAujourdhui = computed(() => {
    const todayIso = this.formatDateIso(new Date());
    return this.rendezVous().filter((item) => item.date_rdv === todayIso).length;
  });
  readonly countSemaine = computed(() => {
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
    const startIso = this.formatDateIso(weekStart);
    const endIso = this.formatDateIso(weekEnd);
    return this.rendezVous().filter((item) => item.date_rdv >= startIso && item.date_rdv <= endIso).length;
  });

  constructor() {
    effect(() => {
      const total = this.totalPages();
      if (this.currentPage() > total) {
        this.currentPage.set(total);
      }
    });

    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    forkJoin({
      rendezVous: this.rendezVousService.list(),
      patients: this.patientsService.list(),
      medecins: this.medecinsService.list()
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ rendezVous, patients, medecins }) => {
          this.rendezVous.set(rendezVous);
          this.patients.set(patients);
          this.medecins.set(medecins);

          this.form.controls.patient_id.setValue(patients[0]?.id ?? 1);
          this.form.controls.medecin_id.setValue(medecins[0]?.id ?? 1);
        },
        error: (error: Error) => this.errorMessage.set(error.message || 'Impossible de charger les rendez-vous.')
      });
  }

  getPatientNom(id: number): string {
    const patient = this.patients().find((item) => item.id === id);
    return patient ? `${patient.prenom} ${patient.nom}` : 'Patient inconnu';
  }

  getMedecinNom(id: number): string {
    const medecin = this.medecins().find((item) => item.id === id);
    return medecin ? `Dr ${medecin.prenom} ${medecin.nom}` : 'Medecin inconnu';
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(1);
  }

  onFilterChange(value: string): void {
    this.statutFilter.set(value as 'tous' | RendezVous['statut']);
    this.currentPage.set(1);
  }

  onMedecinFilterChange(value: string): void {
    if (value === 'tous') {
      this.medecinFilter.set('tous');
      this.currentPage.set(1);
      return;
    }

    const parsed = Number(value);
    this.medecinFilter.set(Number.isFinite(parsed) ? parsed : 'tous');
    this.currentPage.set(1);
  }

  onDateFilterChange(value: string): void {
    this.dateFilter.set(value);
    if (value) {
      this.selectedDateIso.set(value);
      const selectedDate = this.parseDateIso(value);
      this.currentMonth.set(this.toMonthStart(selectedDate));
    }
    this.currentPage.set(1);
  }

  setScopeFilter(scope: 'tous' | 'aujourdhui' | 'semaine'): void {
    this.scopeFilter.set(scope);
    this.currentPage.set(1);
  }

  exportRendezVous(): void {
    const headers = ['date', 'heure', 'patient', 'medecin', 'motif', 'type', 'salle', 'duree', 'statut'];
    const lines = this.filteredRendezVous().map((item) => [
      item.date_rdv,
      item.heure_rdv,
      this.getPatientNom(item.patient_id),
      this.getMedecinNom(item.medecin_id),
      item.motif,
      this.getConsultationType(item),
      this.getSalle(item),
      this.getDuree(item),
      this.getStatusLabel(item.statut)
    ]);
    const csvRows = [headers, ...lines].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';'));
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `rendez-vous-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  openCreateForm(dateIso = ''): void {
    this.editingId.set(null);
    this.form.reset({
      patient_id: this.patients()[0]?.id ?? 1,
      medecin_id: this.medecins()[0]?.id ?? 1,
      date_rdv: dateIso,
      heure_rdv: '',
      motif: '',
      statut: 'planifie'
    });
    this.showForm.set(true);
  }

  openEditForm(item: RendezVous): void {
    this.editingId.set(item.id);
    this.form.setValue({
      patient_id: item.patient_id,
      medecin_id: item.medecin_id,
      date_rdv: item.date_rdv,
      heure_rdv: item.heure_rdv,
      motif: item.motif,
      statut: item.statut
    });
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
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
    const request$ = id ? this.rendezVousService.update(id, payload) : this.rendezVousService.create(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.cancelForm();
        this.loadData();
      },
      error: (error: Error) => this.errorMessage.set(error.message || 'Echec de la sauvegarde du rendez-vous.')
    });
  }

  deleteRendezVous(id: number): void {
    if (!confirm('Supprimer ce rendez-vous ?')) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.rendezVousService
      .delete(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.loadData(),
        error: (error: Error) => this.errorMessage.set(error.message || 'Suppression impossible.')
      });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) {
      return;
    }

    this.currentPage.set(page);
  }

  setViewMode(mode: 'calendrier' | 'liste'): void {
    this.viewMode.set(mode);
  }

  previousMonth(): void {
    const month = this.currentMonth();
    const previous = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    this.currentMonth.set(previous);
    this.selectedDateIso.set(this.formatDateIso(previous));
  }

  nextMonth(): void {
    const month = this.currentMonth();
    const next = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    this.currentMonth.set(next);
    this.selectedDateIso.set(this.formatDateIso(next));
  }

  goToToday(): void {
    const today = new Date();
    this.currentMonth.set(this.toMonthStart(today));
    this.selectedDateIso.set(this.formatDateIso(today));
  }

  selectDate(iso: string): void {
    this.selectedDateIso.set(iso);
    const selected = this.parseDateIso(iso);
    this.currentMonth.set(this.toMonthStart(selected));
  }

  applySelectedDateToList(): void {
    this.dateFilter.set(this.selectedDateIso());
    this.currentPage.set(1);
    this.viewMode.set('liste');
  }

  clearDateFilter(): void {
    this.dateFilter.set('');
    this.currentPage.set(1);
  }

  openCreateFromSelectedDate(): void {
    this.openCreateForm(this.selectedDateIso());
  }

  private toMonthStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private getWeekStart(date: Date): Date {
    const weekdayIndex = (date.getDay() + 6) % 7;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - weekdayIndex);
  }

  private formatDateIso(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDateIso(iso: string): Date {
    const [year, month, day] = iso.split('-').map((part) => Number(part));
    return new Date(year, (month || 1) - 1, day || 1);
  }

  getPatientInitials(id: number): string {
    const patient = this.patients().find((item) => item.id === id);
    if (!patient) {
      return 'PT';
    }

    return `${patient.prenom.charAt(0)}${patient.nom.charAt(0)}`.toUpperCase();
  }

  getPatientCode(id: number): string {
    return `P-${String(id).padStart(3, '0')}`;
  }

  getMedecinSpecialite(id: number): string {
    const medecin = this.medecins().find((item) => item.id === id);
    return medecin?.specialite ?? 'Medecine generale';
  }

  getDateLabel(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
  }

  getConsultationType(item: RendezVous): string {
    const motif = item.motif.toLowerCase();

    if (motif.includes('cardiaque') || motif.includes('tension')) {
      return 'Suivi cardiologique';
    }

    if (motif.includes('pedi') || motif.includes('enfant')) {
      return 'Consultation pediatrique';
    }

    if (motif.includes('bilan')) {
      return 'Bilan de sante';
    }

    if (motif.includes('insuffisance') || motif.includes('geri')) {
      return 'Consultation geriatrique';
    }

    if (motif.includes('migraine')) {
      return 'Suivi post-operatoire';
    }

    return 'Consultation generale';
  }

  getConsultationTone(item: RendezVous): 'teal' | 'red' | 'green' | 'blue' | 'amber' | 'violet' {
    const type = this.getConsultationType(item);
    if (type === 'Suivi cardiologique') {
      return 'red';
    }
    if (type === 'Bilan de sante') {
      return 'green';
    }
    if (type === 'Consultation pediatrique') {
      return 'blue';
    }
    if (type === 'Consultation geriatrique') {
      return 'violet';
    }
    if (type === 'Suivi post-operatoire') {
      return 'amber';
    }
    return 'teal';
  }

  getTypeDescription(item: RendezVous): string {
    const type = this.getConsultationType(item);
    if (type === 'Suivi cardiologique') {
      return 'Suivi hypertension';
    }
    if (type === 'Bilan de sante') {
      return 'Bilan annuel complet';
    }
    if (type === 'Consultation pediatrique') {
      return 'Fievre persistante';
    }
    if (type === 'Consultation geriatrique') {
      return 'Suivi polymedication';
    }
    if (type === 'Suivi post-operatoire') {
      return 'Controle cicatrisation';
    }
    return 'Douleurs abdominales';
  }

  getSalle(item: RendezVous): string {
    return `Salle ${((item.medecin_id - 1) % 4) + 1}`;
  }

  getDuree(item: RendezVous): string {
    const durations = ['30 min', '45 min', '60 min', '30 min', '30 min', '45 min', '45 min', '30 min'];
    return durations[(item.id - 1 + durations.length) % durations.length];
  }

  getStatusLabel(status: RendezVous['statut']): string {
    if (status === 'confirme') {
      return 'Confirme';
    }
    if (status === 'termine') {
      return 'En cours';
    }
    if (status === 'annule') {
      return 'Annule';
    }
    return 'Planifie';
  }

  getScopeCount(scope: 'tous' | 'aujourdhui' | 'semaine'): number {
    if (scope === 'aujourdhui') {
      return this.countAujourdhui();
    }
    if (scope === 'semaine') {
      return this.countSemaine();
    }
    return this.countTous();
  }
}
