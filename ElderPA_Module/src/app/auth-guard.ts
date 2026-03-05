import { CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { inject } from '@angular/core';
import { LocalStorageService } from './Services/LocalStorage.service';

type Role =
  | 'SystemAdmin'
  | 'OrgAdmin'
  | 'RegisteredManager'
  | 'Supervisor'
  | 'CareWorker'
  | 'SeniorCareWorker'
  | 'Auditor';

function getUserRole(ls: LocalStorageService): Role | null {
  const role = ls.getID('userType');
  return (role as Role) ?? null;
}

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const router = inject(Router);
  const ls = inject(LocalStorageService);

  const token = ls.getID('token');
  const role = getUserRole(ls);

  if (!token || !role) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  const allowed: Role[] | undefined = route.data?.['roles'];
  if (allowed?.length && !allowed.includes(role)) {
    router.navigate(['/']);
    return false;
  }

  return true;
};
