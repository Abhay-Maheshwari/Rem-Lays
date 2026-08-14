import { Injectable, computed, signal } from '@angular/core';
import { supabase } from './supabase-client';
import { Item, ItemType } from '../models/item.model';
import { OfflineQueueService } from './offline-queue.service';
import { DevicesService } from './devices.service';
import { ToastService } from './toast.service';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { NativeNotificationService } from './native-notification.service';
import { BoardsService } from './boards.service';
import { CacheService } from './cache.service';
import { LocalDbService } from './local-db.service';
import { environment } from '../../environments/environment';

export type FeedFilter = 'all' | 'unseen' | 'link' | 'media' | 'archived' | 'snoozed' | 'shared' | 'deleted' | 'untagged' | 'pending';

@Injectable({ providedIn: 'root' })
export class ItemsService {
  items = signal<Item[]>([]);
  filter = signal<FeedFilter>('all');
  searchQuery = signal('');
  selectedTags = signal<Set<string>>(new Set());
  tagMatchMode = signal<'AND' | 'OR' | 'NOT'>('OR');
  tagSortMode = signal<'count' | 'alpha'>('count');
  activeBoardId = signal<string | null>(null);

  selectionMode = signal<boolean>(false);
  selectedItemIds = signal<Set<string>>(new Set());

  currentTime = signal<number>(Date.now());
  private snoozeCheckInterval: any;
  private lastSnoozeCheck = Date.now();
  private lastReminderCheck = Date.now();

  /** In-memory fingerprint sets for fast duplicate detection. */
  private textFingerprints = new Map<string, string>();  // note text -> item id
  private linkFingerprints = new Map<string, string>();  // url -> item id

  /** Signed URL TTL: 50 minutes (URLs expire in 60min, 10min safety margin). */
  private readonly SIGNED_URL_TTL = 50 * 60 * 1000;

  constructor(
    private offlineQueue: OfflineQueueService, 
    private devicesService: DevicesService,
    private toastSvc: ToastService,
    private notificationSvc: NativeNotificationService,
    private boardsSvc: BoardsService,
    private cache: CacheService,
    private localDb: LocalDbService
  ) {
    this.snoozeCheckInterval = setInterval(() => {
      this.checkSnoozes();
      this.checkReminders();
    }, 60000);

    // Load cached items from IndexedDB on service init (instant display)
    this.loadFromCache();
  }

  // ─── Cache helpers ──────────────────────────────────────────────────

  /** Load items from IndexedDB for instant display on app launch. */
  private async loadFromCache() {
    const cached = await this.localDb.getAll<Item>('items');
    if (cached.length > 0 && this.items().length === 0) {
      this.items.set(cached);
      this.rebuildFingerprints(cached);
    }
  }

  /** Rebuild the in-memory fingerprint sets from an items array. */
  private rebuildFingerprints(items: Item[]) {
    this.textFingerprints.clear();
    this.linkFingerprints.clear();
    for (const item of items) {
      if (item.status === 'deleted') continue;
      if (item.type === 'text' && item.payload?.['note']) {
        this.textFingerprints.set(item.payload['note'] as string, item.id);
      }
      if ((item.type === 'link' || item.type === 'reel') && item.payload?.['url']) {
        this.linkFingerprints.set(item.payload['url'] as string, item.id);
      }
    }
  }

  /**
   * Optimistic local update — patches an item in the signal without
   * a network round-trip. The actual DB write happens separately;
   * Realtime handles cross-device sync.
   */
  private optimisticUpdate(id: string, patch: Partial<Item>) {
    this.items.update(items =>
      items.map(i => i.id === id ? { ...i, ...patch } : i)
    );
    // Write-through to IndexedDB (fire-and-forget)
    const updated = this.items().find(i => i.id === id);
    if (updated) this.localDb.put('items', updated);
  }

  /** Optimistic remove — takes an item out of the signal immediately. */
  private optimisticRemove(id: string) {
    this.items.update(items => items.filter(i => i.id !== id));
    this.localDb.delete('items', id);
  }

  getBoardIdFromTags(tags: string[] | undefined): string | null {
    if (!tags || tags.length === 0) return null;
    const boards = this.boardsSvc.boards();
    for (const tag of tags) {
      const match = boards.find(b => b.auto_assign_hashtags && b.auto_assign_hashtags.some(t => t.toLowerCase() === tag.toLowerCase()));
      if (match) return match.id;
    }
    return null;
  }

  checkSnoozes() {
    const now = Date.now();
    this.currentTime.set(now);
    
    for (const item of this.items()) {
      if (item.snooze_until && item.status !== 'archived') {
        const snoozeTime = new Date(item.snooze_until).getTime();
        if (snoozeTime <= now && snoozeTime > this.lastSnoozeCheck) {
          this.notificationSvc.notifyIfBackgrounded(
            'Snoozed Item Woke Up',
            item.type === 'text' ? (item.payload as any)['text'] : 'Check your inbox.'
          );
        }
      }
    }
    this.lastSnoozeCheck = now;
  }

  checkReminders() {
    const now = Date.now();
    for (const item of this.items()) {
      if (item.status === 'archived' || item.status === 'deleted') continue;
      const reminder = item.payload?.['reminder'] as { type: string, next_at: string } | undefined;
      if (reminder && reminder.next_at) {
        const reminderTime = new Date(reminder.next_at).getTime();
        if (reminderTime <= now && reminderTime > this.lastReminderCheck) {
          this.notificationSvc.notifyIfBackgrounded(
            'Reminder',
            item.type === 'text' ? (item.payload as any)['note'] || (item.payload as any)['text'] : 'Check your reminder.'
          );
          
          // Mark as unseen so it pops back into Inbox
          this.optimisticUpdate(item.id, { status: 'unseen', seen_at: null } as Partial<Item>);
          
          // Schedule next occurrence or clear
          let nextPayload = { ...item.payload };
          if (reminder.type === 'once') {
            delete nextPayload['reminder'];
          } else {
            const nextDate = new Date(reminder.next_at);
            if (reminder.type === 'daily') nextDate.setDate(nextDate.getDate() + 1);
            else if (reminder.type === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
            else if (reminder.type === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
            else if (reminder.type === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
            
            // Catch up if missed multiple periods
            while (nextDate.getTime() <= now) {
               if (reminder.type === 'daily') nextDate.setDate(nextDate.getDate() + 1);
               else if (reminder.type === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
               else if (reminder.type === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
               else if (reminder.type === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
            }
            
            nextPayload['reminder'] = { ...reminder, next_at: nextDate.toISOString() };
          }
          
          supabase.from('items').update({ status: 'unseen', seen_at: null, payload: nextPayload }).eq('id', item.id).then();
          this.optimisticUpdate(item.id, { payload: nextPayload });
        }
      }
    }
    this.lastReminderCheck = now;
  }

  baseViewItems = computed(() => {
    let all = this.items();
    const nowStr = new Date(this.currentTime()).toISOString();
    const activeBoard = this.activeBoardId();
    const boardMatch = (i: Item) => {
      if (activeBoard === '*') return true;
      if (this.filter() !== 'all') return true;
      return (i.board_id || null) === activeBoard;
    };
    
    // Filter out expired and archived items locally, unless viewing archive
    if (this.filter() === 'archived') {
      all = all.filter(i => i.status === 'archived' && boardMatch(i));
    } else if (this.filter() === 'snoozed') {
      all = all.filter(i => i.snooze_until && i.snooze_until > nowStr && i.status !== 'archived' && boardMatch(i));
    } else if (this.filter() === 'deleted') {
      all = all.filter(i => i.status === 'deleted' && boardMatch(i));
    } else {
      all = all.filter(i => 
        (!i.expires_at || i.expires_at > nowStr) && 
        i.status !== 'archived' &&
        i.status !== 'deleted' &&
        (!i.snooze_until || i.snooze_until <= nowStr) &&
        boardMatch(i)
      );
    }

    let result = all;
    switch (this.filter()) {
      case 'unseen':
        result = all.filter((i) => i.status === 'unseen');
        break;
      case 'pending':
        result = all.filter((i) => i.payload && i.payload['deadline']);
        break;
      case 'link':
        result = all.filter((i) => i.type === 'link' || i.type === 'reel');
        break;
      case 'media':
        result = all.filter((i) => i.type === 'image' || i.type === 'video');
        break;
      case 'shared':
        result = all.filter((i) => i.share_token !== null);
        break;
      case 'untagged':
        result = all.filter((i) => !i.payload['tags'] || (Array.isArray(i.payload['tags']) && i.payload['tags'].length === 0));
        break;
    }
    return result;
  });

  allTags = computed(() => {
    const tags = new Set<string>();
    for (const item of this.baseViewItems()) {
      if (item.payload['tags'] && Array.isArray(item.payload['tags'])) {
        for (const tag of item.payload['tags']) {
          tags.add(tag);
        }
      }
    }
    const tagArray = Array.from(tags);
    if (this.tagSortMode() === 'alpha') {
      return tagArray.sort();
    } else {
      const counts = this.tagCounts();
      return tagArray.sort((a, b) => {
        const countDiff = (counts.get(b) || 0) - (counts.get(a) || 0);
        return countDiff !== 0 ? countDiff : a.localeCompare(b);
      });
    }
  });

  tagCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const item of this.baseViewItems()) {
      if (item.payload['tags'] && Array.isArray(item.payload['tags'])) {
        for (const tag of item.payload['tags']) {
          counts.set(tag, (counts.get(tag) || 0) + 1);
        }
      }
    }
    return counts;
  });

  /** Deterministic HSL color from tag name hash — same tag always gets same color. */
  getTagColor(tag: string): string {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 60%)`;
  }

  // Derived views — same pattern as DevicesService's plain signal, just
  // with a computed() layered on top since the feed needs filtering.
  filteredItems = computed(() => {
    let all = this.baseViewItems();
    
    const tags = this.selectedTags();
    if (tags.size > 0) {
      const mode = this.tagMatchMode();
      all = all.filter(i => {
        const itemTags = i.payload['tags'];
        if (!Array.isArray(itemTags)) return mode === 'NOT';
        if (mode === 'AND') {
          return Array.from(tags).every(t => itemTags.includes(t));
        } else if (mode === 'OR') {
          return Array.from(tags).some(t => itemTags.includes(t));
        } else if (mode === 'NOT') {
          return !Array.from(tags).some(t => itemTags.includes(t));
        }
        return false;
      });
    }

    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      all = all.filter(i => {
        const payloadStr = JSON.stringify(i.payload).toLowerCase();
        return payloadStr.includes(query);
      });
    }

    // Stable sort: Pinned first, then by date (newest first), then by ID
    return all.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;

      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return diff !== 0 ? diff : b.id.localeCompare(a.id);
    });
  });

  unseenCount = computed(() => {
    const now = new Date().toISOString();
    return this.items().filter((i) => i.status === 'unseen' && (!i.snooze_until || i.snooze_until <= now) && (!i.expires_at || i.expires_at > now)).length;
  });

  pendingCount = computed(() => {
    const now = new Date().toISOString();
    return this.items().filter((i) => i.payload && i.payload['deadline'] && i.status !== 'archived' && i.status !== 'deleted' && (!i.snooze_until || i.snooze_until <= now) && (!i.expires_at || i.expires_at > now)).length;
  });

  getBoardUnseenCount(boardId: string) {
    const now = new Date().toISOString();
    return this.items().filter(i => i.status === 'unseen' && (!i.expires_at || i.expires_at > now) && i.board_id === boardId).length;
  }

  async refresh() {
    const now = new Date().toISOString();

    // Background cleanup: Items that were normally expiring should go to Trash instead of being permanently deleted.
    // However, if they are ALREADY in the Trash ('deleted' status) and their trash expiration (expires_at) passes, THEN delete them permanently.
    
    // 1. Permanently delete items that were already in the trash and have passed their 30-day trash expiration.
    supabase.from('items').delete().lt('expires_at', now).eq('status', 'deleted').then();

    // 2. Move newly expired normal items to the trash, giving them a 30-day trash lifespan.
    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() + 30);
    const trashExpiresAt = deleteDate.toISOString();
    supabase.from('items').update({ status: 'deleted', expires_at: trashExpiresAt }).lt('expires_at', now).neq('status', 'deleted').then();

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .or(`expires_at.is.null,expires_at.gt.${now},status.eq.deleted`)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('items refresh failed', error);
      this.toastSvc.show('Refresh Error: ' + error.message, 'error');
      return;
    }
    const items = (data ?? []) as Item[];
    this.items.set(items);

    // Persist to IndexedDB + rebuild fingerprints (fire-and-forget)
    this.localDb.replaceAll('items', items);
    this.localDb.setMeta('items_last_sync', Date.now());
    this.rebuildFingerprints(items);
  }

  /**
   * Text/link items only — media (image/video) goes through addMedia()
   * below instead, since it needs the presign-upload round trip first.
   * Reel embeds still don't exist as a real write path (Phase 6).
   *
   * Offline handling: checked proactively via navigator.onLine before
   * even attempting the write, and reactively if the write throws
   * anyway (mobile connectivity lies to navigator.onLine often enough
   * that both checks earn their place). Either way, nothing is lost —
   * it lands in the local queue and retries on reconnect.
   */
  async addText(note: string, tags?: string[]) {
    const trimmed = note.trim();
    if (!trimmed) return;

    if (!navigator.onLine) {
      this.offlineQueue.enqueue({ kind: 'text', note: trimmed, tags, queuedAt: new Date().toISOString() });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Duplicate detection for text notes
    const { data: existing } = await supabase
      .from('items')
      .select('id, payload, status')
      .eq('user_id', userData.user.id)
      .neq('status', 'deleted')
      .eq('type', 'text');

    const duplicate = existing?.find(i => (i.payload as any)?.note === trimmed);

    if (duplicate) {
      const existingTags = Array.isArray((duplicate.payload as any)?.tags) ? (duplicate.payload as any).tags : [];
      const newTags = tags || [];
      const mergedTags = Array.from(new Set([...existingTags, ...newTags]));

      const { error: updateError } = await supabase
        .from('items')
        .update({
          created_at: new Date().toISOString(),
          status: 'unseen', // Bring it back to attention
          seen_at: null,
          payload: { ...(duplicate.payload as any), tags: mergedTags.length > 0 ? mergedTags : undefined }
        })
        .eq('id', duplicate.id);

      if (updateError) {
        console.error('duplicate update failed, queuing for retry', updateError);
        this.offlineQueue.enqueue({ kind: 'text', note: trimmed, tags, queuedAt: new Date().toISOString() });
      } else {
        await this.refresh();
        this.toastSvc.show('Note already exists! Timestamp updated.');
      }
      return;
    }

    const insertPayload: any = {
      user_id: userData.user.id,
      source_device_id: this.devicesService.currentDeviceId,
      type: 'text' as ItemType,
      payload: { note: trimmed, tags },
    };
    const mappedBoardId = this.getBoardIdFromTags(tags);
    if (mappedBoardId) {
      insertPayload.board_id = mappedBoardId;
    } else if (this.activeBoardId() && this.activeBoardId() !== '*') {
      insertPayload.board_id = this.activeBoardId();
    }

    const { error } = await supabase.from('items').insert(insertPayload);

    if (error) {
      console.error('addText failed, queuing for retry', error);
      this.toastSvc.show('Insert Error: ' + error.message, 'error');
      this.offlineQueue.enqueue({ kind: 'text', note: trimmed, tags, queuedAt: new Date().toISOString() });
      return;
    }
    await this.refresh();
  }

  async addLink(rawUrl: string, tags?: string[], note?: string) {
    if (!navigator.onLine) {
      this.offlineQueue.enqueue({ kind: 'link', url: rawUrl, tags, note, queuedAt: new Date().toISOString() });
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    let domain = rawUrl;
    try {
      domain = new URL(rawUrl).hostname.replace(/^www\./, '');
    } catch {
      // Not a valid URL — store it as-is rather than failing the write.
    }

    // Individual Instagram post/reel URLs get their own type so they can
    // render as a real embed instead of a generic link card. Profile
    // URLs (no /reel/, /p/, or /tv/ segment) intentionally fall through
    // to a plain link — Instagram's oEmbed doesn't support those anyway.
    const isInstagramPost = /instagram\.com\/(reel|p|tv)\//i.test(rawUrl);
    const type: ItemType = isInstagramPost ? 'reel' : 'link';

    // Duplicate detection
    const { data: existing } = await supabase
      .from('items')
      .select('id, payload, status')
      .eq('user_id', userData.user.id)
      .neq('status', 'deleted')
      .in('type', ['link', 'reel']);

    const duplicate = existing?.find(i => (i.payload as any)?.url === rawUrl);

    if (duplicate) {
      const existingTags = Array.isArray((duplicate.payload as any)?.tags) ? (duplicate.payload as any).tags : [];
      const newTags = tags || [];
      const mergedTags = Array.from(new Set([...existingTags, ...newTags]));
      
      const payloadUpdate: any = { ...(duplicate.payload as any), tags: mergedTags.length > 0 ? mergedTags : undefined };
      if (note) payloadUpdate.note = note;

      const { error: updateError } = await supabase
        .from('items')
        .update({
          created_at: new Date().toISOString(),
          status: 'unseen', // Bring it back to attention
          seen_at: null,
          payload: payloadUpdate
        })
        .eq('id', duplicate.id);

      if (updateError) {
        console.error('duplicate update failed, queuing for retry', updateError);
        this.offlineQueue.enqueue({ kind: 'link', url: rawUrl, tags, note, queuedAt: new Date().toISOString() });
      } else {
        await this.refresh();
        this.toastSvc.show('Link already exists! Timestamp updated.');
      }
      return;
    }

    const insertPayload: any = {
        user_id: userData.user.id,
        source_device_id: this.devicesService.currentDeviceId,
        type,
        payload: { url: rawUrl, domain, tags, note }
    };
    const mappedBoardId = this.getBoardIdFromTags(tags);
    if (mappedBoardId) {
      insertPayload.board_id = mappedBoardId;
    } else if (this.activeBoardId() && this.activeBoardId() !== '*') {
      insertPayload.board_id = this.activeBoardId();
    }

    const { data: inserted, error } = await supabase
      .from('items')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error || !inserted) {
      console.error('addLink failed, queuing for retry', error);
      this.offlineQueue.enqueue({ kind: 'link', url: rawUrl, tags, queuedAt: new Date().toISOString() });
      return;
    }
    await this.refresh();

    // Enrichment happens after the row exists and doesn't block the
    // insert on a remote fetch — the update lands via the same Realtime
    // path every other item change already uses, on every open device.
    if (type === 'reel') {
      this.enrichReel(inserted.id, rawUrl);
    } else {
      this.enrichLink(inserted.id, rawUrl, domain);
    }
  }

  async enrichLink(itemId: string, url: string, fallbackDomain: string) {
    try {
      const { data, error } = await supabase.functions.invoke('unfurl-link', { body: { url } });
      if (error || !data) return;
      const result = data as { title?: string; image?: string; domain?: string };
      
      const item = this.items().find(i => i.id === itemId);
      const dataPayload = item ? item.payload : {};

      await supabase
        .from('items')
        .update({
          payload: {
            ...dataPayload,
            url,
            domain: result.domain || fallbackDomain,
            title: result.title,
            image: result.image
          }
        })
        .eq('id', itemId);
    } catch (err) {
      console.error('enrichLink failed', err);
    }
  }

  async enrichReel(itemId: string, url: string) {
    try {
      const { data, error } = await supabase.functions.invoke('unfurl-reel', { body: { url } });
      
      const item = this.items().find(i => i.id === itemId);
      const dataPayload = item ? item.payload : {};

      if (error || !data) {
        // Fallback HTML if reel is private, deleted, or oEmbed fails
        const fallbackHtml = '<div style="padding: 30px 20px; text-align: center; color: var(--text-tertiary); font-size: 14px; background: rgba(0,0,0,0.2); border-radius: 8px;">Reel unavailable<br><span style="font-size: 12px; opacity: 0.7;">(It may be private or deleted)</span></div>';
        await supabase
          .from('items')
          .update({
            payload: { ...dataPayload, url, embedHtml: fallbackHtml }
          })
          .eq('id', itemId);
        return;
      }
      
      const result = data as { authorName?: string; html?: string };
      
      await supabase
        .from('items')
        .update({
          payload: { ...dataPayload, url, authorName: result.authorName, embedHtml: result.html }
        })
        .eq('id', itemId);
    } catch (err) {
      console.error('enrichReel failed', err);
      const fallbackHtml = '<div style="padding: 30px 20px; text-align: center; color: var(--text-tertiary); font-size: 14px; background: rgba(0,0,0,0.2); border-radius: 8px;">Reel unavailable<br><span style="font-size: 12px; opacity: 0.7;">(It may be private or deleted)</span></div>';
      const item = this.items().find(i => i.id === itemId);
      const dataPayload = item ? item.payload : {};
      try {
        await supabase
          .from('items')
          .update({
            payload: { ...dataPayload, url, embedHtml: fallbackHtml }
          })
          .eq('id', itemId);
      } catch (e) {
        console.error('fallback failed', e);
      }
    }
  }

  /** Replays anything queued while offline. Called on reconnect and once
   * on app launch (in case the app was closed before ever reconnecting).
   * Anything that fails again — still offline, or some other error —
   * re-enqueues itself naturally through addText/addLink's own fallback,
   * so nothing is silently dropped between attempts. */
  async flushOfflineQueue() {
    const queue = this.offlineQueue.dequeueAll();
    for (const op of queue) {
      if (op.kind === 'text') {
        await this.addText(op.note, op.tags);
      } else {
        await this.addLink(op.url, op.tags, op.note);
      }
    }
  }

  /**
   * Desktop only for now — see the design notes on why Android's share
   * pipeline can't reuse this yet (it needs a native upload bridge that
   * doesn't exist). File comes from a real <input type="file">, so this
   * is plain browser File API + fetch, nothing native involved.
   */
  async addMedia(file: File, tags?: string[]) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: presign, error: presignError } = await supabase.functions.invoke('presign-upload', {
      body: { contentType: file.type, sizeBytes: file.size }
    });
    if (presignError || !presign) {
      console.error('presign-upload failed', presignError);
      return;
    }

    const { storageKey, token } = presign as { storageKey: string; token: string };

    // NOT a raw PUT to a signed URL — Supabase's signed-upload flow needs
    // this specific token passed through uploadToSignedUrl, confirmed
    // against current docs rather than assumed.
    const { error: uploadError } = await supabase.storage.from('media').uploadToSignedUrl(storageKey, token, file);
    if (uploadError) {
      console.error('uploadToSignedUrl failed', uploadError);
      return;
    }

    // Only write the items row after a confirmed-successful upload, so a
    // failed upload never leaves a dangling item pointing at nothing.
    const type: ItemType = file.type.startsWith('video/') ? 'video' : 'image';
    const insertPayload: any = {
      user_id: userData.user.id,
      source_device_id: this.devicesService.currentDeviceId,
      type,
      payload: { filename: file.name, tags },
      storage_key: storageKey
    };
    const mappedBoardId = this.getBoardIdFromTags(tags);
    if (mappedBoardId) {
      insertPayload.board_id = mappedBoardId;
    } else if (this.activeBoardId() && this.activeBoardId() !== '*') {
      insertPayload.board_id = this.activeBoardId();
    }

    const { error: insertError } = await supabase.from('items').insert(insertPayload);
    if (insertError) console.error('addMedia insert failed', insertError);

    await this.refresh();
  }

  /** Used when the upload itself already happened natively (Android's
   * share pipeline, via the Kotlin bridge) — skips presign/upload
   * entirely, just writes the row once Kotlin hands back a storage key. */
  async addMediaFromStorageKey(storageKey: string, mimeType: string, filename: string, tags?: string[]) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const type: ItemType = mimeType.startsWith('video/') ? 'video' : 'image';
    const insertPayload: any = {
      user_id: userData.user.id,
      source_device_id: this.devicesService.currentDeviceId,
      type,
      payload: { filename, tags },
      storage_key: storageKey
    };
    const mappedBoardId = this.getBoardIdFromTags(tags);
    if (mappedBoardId) {
      insertPayload.board_id = mappedBoardId;
    } else if (this.activeBoardId() && this.activeBoardId() !== '*') {
      insertPayload.board_id = this.activeBoardId();
    }

    const { error } = await supabase.from('items').insert(insertPayload);
    if (error) console.error('addMediaFromStorageKey insert failed', error);
    await this.refresh();
  }

  /** Signed, time-limited download URL — the bucket is private, so this
   * is how ItemCardComponent actually renders an image/video, not a
   * public URL.
   *
   * Caching: checks in-memory cache first, then IndexedDB, then
   * fetches from Supabase Storage. Cached for 50min (URLs expire in 60min). */
  async getSignedDownloadUrl(storageKey: string): Promise<string | null> {
    // 1. In-memory cache hit?
    const memCached = this.cache.get<string>(`signed:${storageKey}`);
    if (memCached) return memCached;

    // 2. IndexedDB cache hit?
    const dbCached = await this.localDb.getSignedUrl(storageKey);
    if (dbCached) {
      // Promote to in-memory for faster repeated access this session
      this.cache.set(`signed:${storageKey}`, dbCached, this.SIGNED_URL_TTL);
      return dbCached;
    }

    // 3. Fetch from Supabase
    const { data, error } = await supabase.storage.from('media').createSignedUrl(storageKey, 3600);
    if (error || !data) {
      console.error('getSignedDownloadUrl failed', error);
      return null;
    }

    // Cache in both layers
    this.cache.set(`signed:${storageKey}`, data.signedUrl, this.SIGNED_URL_TTL);
    this.localDb.putSignedUrl(storageKey, data.signedUrl, this.SIGNED_URL_TTL);

    return data.signedUrl;
  }

  /**
   * This is the global-read-state mechanic from the design doc in its
   * simplest possible form: flip the row, everyone who queries it next
   * sees 'seen'. Broadcasting that change live to *other already-open*
   * devices is Phase 2's job (Realtime) — for now it only takes effect
   * on a manual refresh, which matches this phase's scope.
   */
  async markSeen(id: string) {
    this.optimisticUpdate(id, { status: 'seen', seen_at: new Date().toISOString() } as Partial<Item>);
    const { error } = await supabase
      .from('items')
      .update({ status: 'seen', seen_at: new Date().toISOString() })
      .eq('id', id);
    if (error) console.error('markSeen failed', error);
  }

  async markUnread(id: string) {
    this.optimisticUpdate(id, { status: 'unseen', seen_at: null } as Partial<Item>);
    const { error } = await supabase
      .from('items')
      .update({ status: 'unseen', seen_at: null })
      .eq('id', id);
    if (error) console.error('markUnread failed', error);
  }

  async togglePin(id: string, newPinState: boolean) {
    this.optimisticUpdate(id, { is_pinned: newPinState });
    const { error } = await supabase
      .from('items')
      .update({ is_pinned: newPinState })
      .eq('id', id);
    if (error) console.error('togglePin failed', error);
  }

  async updateExpire(id: string, expiresAt: string | null) {
    this.optimisticUpdate(id, { expires_at: expiresAt });
    const { error } = await supabase
      .from('items')
      .update({ expires_at: expiresAt })
      .eq('id', id);
    if (error) console.error('updateExpire failed', error);
  }

  async setSnooze(id: string, snoozeUntil: string | null) {
    this.optimisticUpdate(id, { snooze_until: snoozeUntil });
    const { error } = await supabase
      .from('items')
      .update({ snooze_until: snoozeUntil })
      .eq('id', id);
    if (error) console.error('snooze failed', error);
  }

  async remove(id: string) {
    if (this.filter() === 'deleted') {
      this.optimisticRemove(id);
      const { error } = await supabase.from('items').delete().eq('id', id);
      if (error) console.error('remove permanently failed', error);
    } else {
      const deleteDate = new Date();
      deleteDate.setDate(deleteDate.getDate() + 30);
      const expiresAt = deleteDate.toISOString();
      this.optimisticUpdate(id, { status: 'deleted', expires_at: expiresAt } as Partial<Item>);
      const { error } = await supabase.from('items').update({ status: 'deleted', expires_at: expiresAt }).eq('id', id);
      if (error) console.error('remove failed', error);
    }
  }

  async restore(id: string) {
    this.optimisticUpdate(id, { status: 'seen', expires_at: null } as Partial<Item>);
    const { error } = await supabase.from('items').update({ status: 'seen', expires_at: null }).eq('id', id);
    if (error) console.error('restore failed', error);
  }

  async permanentlyDelete(id: string) {
    this.optimisticRemove(id);
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) console.error('permanentlyDelete failed', error);
  }

  async archive(id: string) {
    this.optimisticUpdate(id, { status: 'archived' } as Partial<Item>);
    const { error } = await supabase.from('items').update({ status: 'archived' }).eq('id', id);
    if (error) console.error('archive failed', error);
  }

  async unarchive(id: string) {
    this.optimisticUpdate(id, { status: 'seen' } as Partial<Item>);
    const { error } = await supabase.from('items').update({ status: 'seen' }).eq('id', id);
    if (error) console.error('unarchive failed', error);
  }

  async updateItemPayload(id: string, newPayload: any) {
    this.optimisticUpdate(id, { payload: newPayload });
    const { error } = await supabase
      .from('items')
      .update({ payload: newPayload })
      .eq('id', id);
    if (error) console.error('updateItemPayload failed', error);
  }

  async setDeadline(id: string, deadline: string | null) {
    const item = this.items().find(i => i.id === id);
    if (!item) return;
    
    const newPayload = { ...item.payload };
    if (deadline) {
      newPayload.deadline = deadline;
    } else {
      delete newPayload.deadline;
    }
    
    await this.updateItemPayload(id, newPayload);
  }

  async setReminder(id: string, type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'once' | 'clear', customDate?: string) {
    const item = this.items().find(i => i.id === id);
    if (!item) return;

    const newPayload = { ...item.payload };

    if (type === 'clear') {
      delete newPayload['reminder'];
    } else {
      let nextDate = new Date();
      if (type === 'once' && customDate) {
        nextDate = new Date(customDate);
      } else {
        if (type === 'daily') nextDate.setDate(nextDate.getDate() + 1);
        else if (type === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        else if (type === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        else if (type === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
      newPayload['reminder'] = {
        type,
        next_at: nextDate.toISOString()
      };
    }

    await this.updateItemPayload(id, newPayload);
  }

  async updateTags(id: string, tags: string[]) {
    const item = this.items().find(i => i.id === id);
    if (!item) return;
    
    const newPayload = { ...item.payload, tags };
    let updateData: any = { payload: newPayload };
    
    const mappedBoardId = this.getBoardIdFromTags(tags);
    if (mappedBoardId && mappedBoardId !== item.board_id) {
      updateData.board_id = mappedBoardId;
    }

    this.optimisticUpdate(id, updateData);
    const { error } = await supabase
      .from('items')
      .update(updateData)
      .eq('id', id);
    if (error) console.error('updateTags failed', error);
  }

  async moveToBoard(id: string, boardId: string | null) {
    this.optimisticUpdate(id, { board_id: boardId });
    const { error } = await supabase
      .from('items')
      .update({ board_id: boardId })
      .eq('id', id);
    if (error) {
      console.error('moveToBoard failed', error);
      this.toastSvc.show('Failed to move item', 'error');
      return;
    }
    this.toastSvc.show(boardId ? 'Item moved to board' : 'Item moved to inbox');
  }

  async moveSelectedToBoard(boardId: string | null) {
    const ids = Array.from(this.selectedItemIds());
    if (ids.length === 0) return;

    // Optimistic: update all selected items locally
    for (const id of ids) {
      this.optimisticUpdate(id, { board_id: boardId });
    }

    const { error } = await supabase
      .from('items')
      .update({ board_id: boardId })
      .in('id', ids);
    if (error) {
      console.error('moveSelectedToBoard failed', error);
      this.toastSvc.show('Failed to move items', 'error');
      return;
    }
    this.toastSvc.show(boardId ? `${ids.length} items moved to board` : `${ids.length} items moved to inbox`);
    this.clearSelection();
  }

  async markAllAsRead() {
    // Get all unseen items
    const unseenIds = this.items()
      .filter((i) => i.status === 'unseen')
      .map((i) => i.id);

    if (unseenIds.length === 0) return;

    // Optimistic: mark all unseen items as seen locally
    const seenAt = new Date().toISOString();
    for (const id of unseenIds) {
      this.optimisticUpdate(id, { status: 'seen', seen_at: seenAt } as Partial<Item>);
    }

    // Supabase update for multiple items
    const { error } = await supabase
      .from('items')
      .update({ status: 'seen', seen_at: seenAt })
      .in('id', unseenIds);

    if (error) {
      console.error('markAllAsRead failed', error);
    }
  }

  async deleteSelected() {
    const ids = Array.from(this.selectedItemIds());
    if (ids.length === 0) return;
    
    if (this.filter() === 'deleted') {
      // Optimistic: remove permanently
      for (const id of ids) this.optimisticRemove(id);
      const { error } = await supabase.from('items').delete().in('id', ids);
      if (error) console.error('deleteSelected permanently failed', error);
    } else {
      const deleteDate = new Date();
      deleteDate.setDate(deleteDate.getDate() + 30);
      const expiresAt = deleteDate.toISOString();
      // Optimistic: mark as deleted
      for (const id of ids) this.optimisticUpdate(id, { status: 'deleted', expires_at: expiresAt } as Partial<Item>);
      const { error } = await supabase.from('items').update({ status: 'deleted', expires_at: expiresAt }).in('id', ids);
      if (error) console.error('deleteSelected failed', error);
    }
    
    this.clearSelection();
  }

  async restoreSelected() {
    const ids = Array.from(this.selectedItemIds());
    if (ids.length === 0) return;
    
    // Optimistic: restore all
    for (const id of ids) this.optimisticUpdate(id, { status: 'seen', expires_at: null } as Partial<Item>);
    
    const { error } = await supabase.from('items').update({ status: 'seen', expires_at: null }).in('id', ids);
    if (error) console.error('restoreSelected failed', error);
    
    this.clearSelection();
  }

  clearSelection() {
    this.selectedItemIds.set(new Set());
    this.selectionMode.set(false);
  }

  async exportData() {
    // Fetch all items (up to a reasonable limit for now, or handle pagination if needed)
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) {
      console.error('Export failed', error);
      return;
    }

    const dataStr = JSON.stringify(data, null, 2);
    
    if ((window as any).__TAURI_INTERNALS__) {
      try {
        const filePath = await save({
          defaultPath: `remlays_export_${new Date().toISOString().split('T')[0]}.md`,
          filters: [
            { name: 'Markdown', extensions: ['md'] },
            { name: 'JSON', extensions: ['json'] },
            { name: 'CSV', extensions: ['csv'] }
          ]
        });
        
        if (filePath) {
          let outputData = dataStr;
          
          if (filePath.endsWith('.csv')) {
            const header = 'ID,Type,Created At,Content,URL,Tags\n';
            const rows = data.map(item => {
              const content = ((item.payload as any)?.note || (item.payload as any)?.title || '').replace(/"/g, '""');
              const url = ((item.payload as any)?.url || '').replace(/"/g, '""');
              const tags = ((item.payload as any)?.tags || []).join('; ');
              return `"${item.id}","${item.type}","${item.created_at}","${content}","${url}","${tags}"`;
            }).join('\n');
            outputData = header + rows;
          } else if (filePath.endsWith('.md')) {
            outputData = '# Rem-Lays Export\n\n' + data.map(item => {
              const content = (item.payload as any)?.note || (item.payload as any)?.title || '';
              const url = (item.payload as any)?.url || '';
              const tags = ((item.payload as any)?.tags || []).map((t: string) => `#${t}`).join(' ');
              return `### ${item.type.toUpperCase()} - ${new Date(item.created_at).toLocaleString()}\n${content}\n${url ? `[Link](${url})\n` : ''}${tags ? `\nTags: ${tags}\n` : ''}`;
            }).join('\n---\n\n');
          }

          await writeTextFile(filePath, outputData);
          this.toastSvc.show('Data successfully exported!');
        }
      } catch (err: any) {
        console.error('Tauri save failed', err);
        const errMsg = err?.message || err || 'Unknown error';
        this.toastSvc.show('Error: ' + errMsg, 'error');
      }
    } else {
      // Fallback for non-Tauri browser environments
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `remlays_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.toastSvc.show('Data download started');
    }
  }

  // ─── Sharing ─────────────────────────────────────────────────────
  // Per-item public sharing via a UUID token.  The `anon` RLS policy
  // on the items table lets anyone SELECT rows that have a non-null
  // share_token, so no auth is needed to read a shared item.

  /**
   * Generate a share_token for an item so it becomes publicly readable.
   * Returns the shareable URL and copies it to the clipboard.
   */
  async shareItem(id: string): Promise<string | null> {
    const token = crypto.randomUUID();
    this.optimisticUpdate(id, { share_token: token });
    const { error } = await supabase
      .from('items')
      .update({ share_token: token })
      .eq('id', id);

    if (error) {
      console.error('shareItem failed', error);
      this.toastSvc.show('Failed to share item', 'error');
      return null;
    }

    const shareUrl = `${environment.publicWebAppUrl}/shared/${token}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      this.toastSvc.show('Share link copied to clipboard!');
    } catch {
      // Clipboard API can fail in non-secure contexts or headless
      this.toastSvc.show('Share link created');
    }

    return shareUrl;
  }

  /**
   * Revoke sharing — sets share_token back to null so the public URL
   * stops working immediately.
   */
  async unshareItem(id: string): Promise<void> {
    this.optimisticUpdate(id, { share_token: null });
    const { error } = await supabase
      .from('items')
      .update({ share_token: null })
      .eq('id', id);

    if (error) {
      console.error('unshareItem failed', error);
      this.toastSvc.show('Failed to stop sharing', 'error');
      return;
    }

    this.toastSvc.show('Sharing stopped');
  }

  /** Copy the existing share URL to the clipboard. */
  copyShareLink(token: string) {
    const url = `${environment.publicWebAppUrl}/shared/${token}`;
    navigator.clipboard.writeText(url).then(
      () => this.toastSvc.show('Share link copied!'),
      () => this.toastSvc.show('Could not copy link', 'error')
    );
  }

  /**
   * Fetch a single item by its share_token — no auth required.
   * Uses the same global supabase client, but the anon RLS policy
   * allows this SELECT as long as share_token IS NOT NULL.
   */
  static async fetchSharedItem(token: string): Promise<Item | null> {
    const { createClient } = await import('@supabase/supabase-js');
    const { environment } = await import('../../environments/environment');
    const anonClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey);

    const { data, error } = await anonClient
      .from('items')
      .select('*')
      .eq('share_token', token)
      .single();

    if (error || !data) return null;
    return data as Item;
  }

  /**
   * Fetch a signed media URL for a shared item (calls the shared-media
   * Edge Function which uses the service-role key internally).
   */
  static async fetchSharedMediaUrl(shareToken: string): Promise<string | null> {
    const { createClient } = await import('@supabase/supabase-js');
    const { environment } = await import('../../environments/environment');
    const anonClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey);

    const { data, error } = await anonClient.functions.invoke('shared-media', {
      body: { shareToken }
    });

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }
}
