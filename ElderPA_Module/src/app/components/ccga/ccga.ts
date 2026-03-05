import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import {Component, Input, computed, effect, signal, OnInit} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { catchError, of } from 'rxjs';

import { YearlyGovernancePlanner } from '../yearly-governance-planner/yearly-governance-planner';
import { SmartChartComponent, type ChartDatum, type ChartOptions } from '../../NEW for implemnet/smart-chart/smart-chart';
import { CSTButton } from '../cst-button/cst-button';
import { AuditInstance, AuditSummary } from '../Types';

import { CompanyService } from '../../Services/Company.service';
import {AuditService} from '../../Services/audit.service';

export const CLOEDomains = ['Safe', 'Effective', 'Caring', 'Responsive', 'WellLed'] as const;
export type CLOEDomain = typeof CLOEDomains[number];
type DomainRecord = Record<CLOEDomain, number>;

@Component({
  selector: 'app-ccga',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    YearlyGovernancePlanner,
    SmartChartComponent,
    CSTButton,
    DecimalPipe,
  ],
  templateUrl: './ccga.html',
  styleUrl: './ccga.css',
})
export class Ccga implements OnInit {
  protected readonly locationIdSig = signal<string | null>(null);

  @Input()
  set locationId(value: string | null | undefined) {
    this.locationIdSig.set(value ?? null);
  }

  private readonly auditsSig = signal<AuditInstance[]>([]);
  readonly audits = computed(() => this.auditsSig());

  readonly cloeDomains = CLOEDomains;

  // Keep companyId in sync (needed for /api/audits filtering)
  private readonly companyIdSig = signal<string | null>(null);

  constructor(
    private router: Router,
    private http: HttpClient,
    private companyService: CompanyService,
    private auditService: AuditService
  ) {
    this.companyService.currentCompany$.subscribe((c: any) => {
      this.companyIdSig.set(c?.id ?? c?.companyID ?? null);
    });

    effect(() => {
      const companyId = this.companyIdSig();
      const locationId = this.locationIdSig();

      if (!companyId || !locationId) {
        this.auditsSig.set([]);
        return;
      }

      this.auditService
        .list({ companyId, locationId })
        .pipe(
          catchError(err => {
            console.error('Audit loading failed:', err);
            return of([]);
          })
        )
        .subscribe(items => {
          this.auditsSig.set(items ?? []);
        });
    });
  }

  ngOnInit(): void {
    this.companyService.currentCompany$.subscribe((c: any) => {
      const companyId = this.companyIdSig();
      const locationId = this.locationIdSig();

      if (!companyId || !locationId) {
        this.auditsSig.set([]);
        return;
      }

      this.auditService
        .list({ companyId, locationId })
        .pipe(
          catchError(err => {
            console.error('Audit loading failed:', err);
            return of([]);
          })
        )
        .subscribe(items => {
          this.auditsSig.set(items ?? []);
        });
    });
  }

  protected moveTo(t1: string) {
    this.router.navigate([t1]);
  }

  protected openMoreInfo() {
    console.log('More info clicked');
  }
  protected moveToAuditCreator() {
    console.log('Audit creator clicked');
    this.router.navigate(['CCGA/AuditCreator'], {
      queryParams: { locationId: this.locationId }
    });
  }
  // NOTE: your auditType strings must match what DB stores.
  // In audits.routes.js your audit creator sends auditType like 'baseline' etc. [file:1][file:43]
  readonly baselineAudits = computed(() => this.audits().filter((a) => a.auditType === 'baseline'));
  readonly monthlyAudits = computed(() => this.audits().filter((a) => a.auditType === 'registered_manager'));
  readonly providerAudits = computed(() => this.audits().filter((a) => a.auditType === 'provider'));

  readonly baselineSummary = computed(() => this.computeSummary(this.baselineAudits()));
  readonly monthlySummary = computed(() => this.computeSummary(this.monthlyAudits()));
  readonly providerSummary = computed(() => this.computeSummary(this.providerAudits()));
  readonly allSummary = computed(() => this.computeSummary(this.audits()));

  readonly masterCLOE = computed(() => {
    const allQuestions = this.audits().flatMap((a) => a.questions ?? []);

    const domainStats: Record<CLOEDomain, { total: number, max: number, count: number }> = {
      Safe: { total: 0, max: 0, count: 0 },
      Effective: { total: 0, max: 0, count: 0 },
      Caring: { total: 0, max: 0, count: 0 },
      Responsive: { total: 0, max: 0, count: 0 },
      WellLed: { total: 0, max: 0, count: 0 }
    };

    allQuestions.forEach((q) => {
      const domain = q.domain as CLOEDomain;
      if (q.score != null && q.score > 0 && q.score <= 5) {
        const maxScore = (q.customFields as any)?.maxScore || 5;
        domainStats[domain].total += q.score;
        domainStats[domain].max += maxScore;
        domainStats[domain].count += 1;
      }
    });

    const scores: DomainRecord = {
      Safe: domainStats.Safe.max > 0 ? Math.round((domainStats.Safe.total / domainStats.Safe.max) * 100) : 0,
      Effective: domainStats.Effective.max > 0 ? Math.round((domainStats.Effective.total / domainStats.Effective.max) * 100) : 0,
      Caring: domainStats.Caring.max > 0 ? Math.round((domainStats.Caring.total / domainStats.Caring.max) * 100) : 0,
      Responsive: domainStats.Responsive.max > 0 ? Math.round((domainStats.Responsive.total / domainStats.Responsive.max) * 100) : 0,
      WellLed: domainStats.WellLed.max > 0 ? Math.round((domainStats.WellLed.total / domainStats.WellLed.max) * 100) : 0,
    };

    // ✅ FIXED: Type-safe filtering
    const validDomains = Object.entries(domainStats)
      .filter(([domain, stats]) => stats.count > 0)
      .map(([domain]) => domain as CLOEDomain);

    const averageScore = validDomains.length > 0
      ? validDomains.reduce((acc, d) => acc + scores[d], 0) / validDomains.length
      : 0;

    return { scores, averageScore };
  });



  getDomainScore(domain: CLOEDomain): number {
    return this.masterCLOE().scores[domain] ?? 0;
  }

  readonly cloeSeries = computed(() => this.cloeDomains.map((d) => this.getDomainScore(d)));

  /** CLOE radial bar data for SmartChart (radial-bar-custom-angle-270, legend bottom). */
  readonly cloeRadialData = computed((): ChartDatum[] =>
    this.cloeDomains.map((label, i) => ({ label, value: this.cloeSeries()[i] ?? 0 }))
  );
  readonly cloeRadialOptions: ChartOptions = {
    max: 100,
    showLegend: true,
    legendPosition: 'right',
    startAngle: 0,
    endAngle: 270,
  };

  /** Gauge data/options for baseline/monthly/provider completion. */
  baselineGaugeData = computed((): ChartDatum[] => [{ label: 'Completed', value: this.baselineSummary().completed }]);
  baselineGaugeOptions = computed((): ChartOptions => ({ max: this.baselineAudits().length || 100, showLegend: false }));
  monthlyGaugeData = computed((): ChartDatum[] => [{ label: 'Completed', value: this.monthlySummary().completed }]);
  monthlyGaugeOptions = computed((): ChartOptions => ({ max: this.monthlyAudits().length || 100, showLegend: false }));
  providerGaugeData = computed((): ChartDatum[] => [{ label: 'Completed', value: this.providerSummary().completed }]);
  providerGaugeOptions = computed((): ChartOptions => ({ max: this.providerAudits().length || 100, showLegend: false }));

  protected colors: string[] = ['#9a538e', '#00cec1', '#484748', '#939393', '#420a67'];

  computeSummary(audits: AuditInstance[]): AuditSummary {
    const completed = audits.filter((a) => a.status === "Complete").length;
    const outstanding = audits.length - completed;
    const percentComplete = audits.length ? (completed / audits.length) * 100 : 0;

    return {
      completed,
      outstanding,
      percentComplete,
      percentOutstanding: 100 - percentComplete,
    };
  }
}
