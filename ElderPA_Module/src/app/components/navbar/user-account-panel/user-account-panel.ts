import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { UserType } from '../../Types';
import { AuthService } from '../../../Services/Auth.service';

@Component({
  selector: 'app-user-account-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  templateUrl: './user-account-panel.html',
  styleUrls: ['./user-account-panel.css'],
})
export class UserAccountPanelComponent {
  @Input() user: UserType | null = null;
  @Input() companyName: string | null = null;
  @Input() locationName: string | null = null;
  /** Show link to edit organisation (same wizard as create company) */
  @Input() canEditCompany = false;
  @Output() close = new EventEmitter<void>();

  /** Pending avatar URL after upload (before next /me refresh); null when using server avatar or none */
  localAvatarUrl: string | null = null;
  uploadInProgress = false;
  uploadError = '';

  constructor(private authService: AuthService) {}

  /** First two letters of user name (or login), uppercase. */
  getInitials(): string {
    if (!this.user?.name?.trim()) return '?';
    const name = this.user.name.trim();
    if (name.length >= 2) return name.slice(0, 2).toUpperCase();
    return name.slice(0, 1).toUpperCase();
  }

  /** Avatar to display: server avatar or local override after upload. */
  get displayAvatar(): string | null {
    return this.localAvatarUrl ?? this.user?.avatarUrl ?? null;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    input.value = '';
    this.uploadError = '';
    this.uploadInProgress = true;
    this.authService.uploadAvatar(file).subscribe({
      next: (res) => {
        this.localAvatarUrl = res.avatarUrl;
        this.uploadInProgress = false;
      },
      error: (err) => {
        this.uploadError = err?.error?.message ?? 'Upload failed';
        this.uploadInProgress = false;
      },
    });
  }

  removePhoto(): void {
    this.uploadError = '';
    this.uploadInProgress = true;
    this.authService.removeAvatar().subscribe({
      next: () => {
        this.localAvatarUrl = null;
        this.uploadInProgress = false;
      },
      error: (err) => {
        this.uploadError = err?.error?.message ?? 'Remove failed';
        this.uploadInProgress = false;
      },
    });
  }

  onClose(): void {
    this.close.emit();
  }
}
