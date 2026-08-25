import { Component, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ItemsService } from '../../services/items.service';
import { OfflineQueueService } from '../../services/offline-queue.service';
import { TagInputComponent } from '../tag-input/tag-input.component';
import { WebcamCaptureModalComponent } from '../webcam-capture-modal/webcam-capture-modal.component';

@Component({
  selector: 'app-quick-action-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, TagInputComponent, WebcamCaptureModalComponent],
  templateUrl: './quick-action-bar.component.html',
  styleUrl: './quick-action-bar.component.scss'
})
export class QuickActionBarComponent {
  @ViewChild('noteInput') noteInput!: ElementRef<HTMLTextAreaElement>;

  value = '';
  tags: string[] = [];
  uploading = signal(false);

  isSent = signal(false);

  isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  showWebcamModal = false;
  groupStaged = false;
  groupName = '';

  constructor(
    public itemsSvc: ItemsService,
    public offlineQueue: OfflineQueueService
  ) {}

  async submit() {
    if (this.uploading()) return;
    const val = this.value.trim();
    const currentStagedFiles = this.itemsSvc.stagedFiles();
    
    if (!val && currentStagedFiles.length === 0) return;

    const tagsArray = this.tags.length > 0 ? this.tags : undefined;

    // Instant UI feedback
    this.value = '';
    this.tags = [];
    this.itemsSvc.stagedFiles.set([]);
    const groupRequested = this.groupStaged;
    const requestedGroupName = this.groupName.trim() || 'Staged Group';
    this.groupStaged = false;
    this.groupName = '';
    this.isSent.set(true);
    setTimeout(() => this.isSent.set(false), 1500);

    if (this.noteInput) {
      this.noteInput.nativeElement.style.height = 'auto';
    }

    // Process text/link if present
    if (val) {
      if (/^https?:\/\//i.test(val)) {
        this.itemsSvc.addLink(val, tagsArray);
      } else {
        this.itemsSvc.addText(val, tagsArray);
      }
    }

    // Process staged media files if present
    if (currentStagedFiles.length > 0) {
      if (currentStagedFiles.length === 1) {
        // Fire and forget, UI state is handled by bulkUploadState for bulk, but for single
        // we might want to just let it run (addMedia handles its own errors)
        this.itemsSvc.addMedia(currentStagedFiles[0], tagsArray).catch(err => {
           console.error('Failed to upload single file', err);
        });
      } else {
        this.itemsSvc.addMediaBulk(currentStagedFiles, tagsArray).then(ids => {
          if (groupRequested && ids.length > 1) {
            this.itemsSvc.groupItems(requestedGroupName, ids).catch(err => {
              console.error('Failed to group items', err);
            });
          }
        }).catch(err => {
           console.error('Failed to upload bulk files', err);
        });
      }
    }
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      if (!this.isMobile) {
        event.preventDefault();
        this.submit();
      }
    }
  }

  autoGrow(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 150) + 'px';
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (files.length === 0) return;

    this.itemsSvc.stagedFiles.update(current => [...current, ...files]);
  }

  openCamera(cameraInput: HTMLInputElement) {
    if (this.isMobile) {
      // On mobile, rely on native OS camera intent via HTML input
      cameraInput.click();
    } else {
      // On desktop, open custom webcam modal
      this.showWebcamModal = true;
    }
  }

  async onWebcamCapture(file: File) {
    this.showWebcamModal = false;
    this.itemsSvc.stagedFiles.update(current => [...current, file]);
  }

  async onPaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const ext = file.type.split('/')[1] || 'png';
          const filename = `Pasted_Image_${new Date().toISOString().replace(/[:.]/g, '-')}_${i}.${ext}`;
          imageFiles.push(new File([file], filename, { type: file.type }));
        }
      }
    }

    if (imageFiles.length === 0) return;
    event.preventDefault();

    this.itemsSvc.stagedFiles.update(current => [...current, ...imageFiles]);
  }

  removeStagedFile(index: number) {
    this.itemsSvc.stagedFiles.update(files => files.filter((_, i) => i !== index));
  }

  cancelBulkUpload() {
    this.itemsSvc.cancelBulkUpload();
  }
}
