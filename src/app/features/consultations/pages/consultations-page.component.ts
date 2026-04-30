import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { jsPDF } from 'jspdf';
import { finalize, forkJoin } from 'rxjs';
import type { Consultation } from '../../../core/models/consultation.model';
import type { Medecin } from '../../../core/models/medecin.model';
import type { Patient } from '../../../core/models/patient.model';
import { ConsultationsService } from '../../../core/services/consultations.service';
import { MedecinsService } from '../../../core/services/medecins.service';
import { PatientsService } from '../../../core/services/patients.service';

type ConsultationStatus = 'terminee' | 'en_cours' | 'annulee';
type ConsultationStatusFilter = 'tous' | ConsultationStatus;
type OrdonnanceFilter = 'toutes' | 'avec' | 'sans';

@Component({
  selector: 'app-consultations-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './consultations-page.component.html',
  styleUrl: './consultations-page.component.scss'
})
export class ConsultationsPageComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly consultationsService = inject(ConsultationsService);
  private readonly patientsService = inject(PatientsService);
  private readonly medecinsService = inject(MedecinsService);

  readonly consultations = signal<Consultation[]>([]);
  readonly patients = signal<Patient[]>([]);
  readonly medecins = signal<Medecin[]>([]);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly errorMessage = signal('');

  readonly showForm = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly selectedConsultationId = signal<number | null>(null);

  readonly searchTerm = signal('');
  readonly statutFilter = signal<ConsultationStatusFilter>('tous');
  readonly medecinFilter = signal<string>('tous');
  readonly ordonnanceFilter = signal<OrdonnanceFilter>('toutes');
  readonly currentPage = signal(1);
  readonly pageSize = 8;

  readonly form = this.fb.group({
    patient_id: [1, [Validators.required, Validators.min(1)]],
    medecin_id: [1, [Validators.required, Validators.min(1)]],
    date_consultation: ['', Validators.required],
    motif_consultation: ['', [Validators.required, Validators.minLength(4)]],
    symptomes: ['', [Validators.required, Validators.minLength(4)]],
    diagnostic: ['', [Validators.required, Validators.minLength(4)]],
    observations: ['', Validators.required],
    ordonnance: ['', Validators.required],
    certificat: [false]
  });

  readonly filteredConsultations = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const statusFilter = this.statutFilter();
    const medecinFilter = this.medecinFilter();
    const ordonnanceFilter = this.ordonnanceFilter();

    return this.consultations()
      .filter((consultation) => {
        const patientNom = this.getPatientNom(consultation.patient_id).toLowerCase();
        const medecinNom = this.getMedecinNom(consultation.medecin_id).toLowerCase();
        const searchText =
          `${consultation.motif_consultation} ${consultation.diagnostic} ${consultation.ordonnance} ${patientNom} ${medecinNom}`.toLowerCase();
        const matchSearch = !term || searchText.includes(term);
        const status = this.getConsultationStatus(consultation);
        const matchStatus = statusFilter === 'tous' || status === statusFilter;
        const matchMedecin = medecinFilter === 'tous' || `${consultation.medecin_id}` === medecinFilter;
        const matchOrdonnance =
          ordonnanceFilter === 'toutes' ||
          (ordonnanceFilter === 'avec' && this.hasOrdonnance(consultation)) ||
          (ordonnanceFilter === 'sans' && !this.hasOrdonnance(consultation));

        return matchSearch && matchStatus && matchMedecin && matchOrdonnance;
      })
      .sort((a, b) => `${b.date_consultation}-${b.id}`.localeCompare(`${a.date_consultation}-${a.id}`));
  });
  readonly totalConsultations = computed(() => this.consultations().length);
  readonly consultationsAvecOrdonnance = computed(
    () => this.consultations().filter((consultation) => this.hasOrdonnance(consultation)).length
  );
  readonly consultationsEnCours = computed(
    () => this.consultations().filter((consultation) => this.getConsultationStatus(consultation) === 'en_cours').length
  );
  readonly consultationsMoisCourant = computed(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return this.consultations().filter((consultation) => {
      const date = this.parseDate(consultation.date_consultation);
      return date.getMonth() === month && date.getFullYear() === year;
    }).length;
  });

  readonly consultationsMoisPrecedent = computed(() => {
    const now = new Date();
    const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
    const previousMonthIndex = currentMonthIndex - 1;

    return this.consultations().filter((consultation) => {
      const date = this.parseDate(consultation.date_consultation);
      const consultationMonthIndex = date.getFullYear() * 12 + date.getMonth();
      return consultationMonthIndex === previousMonthIndex;
    }).length;
  });

  readonly monthlyTrendPercent = computed(() => {
    const current = this.consultationsMoisCourant();
    const previous = this.consultationsMoisPrecedent();
    if (previous <= 0) {
      return current > 0 ? 100 : 0;
    }

    return Math.round(((current - previous) / previous) * 100);
  });

  readonly monthlyTrendLabel = computed(() => {
    const current = this.consultationsMoisCourant();
    const previous = this.consultationsMoisPrecedent();
    if (previous <= 0) {
      return current > 0 ? 'Nouveau' : 'Stable';
    }

    const value = this.monthlyTrendPercent();
    return `${value >= 0 ? '+' : ''}${value}%`;
  });

  readonly monthlyTrendClass = computed(() => {
    const current = this.consultationsMoisCourant();
    const previous = this.consultationsMoisPrecedent();
    if (previous <= 0) {
      return current > 0 ? 'positive' : 'neutral';
    }

    const value = this.monthlyTrendPercent();
    if (value > 0) {
      return 'positive';
    }

    if (value < 0) {
      return 'negative';
    }

    return 'neutral';
  });

  readonly pageRangeStart = computed(() => {
    const total = this.filteredConsultations().length;
    if (total === 0) {
      return 0;
    }

    return (this.currentPage() - 1) * this.pageSize + 1;
  });

  readonly pageRangeEnd = computed(() => {
    const total = this.filteredConsultations().length;
    return Math.min(this.currentPage() * this.pageSize, total);
  });

  readonly selectedConsultation = computed(() => {
    const id = this.selectedConsultationId();
    if (id === null) {
      return null;
    }

    return this.consultations().find((consultation) => consultation.id === id) ?? null;
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredConsultations().length / this.pageSize)));

  readonly pageNumbers = computed(() =>
    Array.from({ length: this.totalPages() }, (_, index) => index + 1)
  );

  readonly paginatedConsultations = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredConsultations().slice(start, start + this.pageSize);
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
      consultations: this.consultationsService.list(),
      patients: this.patientsService.list(),
      medecins: this.medecinsService.list()
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ consultations, patients, medecins }) => {
          this.consultations.set(consultations);
          this.patients.set(patients);
          this.medecins.set(medecins);

          this.form.controls.patient_id.setValue(patients[0]?.id ?? 1);
          this.form.controls.medecin_id.setValue(medecins[0]?.id ?? 1);
        },
        error: (error: Error) => this.errorMessage.set(error.message || 'Chargement des consultations impossible.')
      });
  }

  getPatientNom(id: number): string {
    const patient = this.patients().find((item) => item.id === id);
    return patient ? `${patient.prenom} ${patient.nom}` : 'Patient inconnu';
  }

  getMedecinNom(id: number): string {
    const medecin = this.medecins().find((item) => item.id === id);
    return medecin ? `Dr ${medecin.prenom} ${medecin.nom}` : 'Médecin inconnu';
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(1);
  }

  onStatutFilter(value: string): void {
    this.statutFilter.set(value as ConsultationStatusFilter);
    this.currentPage.set(1);
  }

  onMedecinFilter(value: string): void {
    this.medecinFilter.set(value);
    this.currentPage.set(1);
  }

  onOrdonnanceFilter(value: string): void {
    this.ordonnanceFilter.set(value as OrdonnanceFilter);
    this.currentPage.set(1);
  }

  openCreateForm(): void {
    this.editingId.set(null);
    this.selectedConsultationId.set(null);
    this.form.reset({
      patient_id: this.patients()[0]?.id ?? 1,
      medecin_id: this.medecins()[0]?.id ?? 1,
      date_consultation: '',
      motif_consultation: '',
      symptomes: '',
      diagnostic: '',
      observations: '',
      ordonnance: '',
      certificat: false
    });
    this.showForm.set(true);
  }

  openEditForm(consultation: Consultation): void {
    this.editingId.set(consultation.id);
    this.selectedConsultationId.set(null);
    this.form.setValue({
      patient_id: consultation.patient_id,
      medecin_id: consultation.medecin_id,
      date_consultation: consultation.date_consultation,
      motif_consultation: consultation.motif_consultation,
      symptomes: consultation.symptomes,
      diagnostic: consultation.diagnostic,
      observations: consultation.observations,
      ordonnance: consultation.ordonnance,
      certificat: consultation.certificat
    });
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  openDetails(consultation: Consultation): void {
    this.selectedConsultationId.set(consultation.id);
    this.showForm.set(false);
    this.editingId.set(null);
  }

  closeDetails(): void {
    this.selectedConsultationId.set(null);
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
    const request$ = id
      ? this.consultationsService.update(id, payload)
      : this.consultationsService.create(payload);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.cancelForm();
        this.loadData();
      },
      error: (error: Error) => this.errorMessage.set(error.message || 'Sauvegarde impossible.')
    });
  }

  deleteConsultation(id: number): void {
    if (!confirm('Supprimer cette consultation ?')) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.consultationsService
      .delete(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          if (this.selectedConsultationId() === id) {
            this.selectedConsultationId.set(null);
          }

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

  exportConsultations(): void {
    const rows = this.filteredConsultations().map((consultation) => {
      const date = `${this.getDateLabel(consultation.date_consultation)} ${this.getConsultationTime(consultation)}`;
      return [
        consultation.id,
        this.getPatientNom(consultation.patient_id),
        this.getMedecinNom(consultation.medecin_id),
        date,
        this.getConsultationType(consultation),
        consultation.diagnostic,
        this.getDureeLabel(consultation),
        this.hasOrdonnance(consultation) ? 'Oui' : 'Non',
        this.getConsultationStatusLabel(consultation)
      ];
    });

    const csvLines = [
      'ID,Patient,Médecin,DateHeure,Type,Diagnostic,Durée,Ordonnance,Statut',
      ...rows.map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      )
    ];

    const blob = new Blob([`\uFEFF${csvLines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `consultations-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  exportOrdonnance(consultation: Consultation): void {
    this.errorMessage.set('');

    if (!consultation.ordonnance.trim()) {
      this.errorMessage.set('Aucune ordonnance disponible pour cette consultation.');
      return;
    }

    const patient = this.getPatient(consultation.patient_id);
    const medecin = this.getMedecin(consultation.medecin_id);
    if (!patient || !medecin) {
      this.errorMessage.set('Informations patient ou medecin manquantes pour exporter l ordonnance.');
      return;
    }

    const patientName = `${patient.prenom} ${patient.nom}`;
    const medecinName = `Dr ${medecin.prenom} ${medecin.nom}`;
    const consultationDate = this.formatDisplayDate(consultation.date_consultation);
    const exportDate = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date());

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(15, 118, 110);
    doc.text('SenClinic', 14, y);

    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Plateforme clinique nationale', 14, y);

    y += 5;
    doc.setDrawColor(15, 118, 110);
    doc.setLineWidth(0.4);
    doc.line(14, y, 196, y);

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(29, 78, 216);
    doc.text('Ordonnance medicale', 14, y);

    y += 7;
    doc.setTextColor(15, 23, 42);
    y = this.writePdfField(doc, 'Date export', exportDate, y);
    y = this.writePdfField(doc, 'Date consultation', consultationDate, y);
    y = this.writePdfField(doc, 'Patient', patientName, y);
    y = this.writePdfField(doc, 'Medecin', medecinName, y);
    y = this.writePdfField(doc, 'Motif', consultation.motif_consultation, y);
    y = this.writePdfField(doc, 'Diagnostic', consultation.diagnostic, y);

    y += 2;
    y = this.writePdfParagraph(doc, 'Ordonnance', consultation.ordonnance, y);
    y = this.writePdfParagraph(doc, 'Observations', consultation.observations, y);

    y = this.ensurePdfSpace(doc, y, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Document genere depuis SenClinic.', 14, y);

    const safePatient = `${patient.prenom}-${patient.nom}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-');
    const fileName = `ordonnance-${safePatient}-${consultation.date_consultation}.pdf`;
    doc.save(fileName);
  }

  private getPatient(id: number): Patient | undefined {
    return this.patients().find((item) => item.id === id);
  }

  private getMedecin(id: number): Medecin | undefined {
    return this.medecins().find((item) => item.id === id);
  }

  private formatDisplayDate(value: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(this.parseDate(value));
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map((item) => Number(item));
    return new Date(year, (month || 1) - 1, day || 1);
  }

  getPatientCode(id: number): string {
    const patient = this.getPatient(id);
    return patient?.numero_dossier ?? 'P-000';
  }

  getPatientInitials(id: number): string {
    const patient = this.getPatient(id);
    if (!patient) {
      return 'PT';
    }

    return `${patient.prenom.charAt(0)}${patient.nom.charAt(0)}`.toUpperCase();
  }

  getMedecinSpecialite(id: number): string {
    return this.getMedecin(id)?.specialite ?? 'Spécialité non définie';
  }

  getDateLabel(date: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(this.parseDate(date));
  }

  getConsultationTime(consultation: Consultation): string {
    const slots = ['09:30', '10:00', '08:30', '11:00', '09:00', '10:45', '11:30', '14:10'];
    return slots[(consultation.id - 1) % slots.length];
  }

  getConsultationType(consultation: Consultation): string {
    const text = consultation.motif_consultation.toLowerCase();
    if (text.includes('suivi')) {
      return 'Suivi spécialisé';
    }
    if (text.includes('bilan')) {
      return 'Bilan de sante';
    }
    if (text.includes('enfant') || text.includes('pedi')) {
      return 'Consultation pédiatrique';
    }

    return 'Consultation generale';
  }

  getConsultationTypeClass(consultation: Consultation): string {
    const type = this.getConsultationType(consultation);
    if (type.includes('pédiatrique')) {
      return 'pediatrique';
    }
    if (type.includes('suivi')) {
      return 'suivi';
    }
    if (type.includes('bilan')) {
      return 'bilan';
    }

    return 'general';
  }

  getDiagnosticHint(consultation: Consultation): string {
    const hints = ['145/92 mmHg', '128/82 mmHg', '120/78 mmHg', '118/76 mmHg', '132/84 mmHg'];
    return hints[(consultation.id - 1) % hints.length];
  }

  getDureeLabel(consultation: Consultation): string {
    const durations = [55, 42, 28, 40, 35, 58, 25, 50];
    return `${durations[(consultation.id - 1) % durations.length]} min`;
  }

  hasOrdonnance(consultation: Consultation): boolean {
    return consultation.ordonnance.trim().length > 0;
  }

  getOrdonnanceLabel(consultation: Consultation): string {
    return this.hasOrdonnance(consultation) ? 'Oui' : '-';
  }

  getConsultationStatus(consultation: Consultation): ConsultationStatus {
    const cycle: ConsultationStatus[] = ['terminee', 'en_cours', 'terminee', 'annulee', 'en_cours', 'terminee'];
    return cycle[(consultation.id - 1) % cycle.length];
  }

  getConsultationStatusLabel(consultation: Consultation): string {
    const status = this.getConsultationStatus(consultation);
    if (status === 'en_cours') {
      return 'En cours';
    }
    if (status === 'annulee') {
      return 'Annulee';
    }

    return 'Terminée';
  }

  getConsultationStatusClass(consultation: Consultation): string {
    return this.getConsultationStatus(consultation);
  }

  private ensurePdfSpace(doc: jsPDF, y: number, neededHeight = 8): number {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + neededHeight > pageHeight - 14) {
      doc.addPage();
      return 18;
    }

    return y;
  }

  private writePdfField(doc: jsPDF, label: string, value: string, y: number): number {
    let nextY = this.ensurePdfSpace(doc, y, 9);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`${label}:`, 14, nextY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(value || '-', 144) as string[];
    doc.text(lines, 48, nextY);

    nextY += Math.max(6, lines.length * 5.2);
    return nextY + 1;
  }

  private writePdfParagraph(doc: jsPDF, title: string, content: string, y: number): number {
    let nextY = this.ensurePdfSpace(doc, y, 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 79, 70);
    doc.text(title, 14, nextY);
    nextY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(content || '-', 182) as string[];
    for (const line of lines) {
      nextY = this.ensurePdfSpace(doc, nextY, 6);
      doc.text(line, 14, nextY);
      nextY += 5;
    }

    return nextY + 2;
  }
}
