import { Component, OnInit, signal, effect } from '@angular/core';
import { FormControl } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, switchMap, Subject, Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatOptionModule } from '@angular/material/core';

interface CqcProvider {
  providerId: string;
  providerName: string; // Matches API response [web:11]
}

@Component({
  selector: 'app-cqctest',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatOptionModule
  ],
  templateUrl: './cqctest.html',
  styleUrl: './cqctest.css',
})
export class CQCTest implements OnInit {
  providers = signal<CqcProvider[]>([]);
  cqcControl = new FormControl('');
  private searchSubject = new Subject<string>();
  private readonly apiUrl = '/api/cqc/public/v1'; // Proxied

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(query => this.searchProvidersPartial(query))
    ).subscribe({
      next: (results: any) => {
        console.log('Full API response:', results); // Paste here for exact shape
        this.providers.set(results.providers || []);
      },
      error: (err) => {
        console.error('CQC search error:', err);
        this.providers.set([]);
      }
    });
  }

  onSearch(value: string) {
    if (value.length > 0) {
      this.searchSubject.next(value);
    } else {
      this.providers.set([]);
    }
  }

  onSelection(event: any) {
    const providerId = event.option.value;
    console.log('Selected CQC Provider ID:', providerId);
    this.cqcControl.setValue(providerId); // Lock to ID
    // Integrate: e.g., this.companyService.update({ cqcProviderId: providerId }) [conversation_history:3]
  }

  private searchProvidersPartial(query: string): Observable<any> {
    const params = new HttpParams()
      .set('page', '1')
      .set('perPage', '10')
      .set('partnerCode', 'OpenAnswers') // Required [web:11]
      // Partial name via inspectionDirectorate or region filters; no direct ?name=, so test with known params or proxy [web:11]
      .set('region', 'All'); // Adjust for broader results

    return this.http.get(`${this.apiUrl}/providers`, { params });
  }
}
