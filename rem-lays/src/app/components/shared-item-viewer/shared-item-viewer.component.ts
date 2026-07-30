import { Component, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Item } from '../../models/item.model';
import { ItemsService } from '../../services/items.service';

@Component({
  selector: 'app-shared-item-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shared-item-viewer.component.html',
  styleUrl: './shared-item-viewer.component.scss'
})
export class SharedItemViewerComponent implements OnInit {
  @Input({ required: true }) token!: string;

  item = signal<Item | null>(null);
  loading = signal(true);
  error = signal(false);
  mediaUrl = signal<string | null>(null);
  reelEmbedHtml: SafeHtml | null = null;

  constructor(private sanitizer: DomSanitizer) {}

  async ngOnInit() {
    try {
      const fetched = await ItemsService.fetchSharedItem(this.token);
      if (!fetched) {
        this.error.set(true);
        this.loading.set(false);
        return;
      }

      this.item.set(fetched);

      // Load media if it's an image or video
      if ((fetched.type === 'image' || fetched.type === 'video') && fetched.storage_key) {
        const url = await ItemsService.fetchSharedMediaUrl(this.token);
        this.mediaUrl.set(url);
      }

      // Prepare reel embed
      if (fetched.type === 'reel') {
        const html = fetched.payload?.['embedHtml'];
        if (typeof html === 'string' && html) {
          this.reelEmbedHtml = this.sanitizer.bypassSecurityTrustHtml(html);
        }
      }
    } catch (err) {
      console.error('Failed to load shared item', err);
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  get noteText(): string {
    const v = this.item()?.payload?.['note'];
    return typeof v === 'string' ? v : '';
  }

  get linkUrl(): string {
    const v = this.item()?.payload?.['url'];
    return typeof v === 'string' ? v : '';
  }

  get linkDomain(): string {
    const v = this.item()?.payload?.['domain'];
    return typeof v === 'string' ? v : '';
  }

  get linkTitle(): string {
    const v = this.item()?.payload?.['title'];
    return typeof v === 'string' && v ? v : this.linkDomain || this.linkUrl;
  }

  get linkImage(): string {
    const v = this.item()?.payload?.['image'];
    return typeof v === 'string' ? v : '';
  }

  get mediaFilename(): string {
    const v = this.item()?.payload?.['filename'];
    return typeof v === 'string' ? v : 'Shared media';
  }

  get reelAuthorName(): string {
    const v = this.item()?.payload?.['authorName'];
    return typeof v === 'string' && v ? v : 'Instagram';
  }

  get itemTags(): string[] {
    const v = this.item()?.payload?.['tags'];
    return Array.isArray(v) ? v : [];
  }

  get formattedDate(): string {
    const item = this.item();
    if (!item) return '';
    return new Date(item.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
