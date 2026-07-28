import { AfterViewInit, Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Item } from '../../models/item.model';
import { ItemsService } from '../../services/items.service';
import { RealtimeService } from '../../services/realtime.service';
import { InstagramEmbedService } from '../../services/instagram-embed.service';
import { ItemViewerService } from '../../services/item-viewer.service';

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-item-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './item-card.component.html',
  styleUrl: './item-card.component.scss'
})
export class ItemCardComponent implements OnInit, AfterViewInit {
  @Input({ required: true }) item!: Item;
  mediaUrl: string | null = null;
  reelEmbedHtml: SafeHtml | null = null;
  editingTags = false;
  editTagsValue = '';

  constructor(
    public itemsSvc: ItemsService,
    private realtimeSvc: RealtimeService,
    private sanitizer: DomSanitizer,
    private igEmbedSvc: InstagramEmbedService,
    private viewerSvc: ItemViewerService
  ) {}

  async ngOnInit() {
    if ((this.item.type === 'image' || this.item.type === 'video') && this.item.storage_key) {
      this.mediaUrl = await this.itemsSvc.getSignedDownloadUrl(this.item.storage_key);
    }

    if (this.item.type === 'reel') {
      const html = this.item.payload?.['embedHtml'];
      // The oEmbed HTML comes from Instagram itself via our own
      // unfurl-reel Edge Function, not user-supplied input — trusting it
      // here is deliberate, not an oversight.
      if (typeof html === 'string' && html) {
        this.reelEmbedHtml = this.sanitizer.bypassSecurityTrustHtml(html);
      }
    }
  }

  ngAfterViewInit() {
    if (this.item.type === 'reel' && this.reelEmbedHtml) {
      this.igEmbedSvc.ensureScriptLoaded();
      // Give Angular a tick to actually insert the innerHTML before
      // asking Instagram's own script to look for it and process it.
      setTimeout(() => this.igEmbedSvc.reprocessEmbeds(), 50);
    }
  }

  get isNew(): boolean {
    return this.realtimeSvc.recentlyArrivedIds().has(this.item.id);
  }

  // payload is typed as Record<string, unknown> in the model (it's jsonb
  // in Postgres, could hold anything) — with strictTemplates on, binding
  // `unknown` straight into [href] or an interpolation fails to compile.
  // These getters narrow it to a safe string once, here, instead of in
  // the template.
  get noteText(): string {
    const v = this.item.payload?.['note'];
    return typeof v === 'string' ? v : '';
  }

  get linkUrl(): string {
    const v = this.item.payload?.['url'];
    return typeof v === 'string' ? v : '';
  }

  get linkDomain(): string {
    const v = this.item.payload?.['domain'];
    return typeof v === 'string' ? v : '';
  }

  get linkTitle(): string {
    const v = this.item.payload?.['title'];
    return typeof v === 'string' && v ? v : this.linkDomain || this.linkUrl;
  }

  get linkImage(): string {
    const v = this.item.payload?.['image'];
    return typeof v === 'string' ? v : '';
  }

  get mediaFilename(): string {
    const v = this.item.payload?.['filename'];
    return typeof v === 'string' ? v : 'Shared media';
  }

  get reelAuthorName(): string {
    const v = this.item.payload?.['authorName'];
    return typeof v === 'string' && v ? v : 'Instagram';
  }

  onOpen() {
    if (this.item.status === 'unseen') {
      this.itemsSvc.markSeen(this.item.id);
    }
    this.viewerSvc.open(this.item);
  }

  markAsRead(ev: Event) {
    ev.stopPropagation();
    // Optimistic UI update
    this.item = { ...this.item, status: 'seen' };
    
    // Fire and forget network call
    this.itemsSvc.markSeen(this.item.id);
  }

  get itemTags(): string[] {
    const v = this.item.payload?.['tags'];
    return Array.isArray(v) ? v : [];
  }

  startEditTags(ev: Event) {
    ev.stopPropagation();
    this.editTagsValue = this.itemTags.join(', ');
    this.editingTags = true;
  }

  cancelEditTags(ev?: Event) {
    if (ev) ev.stopPropagation();
    this.editingTags = false;
  }

  saveTags(ev?: Event) {
    if (ev) ev.stopPropagation();
    const parsedTags = this.editTagsValue.split(',').map(t => t.trim().replace(/^#/, '')).filter(t => t.length > 0);
    this.itemsSvc.updateTags(this.item.id, parsedTags);
    this.editingTags = false;
  }

  remove(ev: Event) {
    ev.stopPropagation();
    this.itemsSvc.remove(this.item.id);
  }
}
