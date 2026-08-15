import { Component, effect, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ItemViewerService } from '../../services/item-viewer.service';
import { ItemsService } from '../../services/items.service';
import { DevicesService } from '../../services/devices.service';
import { ContextMenuService, MenuItem } from '../../services/context-menu.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { InstagramEmbedService } from '../../services/instagram-embed.service';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Clipboard } from '@angular/cdk/clipboard';
import { ToastService } from '../../services/toast.service';

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
  editLinkUrl = signal<string>('');

  reelEmbedHtml = signal<SafeHtml | null>(null);

  @HostListener('document:keydown.escape', ['$event'])
  handleEscape(event: KeyboardEvent) {
    if (!this.viewerSvc.currentItem()) return;
    
    if (this.isEditing()) {
      this.cancelEdit();
    } else {
      this.close();
    }
  }

  constructor(
    public viewerSvc: ItemViewerService,
    private itemsSvc: ItemsService,
    private devicesSvc: DevicesService,
    private contextMenuSvc: ContextMenuService,
    private sanitizer: DomSanitizer,
    private igEmbedSvc: InstagramEmbedService,
    private clipboard: Clipboard,
    private toastSvc: ToastService
  ) {
    effect(async () => {
      const item = this.viewerSvc.currentItem();
      if (item && (item.type === 'image' || item.type === 'video') && item.storage_key) {
        this.mediaUrl.set(await this.itemsSvc.getSignedDownloadUrl(item.storage_key));
      } else {
        this.mediaUrl.set(null);
      }

      if (item && item.type === 'reel') {
        const html = item.payload?.['embedHtml'];
        if (typeof html === 'string' && html) {
          this.reelEmbedHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
          this.igEmbedSvc.ensureScriptLoaded();
          setTimeout(() => this.igEmbedSvc.reprocessEmbeds(), 50);
        } else {
          this.reelEmbedHtml.set(null);
        }
      } else {
        this.reelEmbedHtml.set(null);
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
    const title = typeof v === 'string' && v ? v : this.linkDomain || this.linkUrl;
    return this.decodeHtmlEntities(title);
  }

  private decodeHtmlEntities(text: string): string {
    if (!text) return text;
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return doc.documentElement.textContent || text;
  }

  get itemTags(): string[] {
    const item = this.viewerSvc.currentItem();
    if (!item || !item.payload || !item.payload['tags']) return [];
    return Array.isArray(item.payload['tags']) ? item.payload['tags'] : [];
  }

  get reelAuthorName(): string {
    const item = this.viewerSvc.currentItem();
    const v = item?.payload?.['authorName'];
    return typeof v === 'string' && v ? v : 'Instagram';
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
    
    const item = this.viewerSvc.currentItem();
    // Use the actual stored title, not the fallback, so they don't accidentally save 'instagram.com' as a title
    const actualTitle = item?.payload?.['title'] || '';
    this.editLinkTitle.set(actualTitle as string);
    this.editLinkUrl.set(this.linkUrl);
  }

  cancelEdit() {
    this.isEditing.set(false);
  }

  async saveEdit() {
    const item = this.viewerSvc.currentItem();
    if (!item) return;

    const newPayload = { ...item.payload };
    let urlChanged = false;
    let newUrl = '';
    
    if (item.type === 'text') {
      newPayload['note'] = this.editNoteText();
    } else if (item.type === 'link' || item.type === 'reel') {
      newPayload['title'] = this.editLinkTitle();
      if (this.editLinkUrl() && this.editLinkUrl() !== this.linkUrl) {
        urlChanged = true;
        newUrl = this.editLinkUrl();
        newPayload['url'] = newUrl;
        try {
          newPayload['domain'] = new URL(newUrl).hostname.replace(/^www\./, '');
        } catch {}
      }
    }

    // Optimistically update the current item so UI updates immediately
    item.payload = newPayload;
    
    await this.itemsSvc.updateItemPayload(item.id, newPayload);
    this.isEditing.set(false);

    if (urlChanged) {
      if (item.type === 'reel') {
        this.itemsSvc.enrichReel(item.id, newUrl);
      } else if (item.type === 'link') {
        this.itemsSvc.enrichLink(item.id, newUrl, (newPayload['domain'] as string) || newUrl);
      }
    }
  }

  async openLink(ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    if (this.linkUrl) {
      try {
        await openUrl(this.linkUrl);
      } catch (err) {
        console.error('Failed to open link via Tauri:', err);
        window.open(this.linkUrl, '_blank');
      }
    }
    this.close();
  }

  close() {
    this.isEditing.set(false);
    this.viewerSvc.close();
  }

  onContextMenu(event: MouseEvent) {
    const item = this.viewerSvc.currentItem();
    if (!item) return;

    event.preventDefault();
    event.stopPropagation();
    const items: MenuItem[] = [
      {
        label: item.is_pinned ? 'Unpin' : 'Pin to top',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5" /><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" /></svg>',
        action: (e) => {
          e?.stopPropagation();
          item.is_pinned = !item.is_pinned;
          this.itemsSvc.togglePin(item.id, item.is_pinned);
        }
      }
    ];

    if (item.status === 'seen') {
      items.push({
        label: 'Mark as unread',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 9l-5-5-5 5M12 12.8V2.5" /></svg>',
        action: (e) => {
          e?.stopPropagation();
          item.status = 'unseen';
          this.itemsSvc.markUnread(item.id);
        }
      });
    } else {
      items.push({
        label: 'Mark as read',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        action: (e) => {
          e?.stopPropagation();
          item.status = 'seen';
          this.itemsSvc.markSeen(item.id);
        }
      });
    }

    if (item.type === 'link') {
      items.push({
        label: 'Copy link',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
        action: () => { 
          this.clipboard.copy(this.linkUrl || this.linkTitle); 
          this.toastSvc.show('Link copied!');
        }
      });
    } else if (item.type === 'text') {
      items.push({
        label: 'Copy text',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
        action: () => { 
          this.clipboard.copy(this.noteText); 
          this.toastSvc.show('Text copied!');
        }
      });
    } else if (item.type === 'image' && this.mediaUrl()) {
      items.push({
        label: 'Copy image',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
        action: () => { this.copyImageToClipboard(this.mediaUrl()!); }
      });
    }

    items.push({
      label: 'Edit Expiration',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      keepOpen: true,
      action: (e) => {
        const expireItems: MenuItem[] = [
          { label: '1 Hour', action: () => this.setExpireFromMenu(e!, item, 1) },
          { label: '6 Hours', action: () => this.setExpireFromMenu(e!, item, 6) },
          { label: '24 Hours', action: () => this.setExpireFromMenu(e!, item, 24) },
          { label: '7 Days', action: () => this.setExpireFromMenu(e!, item, 168) },
          { label: '1 Month', action: () => this.setExpireFromMenu(e!, item, 720) }
        ];
        if (item.expires_at) {
          expireItems.push({ label: 'Remove Expiration', danger: true, action: () => this.setExpireFromMenu(e!, item, 0) });
        }
        this.contextMenuSvc.items.set(expireItems);
      }
    });

    items.push({
      label: 'Delete',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
      action: (e) => {
        e?.stopPropagation();
        this.itemsSvc.remove(item.id);
        this.close();
      },
      danger: true
    });

    this.contextMenuSvc.open(event, items);
  }

  async copyImageToClipboard(url: string) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Failed to get canvas context'));
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to convert to png'));
          }, 'image/png');
        };
        img.onerror = () => reject(new Error('Failed to load image for copying'));
        img.src = URL.createObjectURL(blob);
      });

      await navigator.clipboard.write([
        new (window as any).ClipboardItem({
          'image/png': pngBlob
        })
      ]);
      this.toastSvc.show('Image copied!');
    } catch (err) {
      console.error('Failed to copy image', err);
      this.toastSvc.show('Failed to copy image', 'error');
    }
  }

  setExpireFromMenu(ev: Event, item: any, hours: number) {
    this.contextMenuSvc.close();
    ev.stopPropagation();
    if (hours === 0) {
      item.expires_at = null;
      this.itemsSvc.updateExpire(item.id, null);
    } else {
      const targetDate = new Date();
      targetDate.setHours(targetDate.getHours() + hours);
      const expiresAt = targetDate.toISOString();
      item.expires_at = expiresAt;
      this.itemsSvc.updateExpire(item.id, expiresAt);
    }
  }
}
