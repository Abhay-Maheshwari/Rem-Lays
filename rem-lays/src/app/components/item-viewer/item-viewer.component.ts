import { Component, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ItemViewerService } from '../../services/item-viewer.service';
import { ItemsService } from '../../services/items.service';
import { DevicesService } from '../../services/devices.service';

@Component({
  selector: 'app-item-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './item-viewer.component.html',
  styleUrl: './item-viewer.component.scss'
})
export class ItemViewerComponent {
  mediaUrl = signal<string | null>(null);

  isEditing = signal<boolean>(false);
  editNoteText = signal<string>('');
  editLinkTitle = signal<string>('');

  constructor(
    public viewerSvc: ItemViewerService,
    private itemsSvc: ItemsService,
    private devicesSvc: DevicesService
  ) {
    effect(async () => {
      const item = this.viewerSvc.currentItem();
      if (item && (item.type === 'image' || item.type === 'video') && item.storage_key) {
        this.mediaUrl.set(await this.itemsSvc.getSignedDownloadUrl(item.storage_key));
      } else {
        this.mediaUrl.set(null);
      }
    }, { allowSignalWrites: true });
  }

  get sourceDeviceName(): string {
    const item = this.viewerSvc.currentItem();
    if (!item || !item.source_device_id) return 'Unknown device';
    const device = this.devicesSvc.devices().find(d => d.id === item.source_device_id);
    return device ? device.device_name : 'Unknown device';
  }

  get noteText(): string {
    const item = this.viewerSvc.currentItem();
    const v = item?.payload?.['note'];
    return typeof v === 'string' ? v : '';
  }

  get linkUrl(): string {
    const item = this.viewerSvc.currentItem();
    const v = item?.payload?.['url'];
    return typeof v === 'string' ? v : '';
  }

  get linkDomain(): string {
    const item = this.viewerSvc.currentItem();
    const v = item?.payload?.['domain'];
    return typeof v === 'string' ? v : '';
  }

  get linkTitle(): string {
    const item = this.viewerSvc.currentItem();
    const v = item?.payload?.['title'];
    return typeof v === 'string' && v ? v : this.linkDomain || this.linkUrl;
  }

  get itemTags(): string[] {
    const item = this.viewerSvc.currentItem();
    if (!item || !item.payload || !item.payload['tags']) return [];
    return Array.isArray(item.payload['tags']) ? item.payload['tags'] : [];
  }

  get expireText(): string {
    const item = this.viewerSvc.currentItem();
    if (!item || !item.expires_at) return '';
    const expiresAt = new Date(item.expires_at).getTime();
    const now = new Date().getTime();
    const diffMs = expiresAt - now;
    if (diffMs <= 0) return 'Expired';
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    if (hours >= 24) return `Expires in ${Math.floor(hours / 24)}d`;
    if (hours > 0) return `Expires in ${hours}h ${mins}m`;
    return `Expires in ${mins}m`;
  }

  startEdit() {
    this.isEditing.set(true);
    this.editNoteText.set(this.noteText);
    this.editLinkTitle.set(this.linkTitle);
  }

  cancelEdit() {
    this.isEditing.set(false);
  }

  async saveEdit() {
    const item = this.viewerSvc.currentItem();
    if (!item) return;

    const newPayload = { ...item.payload };
    
    if (item.type === 'text') {
      newPayload['note'] = this.editNoteText();
    } else if (item.type === 'link') {
      newPayload['title'] = this.editLinkTitle();
    }

    // Optimistically update the current item so UI updates immediately
    item.payload = newPayload;
    
    await this.itemsSvc.updateItemPayload(item.id, newPayload);
    this.isEditing.set(false);
  }

  close() {
    this.isEditing.set(false);
    this.viewerSvc.close();
  }
}
