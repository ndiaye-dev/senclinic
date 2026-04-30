import type { Consultation } from '../models/consultation.model';
import type { Medecin } from '../models/medecin.model';
import type { Patient } from '../models/patient.model';
import type { RendezVous } from '../models/rendez-vous.model';
import type { Utilisateur } from '../models/utilisateur.model';

export const DEMO_MEDECINS: Medecin[] = [
  {
    id: 1,
    numero_ordre: 'SN-MED-10234',
    nom: 'Ndiaye',
    prenom: 'Fatou',
    specialite: 'Medecine generale',
    telephone: '+221 77 401 23 45',
    email: 'fatou.ndiaye@senclinic.sn',
    statut: 'actif'
  },
  {
    id: 2,
    numero_ordre: 'SN-MED-88421',
    nom: 'Diop',
    prenom: 'Mamadou',
    specialite: 'Cardiologie',
    telephone: '+221 70 218 67 10',
    email: 'mamadou.diop@senclinic.sn',
    statut: 'actif'
  },
  {
    id: 3,
    numero_ordre: 'SN-MED-65790',
    nom: 'Sarr',
    prenom: 'Awa',
    specialite: 'Pediatrie',
    telephone: '+221 78 522 40 11',
    email: 'awa.sarr@senclinic.sn',
    statut: 'conge'
  },
  {
    id: 4,
    numero_ordre: 'SN-MED-30014',
    nom: 'Ba',
    prenom: 'Ibrahima',
    specialite: 'Dermatologie',
    telephone: '+221 76 881 29 90',
    email: 'ibrahima.ba@senclinic.sn',
    statut: 'actif'
  },
  {
    id: 5,
    numero_ordre: 'SN-MED-77122',
    nom: 'Faye',
    prenom: 'Marieme',
    specialite: 'Gynecologie',
    telephone: '+221 75 990 15 20',
    email: 'marieme.faye@senclinic.sn',
    statut: 'actif'
  },
  {
    id: 6,
    numero_ordre: 'SN-MED-99441',
    nom: 'Gueye',
    prenom: 'Cheikh',
    specialite: 'Orthopedie',
    telephone: '+221 77 665 88 12',
    email: 'cheikh.gueye@senclinic.sn',
    statut: 'inactif'
  }
];

export const DEMO_PATIENTS: Patient[] = [
  {
    id: 1,
    numero_dossier: 'PAT-DAK-0001',
    nom: 'Sow',
    prenom: 'Aminata',
    date_naissance: '1992-02-17',
    sexe: 'Femme',
    groupe_sanguin: 'O+',
    poids: 63,
    telephone: '+221 77 122 30 40',
    adresse: 'Sicap Liberte 6, Dakar',
    email: 'aminata.sow@email.sn',
    numero_securite_sociale: 'SN-SS-920217-004',
    allergies: 'Penicilline',
    antecedents_medicaux: 'Asthme leger',
    traitements_cours: 'Ventoline',
    medecin_traitant: 1,
    statut: 'actif'
  },
  {
    id: 2,
    numero_dossier: 'PAT-THI-0002',
    nom: 'Ndao',
    prenom: 'Babacar',
    date_naissance: '1981-09-30',
    sexe: 'Homme',
    groupe_sanguin: 'A+',
    poids: 79,
    telephone: '+221 70 443 50 61',
    adresse: 'Keur Massar, Dakar',
    email: 'babacar.ndao@email.sn',
    numero_securite_sociale: 'SN-SS-810930-009',
    allergies: 'Aucune',
    antecedents_medicaux: 'Hypertension',
    traitements_cours: 'Amlodipine',
    medecin_traitant: 2,
    statut: 'actif'
  },
  {
    id: 3,
    numero_dossier: 'PAT-SLS-0003',
    nom: 'Sy',
    prenom: 'Khadija',
    date_naissance: '2015-07-05',
    sexe: 'Femme',
    groupe_sanguin: 'B+',
    poids: 28,
    telephone: '+221 76 550 01 77',
    adresse: 'Guediawaye, Dakar',
    email: 'famille.sy@email.sn',
    numero_securite_sociale: 'SN-SS-150705-011',
    allergies: 'Arachides',
    antecedents_medicaux: 'Bronchiolite recurrente',
    traitements_cours: 'Nebulisation ponctuelle',
    medecin_traitant: 3,
    statut: 'actif'
  },
  {
    id: 4,
    numero_dossier: 'PAT-MBO-0004',
    nom: 'Diallo',
    prenom: 'Ousmane',
    date_naissance: '1972-12-01',
    sexe: 'Homme',
    groupe_sanguin: 'AB+',
    poids: 86,
    telephone: '+221 77 344 20 10',
    adresse: 'Mbour, Thiès',
    email: 'ousmane.diallo@email.sn',
    numero_securite_sociale: 'SN-SS-721201-026',
    allergies: 'Aucune',
    antecedents_medicaux: 'Diabete type 2',
    traitements_cours: 'Metformine',
    medecin_traitant: 2,
    statut: 'hospitalise'
  },
  {
    id: 5,
    numero_dossier: 'PAT-ZIG-0005',
    nom: 'Coly',
    prenom: 'Aissatou',
    date_naissance: '1998-04-14',
    sexe: 'Femme',
    groupe_sanguin: 'O-',
    poids: 55,
    telephone: '+221 75 140 03 92',
    adresse: 'Ziguinchor',
    email: 'aissatou.coly@email.sn',
    numero_securite_sociale: 'SN-SS-980414-035',
    allergies: 'Aucune',
    antecedents_medicaux: 'Migraine chronique',
    traitements_cours: 'Paracetamol si crise',
    medecin_traitant: 1,
    statut: 'actif'
  },
  {
    id: 6,
    numero_dossier: 'PAT-STL-0006',
    nom: 'Thiam',
    prenom: 'Moussa',
    date_naissance: '1965-10-11',
    sexe: 'Homme',
    groupe_sanguin: 'A-',
    poids: 72,
    telephone: '+221 77 701 90 81',
    adresse: 'Saint-Louis',
    email: 'moussa.thiam@email.sn',
    numero_securite_sociale: 'SN-SS-651011-041',
    allergies: 'Iode',
    antecedents_medicaux: 'Insuffisance cardiaque',
    traitements_cours: 'Furosemide',
    medecin_traitant: 2,
    statut: 'actif'
  },
  {
    id: 7,
    numero_dossier: 'PAT-DAK-0007',
    nom: 'Fall',
    prenom: 'Ndeye',
    date_naissance: '2001-01-22',
    sexe: 'Femme',
    groupe_sanguin: 'B-',
    poids: 59,
    telephone: '+221 70 654 43 00',
    adresse: 'Yoff, Dakar',
    email: 'ndeye.fall@email.sn',
    numero_securite_sociale: 'SN-SS-010122-058',
    allergies: 'Aucune',
    antecedents_medicaux: 'Anemie',
    traitements_cours: 'Fer oral',
    medecin_traitant: 5,
    statut: 'actif'
  },
  {
    id: 8,
    numero_dossier: 'PAT-DAK-0008',
    nom: 'Camara',
    prenom: 'Lamine',
    date_naissance: '1988-03-09',
    sexe: 'Homme',
    groupe_sanguin: 'O+',
    poids: 95,
    telephone: '+221 78 211 62 74',
    adresse: 'Parcelles Assainies, Dakar',
    email: 'lamine.camara@email.sn',
    numero_securite_sociale: 'SN-SS-880309-063',
    allergies: 'Crustaces',
    antecedents_medicaux: 'Obesite',
    traitements_cours: 'Regime alimentaire',
    medecin_traitant: 1,
    statut: 'actif'
  },
  {
    id: 9,
    numero_dossier: 'PAT-TAM-0009',
    nom: 'Kane',
    prenom: 'Seydou',
    date_naissance: '2010-06-18',
    sexe: 'Homme',
    groupe_sanguin: 'AB-',
    poids: 39,
    telephone: '+221 76 911 08 19',
    adresse: 'Tambacounda',
    email: 'famille.kane@email.sn',
    numero_securite_sociale: 'SN-SS-100618-074',
    allergies: 'Aucune',
    antecedents_medicaux: 'Epilepsie stabilisee',
    traitements_cours: 'Valproate',
    medecin_traitant: 3,
    statut: 'actif'
  },
  {
    id: 10,
    numero_dossier: 'PAT-DAK-0010',
    nom: 'Mbaye',
    prenom: 'Rokhaya',
    date_naissance: '1994-11-02',
    sexe: 'Femme',
    groupe_sanguin: 'A+',
    poids: 67,
    telephone: '+221 77 560 13 39',
    adresse: 'Ouakam, Dakar',
    email: 'rokhaya.mbaye@email.sn',
    numero_securite_sociale: 'SN-SS-941102-086',
    allergies: 'Aucune',
    antecedents_medicaux: 'Eczema',
    traitements_cours: 'Creme dermique',
    medecin_traitant: 4,
    statut: 'actif'
  }  ,
  {
    id: 11,
    numero_dossier: 'PAT-DKR-0011',
    nom: 'Diop',
    prenom: 'Abdoulaye',
    date_naissance: '1955-12-03',
    sexe: 'Homme',
    groupe_sanguin: 'B-',
    poids: 70,
    telephone: '+221 70 789 01 23',
    adresse: 'Grand Yoff, Dakar',
    email: 'abdoulaye.diop@email.sn',
    numero_securite_sociale: 'SN-SS-551203-097',
    allergies: 'Aucune',
    antecedents_medicaux: 'Arthrose',
    traitements_cours: 'Paracetamol',
    medecin_traitant: 1,
    statut: 'actif'
  },
  {
    id: 12,
    numero_dossier: 'PAT-DKR-0012',
    nom: 'Cisse',
    prenom: 'Fatimata',
    date_naissance: '1998-08-25',
    sexe: 'Femme',
    groupe_sanguin: 'O+',
    poids: 59,
    telephone: '+221 78 890 12 34',
    adresse: 'Point E, Dakar',
    email: 'fatimata.cisse@email.sn',
    numero_securite_sociale: 'SN-SS-980825-104',
    allergies: 'Aucune',
    antecedents_medicaux: 'Aucun',
    traitements_cours: 'Aucun',
    medecin_traitant: 2,
    statut: 'inactif'
  }
];

export const DEMO_RENDEZ_VOUS: RendezVous[] = [
  {
    id: 1,
    patient_id: 1,
    medecin_id: 1,
    date_rdv: '2026-04-25',
    heure_rdv: '08:30',
    motif: 'Controle asthme',
    statut: 'planifie'
  },
  {
    id: 2,
    patient_id: 2,
    medecin_id: 2,
    date_rdv: '2026-04-25',
    heure_rdv: '10:00',
    motif: 'Suivi tension arterielle',
    statut: 'confirme'
  },
  {
    id: 3,
    patient_id: 3,
    medecin_id: 3,
    date_rdv: '2026-04-26',
    heure_rdv: '09:15',
    motif: 'Visite pediatrique',
    statut: 'planifie'
  },
  {
    id: 4,
    patient_id: 4,
    medecin_id: 2,
    date_rdv: '2026-04-24',
    heure_rdv: '15:10',
    motif: 'Bilans cardiaques',
    statut: 'termine'
  },
  {
    id: 5,
    patient_id: 5,
    medecin_id: 1,
    date_rdv: '2026-04-27',
    heure_rdv: '11:45',
    motif: 'Migraine recurrente',
    statut: 'confirme'
  },
  {
    id: 6,
    patient_id: 6,
    medecin_id: 2,
    date_rdv: '2026-04-28',
    heure_rdv: '13:30',
    motif: 'Suivi insuffisance cardiaque',
    statut: 'planifie'
  },
  {
    id: 7,
    patient_id: 8,
    medecin_id: 1,
    date_rdv: '2026-04-24',
    heure_rdv: '17:00',
    motif: 'Conseil nutrition',
    statut: 'annule'
  },
  {
    id: 8,
    patient_id: 9,
    medecin_id: 3,
    date_rdv: '2026-04-29',
    heure_rdv: '09:00',
    motif: 'Controle neurologique',
    statut: 'planifie'
  }
];

export const DEMO_CONSULTATIONS: Consultation[] = [
  {
    id: 1,
    patient_id: 1,
    medecin_id: 1,
    date_consultation: '2026-04-20',
    motif_consultation: 'Crises respiratoires nocturnes',
    symptomes: 'Toux seche, sifflements',
    diagnostic: 'Asthme persistant modere',
    observations: 'Bonne adherence au traitement',
    ordonnance: 'Budesonide 200mcg, 2x/jour',
    certificat: false
  },
  {
    id: 2,
    patient_id: 2,
    medecin_id: 2,
    date_consultation: '2026-04-19',
    motif_consultation: 'Palpitations',
    symptomes: 'Essoufflement a l effort',
    diagnostic: 'Trouble du rythme cardiaque leger',
    observations: 'ECG a refaire sous 2 semaines',
    ordonnance: 'Bisoprolol 2.5mg',
    certificat: true
  },
  {
    id: 3,
    patient_id: 3,
    medecin_id: 3,
    date_consultation: '2026-04-18',
    motif_consultation: 'Fievre chez enfant',
    symptomes: '38.7C, fatigue',
    diagnostic: 'Infection virale',
    observations: 'Hydratation et surveillance',
    ordonnance: 'Paracetamol pediatrique',
    certificat: true
  },
  {
    id: 4,
    patient_id: 10,
    medecin_id: 4,
    date_consultation: '2026-04-16',
    motif_consultation: 'Irritation cutanee',
    symptomes: 'Plaques erythemateuses',
    diagnostic: 'Dermatite atopique',
    observations: 'Eviter savons agressifs',
    ordonnance: 'Creme hydratante + corticoide local',
    certificat: false
  },
  {
    id: 5,
    patient_id: 7,
    medecin_id: 5,
    date_consultation: '2026-04-14',
    motif_consultation: 'Suivi gynecologique',
    symptomes: 'Douleurs pelviennes legeres',
    diagnostic: 'Syndrome premenstruel',
    observations: 'Aucune complication detectee',
    ordonnance: 'Antalgiques si besoin',
    certificat: false
  }
];

export const DEMO_UTILISATEURS: Utilisateur[] = [
  {
    id: 1,
    nom: 'Admin',
    prenom: 'SenClinic',
    email: 'admin@senclinic.sn',
    role: 'administrateur',
    telephone: '+221 77 000 00 01',
    statut: 'actif',
    mot_de_passe: 'admin123'
  },
  {
    id: 2,
    nom: 'Diop',
    prenom: 'Mamadou',
    email: 'medecin@senclinic.sn',
    role: 'medecin',
    telephone: '+221 77 000 00 02',
    statut: 'actif',
    mot_de_passe: 'medecin123'
  },
  {
    id: 3,
    nom: 'Ndiaye',
    prenom: 'Aissatou',
    email: 'secretaire@senclinic.sn',
    role: 'secretaire',
    telephone: '+221 77 000 00 03',
    statut: 'actif',
    mot_de_passe: 'secretaire123'
  },
  {
    id: 4,
    nom: 'Ba',
    prenom: 'Ibrahima',
    email: 'ibrahima.ba@senclinic.sn',
    role: 'medecin',
    telephone: '+221 77 000 00 04',
    statut: 'inactif',
    mot_de_passe: 'pass456'
  }
];


