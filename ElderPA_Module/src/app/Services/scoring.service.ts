import { Injectable } from '@angular/core';
import {AuditInstance, AuditQuestionInstance} from '../components/Types';


@Injectable({ providedIn: 'root' })
export class ScoringService {


  computeOverallScore(audit: AuditInstance): number {
    return audit.overallScore || 0;

  }


  computeDomainScores(audit: AuditInstance): Record<string, number> {
    const domainMap: Record<string, number[]> = {};

    audit.questions.forEach((q: AuditQuestionInstance) => {
      if (typeof q.score === 'number' && (q.customFields as any)?.fieldType === 'question')  {
        if (!domainMap[q.domain]) domainMap[q.domain] = [];
        domainMap[q.domain].push(q.score);
      }
    });
console.log(domainMap);
    const domainScores: Record<string, number> = {};
    for (const domain in domainMap) {
      const scores = domainMap[domain];
      console.log(scores);
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      console.log(avg);
      domainScores[domain] = Math.round(avg);
    }
    console.log(domainScores);
    return domainScores;
  }
}
