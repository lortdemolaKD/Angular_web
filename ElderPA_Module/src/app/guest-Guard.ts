import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { inject } from '@angular/core';
import { LocalStorageService } from './Services/LocalStorage.service';

export const guestGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const ls = inject(LocalStorageService);

  const token = ls.getID('token');
  const userType = ls.getID('userType');

  if (token && userType) {
    const returnUrl = route.queryParams['returnUrl'];
    if (returnUrl && typeof returnUrl === 'string' && returnUrl.startsWith('/') && !returnUrl.startsWith('/login')) {
      router.navigateByUrl(returnUrl);
    } else {
      router.navigate(['/']);
    }
    return false;
  }

  return true;
};
