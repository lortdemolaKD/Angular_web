import {Component, EventEmitter, Input, Output, signal, Signal} from '@angular/core';
import {AuditQuestionInstance} from '../../Types';
import {NgFor} from '@angular/common';

@Component({
  selector: 'app-question-list',
  imports: [NgFor],
  templateUrl: './question-list.html',
  styleUrl: './question-list.css',
})
export class QuestionList {
  @Input() questions: Signal<AuditQuestionInstance[]> = signal([]);
  @Output() questionSelected = new EventEmitter<AuditQuestionInstance>();

  selectQuestion(q: AuditQuestionInstance) {
    this.questionSelected.emit(q);
  }
}
