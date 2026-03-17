import { APP_INITIALIZER, ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { apiBaseUrlInterceptor } from './Services/api-base-url.interceptor';
import { authInterceptor } from './Services/auth.interceptor';
import { ApiConfigService } from './Services/api-config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiBaseUrlInterceptor, authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: (): (() => Promise<void>) => {
        const apiConfig = inject(ApiConfigService);
        return () => apiConfig.load();
      },
      multi: true,
    },
  ],
};
