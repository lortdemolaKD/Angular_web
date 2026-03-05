import {Component, computed, signal} from '@angular/core';
import {AuditInstance} from '../../Types';
import {Panel} from '../../panel/panel';
import {CSTButton} from '../../cst-button/cst-button';
import {AuditList} from '../audit-list/audit-list';
import {QuestionList} from '../question-list/question-list';
import {EvidenceList} from '../evidence-list/evidence-list';
import {RouterModule,Router} from '@angular/router';
import {AuditDataService} from '../../../Services/audit-data.service';
@Component({
  selector: 'app-evidence-library',
  imports: [

    CSTButton,
    RouterModule,

    EvidenceList
  ],
  templateUrl: './evidence-library.html',
  styleUrl: './evidence-library.css',
})
export class EvidenceLibrary {

  audits = signal<AuditInstance[]>([]);

  readonly allEvidence = computed(() => {
    return this.audits().flatMap(audit =>
      (audit.questions ?? []).flatMap(q =>
        (q.evidence ?? []).map(ev => ({
          ...ev,
          auditId: audit.id,
          auditType: audit.auditType,
          questionId: q.templateQuestionId,
          questionText: q.text
        }))
      )
    );
  });

  constructor(
    private auditService: AuditDataService,
    private router: Router,

  ) {
    this.loadAudits();
  }
  async loadAudits() {
    const audits = await this.auditService.getAllAudits();
    this.audits.set(audits);
  }

  protected moveTo(route: string) {
    this.router.navigate([route]);
  }
}
