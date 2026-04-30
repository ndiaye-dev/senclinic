import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { ConsultationsService } from '../../../core/services/consultations.service';
import { MedecinsService } from '../../../core/services/medecins.service';
import { PatientsService } from '../../../core/services/patients.service';
import { RendezVousService } from '../../../core/services/rendez-vous.service';
import type { Consultation } from '../../../core/models/consultation.model';
import type { Medecin } from '../../../core/models/medecin.model';
import type { Patient } from '../../../core/models/patient.model';
import type { RendezVous } from '../../../core/models/rendez-vous.model';

interface DashboardNotification {
  id: string;
  tone: 'warning' | 'info' | 'danger' | 'success';
  title: string;
  detail: string;
  timeLabel: string;
  actionLabel: string;
  actionPath: string;
}

interface PlanningRow {
  id: number;
  heure: string;
  patientNom: string;
  patientInitials: string;
  medecinNom: string;
  typeConsultation: string;
  salle: string;
  statutLabel: string;
  statutTone: 'planifie' | 'confirme' | 'encours' | 'annule';
  dotTone: 'green' | 'blue' | 'orange' | 'red';
}

interface DashboardKpiCard {
  tone: 'teal' | 'blue' | 'green' | 'amber';
  icon: string;
  trend: string;
  value: number;
  label: string;
  spark: number[];
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss'
})
export class DashboardPageComponent {
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly hideNotifications = signal(false);

  readonly medecins = signal<Medecin[]>([]);
  readonly patients = signal<Patient[]>([]);
  readonly rendezVous = signal<RendezVous[]>([]);
  readonly consultations = signal<Consultation[]>([]);
  readonly todayLabel = this.formatDateLong(new Date());
  readonly displayDayLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date());
  readonly currentUserName = 'Amadou Diallo';
  readonly quickActions = [
    {
      label: 'Nouveau patient',
      description: 'Enregistrer un nouveau dossier medical',
      path: '/patients'
    },
    {
      label: 'Planifier un rendez-vous',
      description: 'Creer un rendez-vous dans le calendrier',
      path: '/rendez-vous'
    },
    {
      label: 'Saisir une consultation',
      description: 'Ajouter compte rendu, diagnostic, ordonnance',
      path: '/consultations'
    },
    {
      label: 'Gerer les medecins',
      description: 'Mettre a jour disponibilites et equipes',
      path: '/medecins'
    }
  ] as const;

  readonly dashboardKpis = signal<DashboardKpiCard[]>([
    {
      tone: 'teal',
      icon: 'P',
      trend: '+47',
      value: 1248,
      label: 'Patients actifs',
      spark: [30, 42, 36, 50, 47, 56, 55, 66, 63, 79]
    },
    {
      tone: 'blue',
      icon: 'R',
      trend: '+6',
      value: 34,
      label: "Rendez-vous aujourd'hui",
      spark: [45, 39, 50, 47, 58, 54, 60, 56, 68, 75]
    },
    {
      tone: 'green',
      icon: 'C',
      trend: '+28',
      value: 312,
      label: 'Consultations ce mois',
      spark: [36, 47, 41, 53, 50, 61, 57, 68, 64, 80]
    },
    {
      tone: 'amber',
      icon: 'M',
      trend: '',
      value: 18,
      label: 'Medecins actifs',
      spark: [48, 45, 52, 50, 58, 54, 59, 62, 66, 73]
    }
  ]);

  readonly totalPatients = computed(() => this.patients().length);
  readonly totalMedecins = computed(() => this.medecins().length);
  readonly consultationsCount = computed(() => this.consultations().length);
  readonly medecinsActifs = computed(() => this.medecins().filter((medecin) => medecin.statut === 'actif').length);
  readonly patientsHospitalises = computed(
    () => this.patients().filter((patient) => patient.statut === 'hospitalise').length
  );
  readonly certificatsDelivres = computed(
    () => this.consultations().filter((consultation) => consultation.certificat).length
  );
  readonly rdvAujourdhui = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.rendezVous().filter((rdv) => rdv.date_rdv === today).length;
  });
  readonly rdvSemaine = computed(() => {
    const today = new Date();
    const start = new Date(today);
    const end = new Date(today);
    end.setDate(today.getDate() + 7);

    return this.rendezVous().filter((rdv) => {
      const rdvDate = new Date(`${rdv.date_rdv}T00:00:00`);
      return rdvDate >= start && rdvDate <= end;
    }).length;
  });
  readonly tauxRdvConfirmes = computed(() => {
    const total = this.rendezVous().length;
    if (total === 0) {
      return 0;
    }

    const confirmes = this.rendezVous().filter((rdv) => rdv.statut === 'confirme' || rdv.statut === 'termine').length;
    return Math.round((confirmes / total) * 100);
  });
  readonly chargeMoyenneParMedecin = computed(() => {
    const medecins = this.medecinsActifs();
    if (medecins === 0) {
      return 0;
    }

    return Math.round(this.totalPatients() / medecins);
  });
  readonly occupationMedicale = computed(() => {
    const reference = Math.max(1, this.medecinsActifs() * 24);
    return Math.min(100, Math.round((this.totalPatients() / reference) * 100));
  });
  readonly patientsParSexe = computed(() => {
    const total = this.totalPatients() || 1;
    const hommes = this.patients().filter((patient) => patient.sexe === 'Homme').length;
    const femmes = this.patients().filter((patient) => patient.sexe === 'Femme').length;
    const autres = this.patients().filter((patient) => patient.sexe === 'Autre').length;

    return {
      hommes,
      femmes,
      autres,
      pctHommes: Math.round((hommes / total) * 100),
      pctFemmes: Math.round((femmes / total) * 100),
      pctAutres: Math.round((autres / total) * 100)
    };
  });
  readonly sexeDonutStyle = computed(() => {
    const stats = this.patientsParSexe();
    const maleStop = stats.pctHommes;
    const femaleStop = stats.pctHommes + stats.pctFemmes;

    return `conic-gradient(
      #1d4ed8 0% ${maleStop}%,
      #0f766e ${maleStop}% ${femaleStop}%,
      #f59e0b ${femaleStop}% 100%
    )`;
  });
  readonly topMedecinsCharge = computed(() => {
    const counts = new Map<number, number>();
    for (const patient of this.patients()) {
      counts.set(patient.medecin_traitant, (counts.get(patient.medecin_traitant) ?? 0) + 1);
    }

    const max = Math.max(1, ...counts.values());

    return this.medecins()
      .filter((medecin) => medecin.statut === 'actif')
      .map((medecin) => {
        const patients = counts.get(medecin.id) ?? 0;
        return {
          id: medecin.id,
          nom: `Dr ${medecin.prenom} ${medecin.nom}`,
          specialite: medecin.specialite,
          patients,
          fill: Math.round((patients / max) * 100)
        };
      })
      .sort((a, b) => b.patients - a.patients)
      .slice(0, 4);
  });

  readonly distributionRendezVous = computed(() => {
    const collection = this.rendezVous();
    const total = collection.length || 1;
    const statuses: RendezVous['statut'][] = ['planifie', 'confirme', 'termine', 'annule'];

    return statuses.map((status) => {
      const count = collection.filter((rdv) => rdv.statut === status).length;
      const percentage = Math.round((count / total) * 100);

      return {
        status,
        count,
        percentage
      };
    });
  });
  readonly alertesPrioritaires = computed(() => {
    const alertes: Array<{ niveau: 'critique' | 'attention' | 'ok'; titre: string; detail: string }> = [];

    if (this.patientsHospitalises() >= 2) {
      alertes.push({
        niveau: 'critique',
        titre: 'Surveillance hospitalisation',
        detail: `${this.patientsHospitalises()} patients sont actuellement hospitalises.`
      });
    }

    if (this.tauxRdvConfirmes() < 60) {
      alertes.push({
        niveau: 'attention',
        titre: 'Confirmation des rendez-vous',
        detail: `Le taux de confirmation est de ${this.tauxRdvConfirmes()}%. Pensez a relancer les patients.`
      });
    }

    if (this.occupationMedicale() > 78) {
      alertes.push({
        niveau: 'attention',
        titre: 'Capacite medicale elevee',
        detail: `Occupation estimee a ${this.occupationMedicale()}%, reequilibrage des plannings recommande.`
      });
    }

    if (alertes.length === 0) {
      alertes.push({
        niveau: 'ok',
        titre: 'Situation stable',
        detail: 'Aucun signal critique detecte sur le flux clinique.'
      });
    }

    return alertes.slice(0, 3);
  });

  readonly notificationFeed = computed<DashboardNotification[]>(() => {
    if (this.hideNotifications()) {
      return [];
    }

    const prioritized: DashboardNotification[] = this.alertesPrioritaires().map((alerte, index) => {
      const tone: DashboardNotification['tone'] =
        alerte.niveau === 'critique' ? 'danger' : alerte.niveau === 'attention' ? 'warning' : 'success';

      return {
        id: `priorite-${index}`,
        tone,
        title: alerte.titre,
        detail: alerte.detail,
        timeLabel: index === 0 ? 'Il y a 10 min' : index === 1 ? 'Il y a 25 min' : 'Il y a 1 h',
        actionLabel: alerte.niveau === 'critique' ? 'Intervenir' : 'Replanifier',
        actionPath: '/rendez-vous'
      };
    });

    const latestPatient = this.patients().at(-1);
    const latestConsultation = this.consultations().at(-1);

    const extras: DashboardNotification[] = [];
    if (latestPatient) {
      extras.push({
        id: `patient-${latestPatient.id}`,
        tone: 'info',
        title: 'Nouveau patient',
        detail: `${latestPatient.prenom} ${latestPatient.nom} vient d'etre enregistre dans le systeme.`,
        timeLabel: 'Il y a 25 min',
        actionLabel: 'Voir le dossier',
        actionPath: '/patients'
      });
    }

    if (latestConsultation) {
      extras.push({
        id: `consultation-${latestConsultation.id}`,
        tone: 'success',
        title: 'Consultation terminee',
        detail: `${this.getMedecinNom(latestConsultation.medecin_id)} a cloture la consultation de ${this.getPatientNom(latestConsultation.patient_id)}.`,
        timeLabel: 'Il y a 1 h',
        actionLabel: 'Voir le rapport',
        actionPath: '/consultations'
      });
    }

    return [...prioritized, ...extras].slice(0, 4);
  });

  readonly agendaAujourdhui = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    const patientsMap = new Map(this.patients().map((patient) => [patient.id, `${patient.prenom} ${patient.nom}`]));
    const medecinsMap = new Map(this.medecins().map((medecin) => [medecin.id, `Dr ${medecin.prenom} ${medecin.nom}`]));

    return this.rendezVous()
      .filter((rdv) => rdv.date_rdv === today)
      .sort((a, b) => a.heure_rdv.localeCompare(b.heure_rdv))
      .map((rdv) => ({
        ...rdv,
        patientNom: patientsMap.get(rdv.patient_id) ?? 'Patient inconnu',
        medecinNom: medecinsMap.get(rdv.medecin_id) ?? 'Medecin inconnu'
      }));
  });
  readonly dernieresConsultations = computed(() => {
    const patientsMap = new Map(this.patients().map((patient) => [patient.id, `${patient.prenom} ${patient.nom}`]));
    const medecinsMap = new Map(this.medecins().map((medecin) => [medecin.id, `Dr ${medecin.prenom} ${medecin.nom}`]));

    return [...this.consultations()]
      .sort((a, b) => b.date_consultation.localeCompare(a.date_consultation))
      .slice(0, 4)
      .map((consultation) => ({
        ...consultation,
        patientNom: patientsMap.get(consultation.patient_id) ?? 'Patient inconnu',
        medecinNom: medecinsMap.get(consultation.medecin_id) ?? 'Medecin inconnu'
      }));
  });

  readonly prochainRendezVous = computed(() => {
    const patientsMap = new Map(this.patients().map((patient) => [patient.id, `${patient.prenom} ${patient.nom}`]));
    const medecinsMap = new Map(this.medecins().map((medecin) => [medecin.id, `Dr ${medecin.prenom} ${medecin.nom}`]));

    return this.rendezVous()
      .filter((rdv) => rdv.statut === 'planifie' || rdv.statut === 'confirme')
      .sort((a, b) => {
        const first = `${a.date_rdv}T${a.heure_rdv}`;
        const second = `${b.date_rdv}T${b.heure_rdv}`;
        return first.localeCompare(second);
      })
      .slice(0, 6)
      .map((rdv) => ({
        ...rdv,
        patientNom: patientsMap.get(rdv.patient_id) ?? 'Patient inconnu',
        medecinNom: medecinsMap.get(rdv.medecin_id) ?? 'Medecin inconnu'
      }));
  });

  readonly planningRows = computed<PlanningRow[]>(() => {
    const baseRows = this.agendaAujourdhui().length > 0 ? this.agendaAujourdhui() : this.prochainRendezVous().slice(0, 7);

    return baseRows.map((item, index) => {
      const statutTone = this.mapStatusTone(item.statut);
      return {
        id: item.id,
        heure: item.heure_rdv,
        patientNom: item.patientNom,
        patientInitials: this.extractInitials(item.patientNom),
        medecinNom: item.medecinNom,
        typeConsultation: this.formatConsultationType(item.motif),
        salle: `Salle ${((item.medecin_id + index) % 4) + 1}`,
        statutLabel: this.formatStatusLabel(item.statut),
        statutTone,
        dotTone:
          statutTone === 'annule' ? 'red' : statutTone === 'confirme' ? 'green' : statutTone === 'encours' ? 'blue' : 'orange'
      };
    });
  });

  readonly planningStats = computed(() => {
    const rows = this.planningRows();
    return {
      confirmes: rows.filter((row) => row.statutTone === 'confirme').length,
      enCours: rows.filter((row) => row.statutTone === 'encours').length,
      annules: rows.filter((row) => row.statutTone === 'annule').length
    };
  });

  readonly satisfactionNote = computed(() => {
    const base = 4.3 + Math.min(0.6, this.consultationsCount() / 100);
    return `${base.toFixed(1)}/5`;
  });

  constructor(
    private readonly patientsService: PatientsService,
    private readonly medecinsService: MedecinsService,
    private readonly rendezVousService: RendezVousService,
    private readonly consultationsService: ConsultationsService
  ) {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    forkJoin({
      patients: this.patientsService.list(),
      medecins: this.medecinsService.list(),
      rendezVous: this.rendezVousService.list(),
      consultations: this.consultationsService.list()
    })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ patients, medecins, rendezVous, consultations }) => {
          this.hideNotifications.set(false);
          this.patients.set(patients);
          this.medecins.set(medecins);
          this.rendezVous.set(rendezVous);
          this.consultations.set(consultations);
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message || 'Erreur lors du chargement du tableau de bord.');
        }
      });
  }

  toggleNotifications(): void {
    this.hideNotifications.update((value) => !value);
  }

  getNotificationToneLabel(tone: DashboardNotification['tone']): string {
    if (tone === 'danger') {
      return 'Urgent';
    }
    if (tone === 'warning') {
      return 'Attention';
    }
    if (tone === 'info') {
      return 'Information';
    }
    return 'Succes';
  }

  getQuickActionTone(path: string): 'tone-patient' | 'tone-rdv' | 'tone-consultation' | 'tone-medecin' {
    if (path === '/rendez-vous') {
      return 'tone-rdv';
    }
    if (path === '/consultations') {
      return 'tone-consultation';
    }
    if (path === '/medecins') {
      return 'tone-medecin';
    }
    return 'tone-patient';
  }

  getQuickActionGlyph(path: string): string {
    if (path === '/rendez-vous') {
      return 'RDV';
    }
    if (path === '/consultations') {
      return 'CR';
    }
    if (path === '/medecins') {
      return 'DR';
    }
    return 'PAT';
  }

  formatKpiNumber(value: number): string {
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  private formatDateLong(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  private extractInitials(fullName: string): string {
    const chunks = fullName.split(' ').filter(Boolean);
    return `${chunks[0]?.charAt(0) ?? ''}${chunks[1]?.charAt(0) ?? ''}`.toUpperCase();
  }

  private formatConsultationType(motif: string): string {
    if (!motif) {
      return 'Consultation generale';
    }

    return motif.charAt(0).toUpperCase() + motif.slice(1);
  }

  private mapStatusTone(status: RendezVous['statut']): 'planifie' | 'confirme' | 'encours' | 'annule' {
    if (status === 'confirme') {
      return 'confirme';
    }

    if (status === 'termine') {
      return 'encours';
    }

    if (status === 'annule') {
      return 'annule';
    }

    return 'planifie';
  }

  private formatStatusLabel(status: RendezVous['statut']): string {
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

  private getPatientNom(patientId: number): string {
    const patient = this.patients().find((entry) => entry.id === patientId);
    return patient ? `${patient.prenom} ${patient.nom}` : 'Patient inconnu';
  }

  private getMedecinNom(medecinId: number): string {
    const medecin = this.medecins().find((entry) => entry.id === medecinId);
    return medecin ? `Dr ${medecin.prenom} ${medecin.nom}` : 'Medecin inconnu';
  }
}
