import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { canAccessRoute, getDefaultRouteForRole } from '../config/role-access';
import type { UserRole } from '../models/auth.model';
import { AuthService } from '../services/auth.service';

interface MenuItem {
  label: string;
  path: string;
  roles?: UserRole[];
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly sidebarOpen = signal(false);
  readonly currentUser = this.authService.currentUser;
  readonly now = signal(new Date());
  readonly globalSearch = signal('');
  readonly currentPath = signal(this.router.url);
  readonly profileMenuOpen = signal(false);
  @ViewChild('profileMenuHost') profileMenuHost?: ElementRef<HTMLElement>;

  readonly displayDate = computed(() =>
    new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    }).format(this.now())
  );

  readonly displayTime = computed(() =>
    new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(this.now())
  );

  readonly userInitials = computed(() => {
    const user = this.currentUser();
    if (!user) {
      return 'SC';
    }

    return `${user.prenom.charAt(0)}${user.nom.charAt(0)}`.toUpperCase();
  });

  readonly roleLabel = computed(() => {
    const role = this.currentUser()?.role;

    if (role === 'administrateur') {
      return 'Administrateur';
    }

    if (role === 'medecin') {
      return 'Medecin';
    }

    if (role === 'secretaire') {
      return 'Secretaire';
    }

    return 'Utilisateur';
  });

  readonly topbarTitle = computed(() => {
    const path = this.currentPath();

    if (path.includes('/patients')) {
      return 'Patients';
    }
    if (path.includes('/rendez-vous')) {
      return 'Rendez-vous';
    }
    if (path.includes('/consultations')) {
      return 'Consultations';
    }
    if (path.includes('/medecins')) {
      return 'Medecins';
    }
    if (path.includes('/utilisateurs')) {
      return 'Utilisateurs';
    }
    if (path.includes('/profil')) {
      return 'Profil';
    }

    return 'Tableau de bord';
  });

  readonly topbarEyebrow = computed(() => {
    const path = this.currentPath();

    if (path.includes('/patients')) {
      return 'SenClinic - Patients';
    }
    if (path.includes('/rendez-vous')) {
      return 'SenClinic - Rendez-vous';
    }
    if (path.includes('/consultations')) {
      return 'SenClinic - Consultations';
    }
    if (path.includes('/medecins')) {
      return 'SenClinic - Medecins';
    }
    if (path.includes('/utilisateurs')) {
      return 'SenClinic - Utilisateurs';
    }
    if (path.includes('/profil')) {
      return 'SenClinic - Profil';
    }

    return 'SenClinic - Tableau de bord';
  });

  readonly topbarSubtitle = computed(() => {
    const path = this.currentPath();

    if (path.includes('/patients')) {
      return 'Gestion et suivi des dossiers patients.';
    }
    if (path.includes('/rendez-vous')) {
      return 'Planification et gestion des rendez-vous.';
    }
    if (path.includes('/consultations')) {
      return 'Historique clinique, ordonnances et suivi patient.';
    }
    if (path.includes('/medecins')) {
      return 'Suivi du corps medical et des disponibilites.';
    }
    if (path.includes('/utilisateurs')) {
      return 'Gestion des comptes et des roles.';
    }
    if (path.includes('/profil')) {
      return 'Informations de compte et securite.';
    }

    return `Vue d'ensemble de la clinique - ${this.displayDate()} ${this.displayTime()}`;
  });

  private readonly menuItems: MenuItem[] = [
    { label: 'Tableau de bord', path: '/tableau-de-bord', roles: ['administrateur', 'medecin', 'secretaire'] },
    { label: 'Patients', path: '/patients', roles: ['administrateur', 'medecin', 'secretaire'] },
    { label: 'Rendez-vous', path: '/rendez-vous', roles: ['administrateur', 'medecin', 'secretaire'] },
    { label: 'Consultations', path: '/consultations', roles: ['administrateur', 'medecin'] },
    { label: 'Medecins', path: '/medecins', roles: ['administrateur', 'medecin', 'secretaire'] },
    { label: 'Utilisateurs', path: '/utilisateurs', roles: ['administrateur'] }
  ];

  readonly visibleMenuItems = computed(() => {
    const role = this.currentUser()?.role;

    return this.menuItems.filter((item) => {
      if (!item.roles) {
        return true;
      }

      return !!role && item.roles.includes(role);
    });
  });

  readonly primaryMenuItems = computed(() =>
    this.visibleMenuItems().filter((item) => item.path === '/tableau-de-bord')
  );

  readonly clinicMenuItems = computed(() =>
    this.visibleMenuItems().filter((item) =>
      ['/patients', '/rendez-vous', '/consultations'].includes(item.path)
    )
  );

  readonly adminMenuItems = computed(() =>
    this.visibleMenuItems().filter((item) => ['/medecins', '/utilisateurs'].includes(item.path))
  );

  constructor() {
    const timerId = window.setInterval(() => {
      this.now.set(new Date());
    }, 60000);

    const routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentPath.set(event.urlAfterRedirects);
        this.profileMenuOpen.set(false);
      });

    this.destroyRef.onDestroy(() => window.clearInterval(timerId));
    this.destroyRef.onDestroy(() => routerSub.unsubscribe());
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((value) => !value);
  }

  toggleProfileMenu(): void {
    this.profileMenuOpen.update((value) => !value);
  }

  closeProfileMenu(): void {
    this.profileMenuOpen.set(false);
  }

  closeSidebar(): void {
    if (window.innerWidth <= 860) {
      this.sidebarOpen.set(false);
    }
  }

  updateGlobalSearch(value: string): void {
    this.globalSearch.set(value);
  }

  goToSearchTarget(event: Event): void {
    event.preventDefault();

    const search = this.globalSearch().trim().toLowerCase();

    if (search.includes('rdv') || search.includes('rendez')) {
      this.navigateToAuthorizedPath('/rendez-vous');
      return;
    }

    if (search.includes('consult')) {
      this.navigateToAuthorizedPath('/consultations');
      return;
    }

    if (search.includes('medec')) {
      this.navigateToAuthorizedPath('/medecins');
      return;
    }

    if (search.includes('utilisateur') || search.includes('user')) {
      this.navigateToAuthorizedPath('/utilisateurs');
      return;
    }

    if (search.includes('tableau') || search.includes('dashboard')) {
      this.navigateToAuthorizedPath('/tableau-de-bord');
      return;
    }

    this.navigateToAuthorizedPath('/patients');
  }

  goToProfile(): void {
    this.profileMenuOpen.set(false);
    this.router.navigate(['/profil']);
  }

  goToSettings(): void {
    this.profileMenuOpen.set(false);
    this.router.navigate(['/profil'], { queryParams: { tab: 'parametres' } });
  }

  logout(): void {
    this.profileMenuOpen.set(false);
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private navigateToAuthorizedPath(targetPath: string): void {
    const role = this.currentUser()?.role;

    if (canAccessRoute(role, targetPath)) {
      this.router.navigate([targetPath]);
      return;
    }

    this.router.navigate([getDefaultRouteForRole(role)]);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.profileMenuOpen()) {
      return;
    }

    const target = event.target as Node | null;
    const host = this.profileMenuHost?.nativeElement;
    if (target && host && !host.contains(target)) {
      this.profileMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.profileMenuOpen.set(false);
  }
}
