import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ItemsService } from '../../services/items.service';
import { OfflineQueueService } from '../../services/offline-queue.service';

@Component({
  selector: 'app-quick-action-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quick-action-bar.component.html',
  styleUrl: './quick-action-bar.component.scss'
})
export class QuickActionBarComponent {
  value = '';
  tags = '';
  uploading = signal(false);

  isSent = signal(false);

  constructor(
    private itemsSvc: ItemsService,
    public offlineQueue: OfflineQueueService
  ) {}

  submit() {
    if (this.uploading()) return;
    const val = this.value.trim();
    if (!val) return;

    const parsedTags = this.tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(t => t.length > 0);
    const tagsArray = parsedTags.length > 0 ? parsedTags : undefined;

    // Instant UI feedback
    this.value = '';
    this.tags = '';
    this.isSent.set(true);
    setTimeout(() => this.isSent.set(false), 1500);

    // Fire and forget network request
    if (/^https?:\/\//i.test(val)) {
      this.itemsSvc.addLink(val, tagsArray);
    } else {
      this.itemsSvc.addText(val, tagsArray);
    }
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset so picking the same file again still fires 'change'.
    input.value = '';
    if (!file) return;

    this.uploading.set(true);
    try {
      const parsedTags = this.tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(t => t.length > 0);
      const tagsArray = parsedTags.length > 0 ? parsedTags : undefined;
      await this.itemsSvc.addMedia(file, tagsArray);
      this.tags = '';
    } finally {
      this.uploading.set(false);
    }
  }

  async onPaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          event.preventDefault(); // Stop text paste
          this.uploading.set(true);
          try {
            const parsedTags = this.tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(t => t.length > 0);
            const tagsArray = parsedTags.length > 0 ? parsedTags : undefined;
            const ext = file.type.split('/')[1] || 'png';
            const filename = `Pasted_Image_${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
            const namedFile = new File([file], filename, { type: file.type });
            await this.itemsSvc.addMedia(namedFile, tagsArray);
            this.tags = '';
          } finally {
            this.uploading.set(false);
          }
          break;
        }
      }
    }
  }
}
