import { AfterViewInit, Component, Input, OnInit, OnDestroy, HostListener, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Item } from '../../models/item.model';
import { ItemsService } from '../../services/items.service';
import { RealtimeService } from '../../services/realtime.service';
import { InstagramEmbedService } from '../../services/instagram-embed.service';
import { ItemViewerService } from '../../services/item-viewer.service';
import { ContextMenuService, MenuItem } from '../../services/context-menu.service';
import { ToastService } from '../../services/toast.service';
import { BoardsService } from '../../services/boards.service';
import { openUrl } from '@tauri-apps/plugin-opener';
import { TagInputComponent } from '../tag-input/tag-input.component';
import { DatetimePickerComponent } from '../datetime-picker/datetime-picker.component';
import { Clipboard } from '@angular/cdk/clipboard';

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-item-card',
  standalone: true,
  imports: [CommonModule, FormsModule, TagInputComponent, DatetimePickerComponent],
  templateUrl: './item-card.component.html',
  styleUrl: './item-card.component.scss'
})
export class ItemCardComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @Input({ required: true }) item!: Item;
  mediaUrl: string | null = null;
  reelEmbedHtml: SafeHtml | null = null;
  private lastReelHtml: string | null = null;
  editingTags = false;
  editTagsValue: string[] = [];
  showExpireMenu = false;
  expireText = '';
  deadlineUrgency: 'normal' | 'warning' | 'danger' = 'normal';
  deadlineType: 'expire' | 'snooze' | 'deadline' | null = null;
  private timerId: any;
  
  showCustomSnooze = false;
  customSnoozeInitialDate: Date = new Date();

  showCustomExpire = false;
  customExpireInitialDate: Date = new Date();

  showCustomDeadline = false;
  customDeadlineInitialDate: Date = new Date();

  showCustomReminder = false;
  customReminderInitialDate: Date = new Date();
  customReminderInitialRecurrence: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly' = 'once';

  startX = 0;
  startY = 0;
  swipeTranslation = 0;
  swipeThreshold = 80;
  swipeTransform = '';
  swipeTransition = '';
  isDragging = false;


  constructor(
    public itemsSvc: ItemsService,
    private realtimeSvc: RealtimeService,
    private sanitizer: DomSanitizer,
    private igEmbedSvc: InstagramEmbedService,
    private viewerSvc: ItemViewerService,
    private contextMenuSvc: ContextMenuService,
    private toastSvc: ToastService,
    private boardsSvc: BoardsService,
    private clipboard: Clipboard
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
        this.lastReelHtml = html;
        this.reelEmbedHtml = this.sanitizer.bypassSecurityTrustHtml(html);
      }
    }

    this.updateExpireText();
    this.timerId = setInterval(() => this.updateExpireText(), 60000); // Update every minute
  }

  ngOnDestroy() {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['item'] && !changes['item'].isFirstChange()) {
      if (this.item.type === 'reel') {
        const html = this.item.payload?.['embedHtml'];
        if (typeof html === 'string' && html && html !== this.lastReelHtml) {
          this.lastReelHtml = html;
          this.reelEmbedHtml = this.sanitizer.bypassSecurityTrustHtml(html);
          this.igEmbedSvc.ensureScriptLoaded();
          setTimeout(() => this.igEmbedSvc.reprocessEmbeds(), 50);
        }
      }
      this.updateExpireText();
    }
  }

  updateExpireText() {
    if (!this.item) return;

    const expireTime = this.item.expires_at ? new Date(this.item.expires_at).getTime() : Infinity;
    const snoozeTime = this.item.snooze_until ? new Date(this.item.snooze_until).getTime() : Infinity;
    const deadlineTime = this.item.payload?.deadline ? new Date(this.item.payload.deadline as string).getTime() : Infinity;
    
    if (expireTime === Infinity && snoozeTime === Infinity && deadlineTime === Infinity) {
      this.expireText = '';
      this.deadlineType = null;
      this.deadlineUrgency = 'normal';
      return;
    }
    
    const now = new Date().getTime();
    
    let targetTime = expireTime;
    this.deadlineType = 'expire';
    
    if (snoozeTime < targetTime) {
      targetTime = snoozeTime;
      this.deadlineType = 'snooze';
    }
    if (deadlineTime < targetTime) {
      targetTime = deadlineTime;
      this.deadlineType = 'deadline';
    }

    const diffMs = targetTime - now;
    
    if (diffMs <= 0) {
      this.expireText = this.deadlineType === 'expire' ? 'Expired' : this.deadlineType === 'deadline' ? 'Overdue' : 'Woke up';
      this.deadlineUrgency = 'danger';
      return;
    }
    
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    let prefix = '';
    if (this.deadlineType === 'expire') {
      prefix = this.item.status === 'deleted' ? 'Deletes' : 'Expires';
    } else if (this.deadlineType === 'deadline') {
      prefix = 'Deadline';
    } else {
      prefix = 'Snoozed';
    }
    
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      this.expireText = `${prefix} ${days}d`;
      this.deadlineUrgency = 'normal';
    } else if (hours > 0) {
      this.expireText = `${prefix} ${hours}h`;
      this.deadlineUrgency = hours <= 12 ? 'warning' : 'normal';
    } else {
      this.expireText = `${prefix} ${mins}m`;
      this.deadlineUrgency = 'danger';
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

  @HostListener('document:click')
  onDocumentClick() {
    if (this.showExpireMenu) {
      this.showExpireMenu = false;
    }
  }

  get isNew(): boolean {
    return this.realtimeSvc.recentlyArrivedIds().has(this.item.id);
  }

  get activeReminder(): { type: string, next_at: string } | null {
    const rem = this.item.payload?.['reminder'] as { type: string, next_at: string } | undefined;
    return rem ? rem : null;
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

  get displayUrl(): string {
    return this.linkUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  }

  get linkDomain(): string {
    const v = this.item.payload?.['domain'];
    return typeof v === 'string' ? v : '';
  }

  get linkTitle(): string {
    const v = this.item.payload?.['title'];
    const title = typeof v === 'string' && v ? v : this.linkDomain || this.linkUrl;
    return this.decodeHtmlEntities(title);
  }

  private decodeHtmlEntities(text: string): string {
    if (!text) return text;
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return doc.documentElement.textContent || text;
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
    this.editTagsValue = [...this.itemTags];
    this.editingTags = true;
  }

  cancelEditTags(ev?: Event) {
    if (ev) ev.stopPropagation();
    this.editingTags = false;
  }

  toggleTag(tag: string, ev?: Event) {
    if (ev) ev.stopPropagation();
    const set = new Set(this.itemsSvc.selectedTags());
    if (set.has(tag)) {
      set.delete(tag);
    } else {
      set.add(tag);
    }
    this.itemsSvc.selectedTags.set(set);
  }

  saveTags(ev?: Event) {
    if (ev) ev.stopPropagation();
    this.itemsSvc.updateTags(this.item.id, this.editTagsValue);
    this.editingTags = false;
  }

  remove(ev: Event) {
    ev.stopPropagation();
    this.itemsSvc.remove(this.item.id);
  }

  togglePin(ev: Event) {
    ev.stopPropagation();
    const newPinState = !this.item.is_pinned;
    // Optimistic UI update
    this.item = { ...this.item, is_pinned: newPinState };
    
    // Fire and forget network call
    this.itemsSvc.togglePin(this.item.id, newPinState);
  }

  toggleSelection(ev: Event) {
    ev.stopPropagation();
    const current = new Set(this.itemsSvc.selectedItemIds());
    if (current.has(this.item.id)) {
      current.delete(this.item.id);
    } else {
      current.add(this.item.id);
    }
    this.itemsSvc.selectedItemIds.set(current);
  }

  toggleExpireMenu(ev: Event) {
    ev.stopPropagation();
    this.showExpireMenu = !this.showExpireMenu;
  }

  setExpire(ev: Event, hours: number) {
    ev.stopPropagation();
    this.showExpireMenu = false;

    if (hours === 0) {
      this.item = { ...this.item, expires_at: null };
      this.itemsSvc.updateExpire(this.item.id, null);
    } else {
      const targetDate = new Date();
      targetDate.setHours(targetDate.getHours() + hours);
      const expiresAt = targetDate.toISOString();
      this.item = { ...this.item, expires_at: expiresAt };
      this.itemsSvc.updateExpire(this.item.id, expiresAt);
    }
    this.updateExpireText();
  }

  copyContent(ev: Event) {
    ev.stopPropagation();
    if (this.item.type === 'link' || this.item.type === 'reel') {
      this.clipboard.copy(this.linkUrl || this.linkTitle);
      this.toastSvc.show('Link copied!');
    } else if (this.item.type === 'text') {
      this.clipboard.copy(this.noteText);
      this.toastSvc.show('Text copied!');
    } else if (this.item.type === 'image' && this.mediaUrl) {
      this.copyImageToClipboard(this.mediaUrl);
    }
  }

  async copyImageToClipboard(url: string) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new (window as any).ClipboardItem({
          [blob.type]: blob
        })
      ]);
      this.toastSvc.show('Image copied!');
    } catch (err) {
      console.error('Failed to copy image', err);
      this.toastSvc.show('Failed to copy image', 'error');
    }
  }

  setExpireFromMenu(ev: Event, hours: number) {
    this.contextMenuSvc.close();
    this.setExpire(ev, hours);
  }

  setSnoozeFromMenu(e: Event, type: '8PM_TODAY' | '8AM_TOMORROW' | 'NEXT_MONDAY_8AM' | 'SUNDAY_8AM' | 'SATURDAY_8PM' | 'CLEAR' | 'CUSTOM') {
    if (e && e.stopPropagation) e.stopPropagation();
    
    if (type === 'CLEAR') {
      this.itemsSvc.setSnooze(this.item.id, null);
      this.contextMenuSvc.close();
      return;
    }
    
    if (type === 'CUSTOM') {
      this.customSnoozeInitialDate = this.item.snooze_until ? new Date(this.item.snooze_until) : new Date();
      this.showCustomSnooze = true;
      this.contextMenuSvc.close();
      return;
    }

    const now = new Date();
    const target = new Date(now);

    switch (type) {
      case '8PM_TODAY':
        target.setHours(20, 0, 0, 0);
        if (target <= now) target.setDate(target.getDate() + 1);
        break;
      case '8AM_TOMORROW':
        target.setDate(target.getDate() + 1);
        target.setHours(8, 0, 0, 0);
        break;
      case 'NEXT_MONDAY_8AM':
        target.setDate(target.getDate() + ((1 + 7 - target.getDay()) % 7 || 7));
        target.setHours(8, 0, 0, 0);
        break;
      case 'SUNDAY_8AM':
        target.setDate(target.getDate() + ((0 + 7 - target.getDay()) % 7 || 7));
        target.setHours(8, 0, 0, 0);
        break;
      case 'SATURDAY_8PM':
        target.setDate(target.getDate() + ((6 + 7 - target.getDay()) % 7 || 7));
        target.setHours(20, 0, 0, 0);
        break;
    }

    this.itemsSvc.setSnooze(this.item.id, target.toISOString());
    this.contextMenuSvc.close();
  }
  
  onCustomSnoozeConfirm(date: Date) {
    this.itemsSvc.setSnooze(this.item.id, date.toISOString());
    this.showCustomSnooze = false;
  }
  
  onCustomSnoozeCancel() {
    this.showCustomSnooze = false;
  }

  setExpireCustom(e: Event) {
    if (e && e.stopPropagation) e.stopPropagation();
    this.customExpireInitialDate = this.item.expires_at ? new Date(this.item.expires_at) : new Date();
    this.showCustomExpire = true;
    this.contextMenuSvc.close();
  }

  onCustomExpireConfirm(date: Date) {
    this.showCustomExpire = false;
    this.item = { ...this.item, expires_at: date.toISOString() };
    this.itemsSvc.updateExpire(this.item.id, date.toISOString());
    this.updateExpireText();
  }

  onCustomExpireCancel() {
    this.showCustomExpire = false;
  }

  setDeadlineFromMenu(e: Event, type: 'TODAY' | 'TOMORROW' | 'NEXT_WEEK' | 'CLEAR' | 'CUSTOM') {
    if (e && e.stopPropagation) e.stopPropagation();
    
    if (type === 'CLEAR') {
      this.itemsSvc.setDeadline(this.item.id, null);
      this.contextMenuSvc.close();
      return;
    }
    
    if (type === 'CUSTOM') {
      this.customDeadlineInitialDate = this.item.payload?.deadline ? new Date(this.item.payload.deadline as string) : new Date();
      this.showCustomDeadline = true;
      this.contextMenuSvc.close();
      return;
    }

    const now = new Date();
    const target = new Date(now);

    switch (type) {
      case 'TODAY':
        target.setHours(23, 59, 59, 999);
        break;
      case 'TOMORROW':
        target.setDate(target.getDate() + 1);
        target.setHours(23, 59, 59, 999);
        break;
      case 'NEXT_WEEK':
        target.setDate(target.getDate() + 7);
        target.setHours(23, 59, 59, 999);
        break;
    }

    this.itemsSvc.setDeadline(this.item.id, target.toISOString());
    this.contextMenuSvc.close();
  }
  
  onCustomDeadlineConfirm(date: Date) {
    this.itemsSvc.setDeadline(this.item.id, date.toISOString());
    this.showCustomDeadline = false;
  }
  
  onCustomDeadlineCancel() {
    this.showCustomDeadline = false;
  }

  setReminderFromMenu(e: Event, type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'once' | 'clear' | 'CUSTOM') {
    if (e && e.stopPropagation) e.stopPropagation();
    
    if (type === 'clear') {
      this.itemsSvc.setReminder(this.item.id, 'clear');
      this.contextMenuSvc.close();
      return;
    }
    
    if (type === 'CUSTOM') {
      const existing = this.item.payload?.['reminder'] as { type?: string, next_at?: string } | undefined;
      this.customReminderInitialDate = existing?.next_at ? new Date(existing.next_at) : new Date();
      this.customReminderInitialRecurrence = (existing?.type as any) || 'once';
      this.showCustomReminder = true;
      this.contextMenuSvc.close();
      return;
    }

    this.itemsSvc.setReminder(this.item.id, type as any);
    this.contextMenuSvc.close();
  }

  onCustomReminderConfirm(event: { date: Date, recurrence: string }) {
    this.itemsSvc.setReminder(this.item.id, event.recurrence as any, event.date.toISOString());
    this.showCustomReminder = false;
  }

  onCustomReminderCancel() {
    this.showCustomReminder = false;
  }

  markUnread(ev: Event) {
    ev.stopPropagation();
    // Optimistic UI update
    this.item = { ...this.item, status: 'unseen', seen_at: null };
    
    // Fire and forget network call
    this.itemsSvc.markUnread(this.item.id);
  }

  onContextMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    if (this.item.status === 'deleted') {
      this.contextMenuSvc.open(event, [
        {
          label: 'Restore',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>',
          action: () => this.itemsSvc.restore(this.item.id)
        },
        {
          label: 'Permanently Delete',
          icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
          action: () => this.itemsSvc.permanentlyDelete(this.item.id),
          danger: true
        }
      ]);
      return;
    }

    const items: MenuItem[] = [
      {
        label: this.item.is_pinned ? 'Unpin' : 'Pin to top',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5" /><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" /></svg>',
        action: () => this.togglePin(event)
      }
    ];

    if (this.item.status === 'seen') {
      items.push({
        label: 'Mark as unread',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 9l-5-5-5 5M12 12.8V2.5" /></svg>',
        action: () => this.markUnread(event)
      });
    } else {
      items.push({
        label: 'Mark as read',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        action: () => this.markAsRead(event)
      });
    }

    if (this.item.type === 'link' || this.item.type === 'reel') {
      items.push({
        label: 'Copy link',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
        action: () => { 
          this.clipboard.copy(this.linkUrl || this.linkTitle);
          this.toastSvc.show('Link copied!');
        }
      });
    } else if (this.item.type === 'text') {
      items.push({
        label: 'Copy text',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
        action: () => { 
          this.clipboard.copy(this.noteText);
          this.toastSvc.show('Text copied!');
        }
      });
    } else if (this.item.type === 'image' && this.mediaUrl) {
      items.push({
        label: 'Copy image',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
        action: () => { this.copyImageToClipboard(this.mediaUrl!); }
      });
    }

    // ── Sharing ──
    const shareIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>';
    if (this.item.share_token) {
      items.push({
        label: 'Copy share link',
        icon: shareIcon,
        action: () => {
          this.itemsSvc.copyShareLink(this.item.share_token!);
          this.contextMenuSvc.close();
        }
      });
      items.push({
        label: 'Stop sharing',
        icon: shareIcon,
        danger: true,
        action: () => {
          this.itemsSvc.unshareItem(this.item.id);
          this.contextMenuSvc.close();
        }
      });
    } else {
      items.push({
        label: 'Share link',
        icon: shareIcon,
        action: () => {
          this.itemsSvc.shareItem(this.item.id);
          this.contextMenuSvc.close();
        }
      });
    }

    items.push({
      label: this.item.expires_at ? 'Edit Expiration' : 'Set Expiration',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      keepOpen: true,
      action: (e) => {
        const expireItems: MenuItem[] = [
          { label: '1 Hour', action: () => this.setExpireFromMenu(e!, 1) },
          { label: '6 Hours', action: () => this.setExpireFromMenu(e!, 6) },
          { label: '24 Hours', action: () => this.setExpireFromMenu(e!, 24) },
          { label: '7 Days', action: () => this.setExpireFromMenu(e!, 168) },
          { label: '1 Month', action: () => this.setExpireFromMenu(e!, 720) },
          { label: 'Custom...', action: () => this.setExpireCustom(e!) }
        ];
        if (this.item.expires_at) {
          expireItems.push({ label: 'Remove Expiration', danger: true, action: () => this.setExpireFromMenu(e!, 0) });
        }
        this.contextMenuSvc.items.set(expireItems);
      }
    });

    items.push({
      label: 'Snooze',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
      keepOpen: true,
      action: (e) => {
        const snoozeItems: MenuItem[] = [
          { label: 'Later today (8:00 PM)', action: () => this.setSnoozeFromMenu(e!, '8PM_TODAY') },
          { label: 'Tomorrow morning (8:00 AM)', action: () => this.setSnoozeFromMenu(e!, '8AM_TOMORROW') },
          { label: 'This weekend (Sat 8:00 PM)', action: () => this.setSnoozeFromMenu(e!, 'SATURDAY_8PM') },
          { label: 'Sunday morning (8:00 AM)', action: () => this.setSnoozeFromMenu(e!, 'SUNDAY_8AM') },
          { label: 'Next week (Mon 8:00 AM)', action: () => this.setSnoozeFromMenu(e!, 'NEXT_MONDAY_8AM') },
          { label: 'Custom...', action: () => this.setSnoozeFromMenu(e!, 'CUSTOM') }
        ];
        if (this.item.snooze_until) {
          snoozeItems.push({ label: 'Remove Snooze', danger: true, action: () => this.setSnoozeFromMenu(e!, 'CLEAR') });
        }
        this.contextMenuSvc.items.set(snoozeItems);
      }
    });

    items.push({
      label: this.item.payload?.deadline ? 'Edit Deadline' : 'Set Deadline',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
      keepOpen: true,
      action: (e) => {
        const deadlineItems: MenuItem[] = [
          { label: 'Today', action: () => this.setDeadlineFromMenu(e!, 'TODAY') },
          { label: 'Tomorrow', action: () => this.setDeadlineFromMenu(e!, 'TOMORROW') },
          { label: 'Next Week', action: () => this.setDeadlineFromMenu(e!, 'NEXT_WEEK') },
          { label: 'Custom...', action: () => this.setDeadlineFromMenu(e!, 'CUSTOM') }
        ];
        if (this.item.payload?.deadline) {
          deadlineItems.push({ label: 'Remove Deadline', danger: true, action: () => this.setDeadlineFromMenu(e!, 'CLEAR') });
        }
        this.contextMenuSvc.items.set(deadlineItems);
      }
    });

    items.push({
      label: this.item.payload?.['reminder'] ? 'Edit Schedule' : 'Set Schedule',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 21h4"></path><path d="M12 2v2"></path><path d="M12 22v-1"></path><path d="M22 12h-1"></path><path d="M3 12H2"></path><path d="M19.07 4.93l-.71.71"></path><path d="M5.64 18.36l-.71.71"></path><path d="M19.07 19.07l-.71-.71"></path><path d="M5.64 5.64l-.71-.71"></path><circle cx="12" cy="12" r="6"></circle></svg>',
      keepOpen: true,
      action: (e) => {
        const reminderItems: MenuItem[] = [
          { label: 'Set/Edit Schedule...', action: () => this.setReminderFromMenu(e!, 'CUSTOM') }
        ];
        if (this.item.payload?.['reminder']) {
          reminderItems.push({ label: 'Remove Schedule', danger: true, action: () => this.setReminderFromMenu(e!, 'clear') });
        }
        this.contextMenuSvc.items.set(reminderItems);
      }
    });

    // ── Move to Board ──
    const moveIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>';
    const boards = this.boardsSvc.boards();
    if (boards.length > 0) {
      items.push({
        label: 'Move to Board',
        icon: moveIcon,
        keepOpen: true,
        action: () => {
          const boardItems: MenuItem[] = [];
          // "Inbox" option to move out of any board
          if (this.item.board_id) {
            boardItems.push({
              label: '📥 Inbox (no board)',
              action: () => {
                this.itemsSvc.moveToBoard(this.item.id, null);
                this.contextMenuSvc.close();
              }
            });
          }
          for (const board of boards) {
            if (board.id !== this.item.board_id) {
              boardItems.push({
                label: board.name,
                action: () => {
                  this.itemsSvc.moveToBoard(this.item.id, board.id);
                  this.contextMenuSvc.close();
                }
              });
            }
          }
          if (boardItems.length === 0) {
            boardItems.push({ label: 'Already in all boards', action: () => this.contextMenuSvc.close() });
          }
          this.contextMenuSvc.items.set(boardItems);
        }
      });
    }

    if (this.item.status === 'archived') {
      items.push({
        label: 'Unarchive',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8v11a2 2 0 0 0 2 2h2"></path><path d="M20 8v11a2 2 0 0 1-2 2h-2"></path><path d="m9 15 3-3 3 3"></path><path d="M12 12v9"></path><rect width="20" height="5" x="2" y="3" rx="1"></rect></svg>',
        action: (e) => {
          if (e && e.stopPropagation) e.stopPropagation();
          this.itemsSvc.unarchive(this.item.id);
        }
      });
    } else {
      items.push({
        label: 'Archive',
        icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>',
        action: (e) => this.archiveItem(e!)
      });
    }

    items.push({
      label: 'Delete',
      icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
      action: () => this.remove(event),
      danger: true
    });

    this.contextMenuSvc.open(event, items);
  }

  onTouchStart(ev: TouchEvent) {
    this.startX = ev.touches[0].clientX;
    this.startY = ev.touches[0].clientY;
    this.isDragging = true;
    this.swipeTransition = '';
  }

  onTouchMove(ev: TouchEvent) {
    if (!this.isDragging) return;
    
    const currentX = ev.touches[0].clientX;
    const currentY = ev.touches[0].clientY;
    
    if (Math.abs(currentY - this.startY) > Math.abs(currentX - this.startX)) {
      return;
    }
    
    this.swipeTranslation = currentX - this.startX;
    
    if (this.swipeTranslation > this.swipeThreshold + 30) {
       this.swipeTranslation = this.swipeThreshold + 30 + (this.swipeTranslation - (this.swipeThreshold + 30)) * 0.2;
    } else if (this.swipeTranslation < -this.swipeThreshold - 30) {
       this.swipeTranslation = -this.swipeThreshold - 30 + (this.swipeTranslation - (-this.swipeThreshold - 30)) * 0.2;
    }
    
    this.swipeTransform = `translateX(${this.swipeTranslation}px)`;
  }

  onTouchEnd(ev: TouchEvent) {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.swipeTransition = 'transform 0.2s ease-out';
    
    if (this.swipeTranslation > this.swipeThreshold) {
      this.swipeTransform = 'translateX(100%)';
      setTimeout(() => {
        if (this.item.status === 'archived') {
          this.unarchiveItem(ev);
        } else {
          this.archiveItem(ev);
        }
        this.resetSwipe();
      }, 200);
    } else if (this.swipeTranslation < -this.swipeThreshold) {
      this.swipeTransform = 'translateX(-100%)';
      setTimeout(() => {
         this.togglePin(ev as any);
         this.resetSwipe();
      }, 200);
    } else {
      this.resetSwipe();
    }
  }

  resetSwipe() {
    this.swipeTranslation = 0;
    this.swipeTransform = 'translateX(0)';
  }

  archiveItem(ev: Event) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    this.itemsSvc.archive(this.item.id);
  }

  unarchiveItem(ev: Event) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    this.itemsSvc.unarchive(this.item.id);
  }
}
