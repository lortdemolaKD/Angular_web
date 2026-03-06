import { Injectable } from '@angular/core';

/**
 * Holds the API base URL for the separate API service.
 * Loaded at app init from GET /api-config (served by the Angular server from API_URL env).
 * When empty, the app uses same-origin relative URLs (/api/...); when set, all /api and /uploads requests go to that origin.
 */
@Injectable({ providedIn: 'root' })
export class ApiConfigService {
  private apiBaseUrl = '';

  /** Called by APP_INITIALIZER. Fetches /api-config and sets the base URL. */
  load(): Promise<void> {
    return fetch('/api-config', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : {}))
      .then((data: { apiUrl?: string }) => {
        const url = data?.apiUrl ?? '';
        this.apiBaseUrl = typeof url === 'string' ? url.replace(/\/+$/, '') : '';
      })
      .catch(() => {
        this.apiBaseUrl = '';
      });
  }

  getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }
}
