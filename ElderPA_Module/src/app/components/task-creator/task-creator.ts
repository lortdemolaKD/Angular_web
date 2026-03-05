import { Component, EventEmitter, Output, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ActionTask } from '../Types';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-task-creator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-creator.html',
  styleUrl: './task-creator.css',
})
export class TaskCreator implements OnChanges {
  @Input() alertIndicatorOptions: { alertId: string; indicatorId: string; message: string }[] = [];
  @Input() preselectedAlertId = '';
  @Input() preselectedMessage = '';

  task: Partial<ActionTask> = {
    category: '',
    description: '',
    alertId: '',
    assignedTo: '',
    dueDate: '',
  };

  @Output() taskCreated = new EventEmitter<Partial<ActionTask>>();
  @Output() cancelled = new EventEmitter<void>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['preselectedAlertId'] || changes['preselectedMessage']) {
      if (this.preselectedAlertId) this.task.alertId = this.preselectedAlertId;
      if (this.preselectedMessage) this.task.description = this.preselectedMessage;
    }
  }

  createTask() { this.taskCreated.emit(this.task); }
  cancel() { this.cancelled.emit(); }
}
