import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface CqcProviderVerification {
  valid: boolean;
  name?: string;
  message?: string;
}

export interface CqcLocationSuggestion {
  id: string;
  name: string;
  address?: string;
  postcode?: string;
}

@Injectable({ providedIn: 'root' })
export class CqcService {
  private readonly base = '/api/cqc';

  constructor(private http: HttpClient) {}

  /**
   * Verify that a CQC Provider ID exists in the CQC register.
   * Backend should call CQC API or check CQC data.
   */
  verifyProviderId(providerId: string): Observable<CqcProviderVerification> {
    if (!providerId?.trim()) {
      return of({ valid: false, message: 'Enter a Provider ID' });
    }
    const id = encodeURIComponent(providerId.trim());
    return this.http.get<CqcProviderVerification>(`${this.base}/verify-provider/${id}`).pipe(
      catchError((err) => {
        const message = err?.error?.message || err?.status === 404 ? 'Provider ID not found in CQC' : 'Verification failed';
        return of({ valid: false, message });
      })
    );
  }

  /**
   * Search CQC locations by prefix (e.g. partial ID or name).
   * Backend should query CQC database and return matches.
   */
  searchLocations(query: string): Observable<CqcLocationSuggestion[]> {
    if (!query || query.trim().length < 2) {
      return of([]);
    }
    const params = { q: query.trim() };
    return this.http.get<CqcLocationSuggestion[]>(`${this.base}/search-locations`, { params }).pipe(
      catchError(() => of([])),
      map((list) => list ?? [])
    );
  }
}
