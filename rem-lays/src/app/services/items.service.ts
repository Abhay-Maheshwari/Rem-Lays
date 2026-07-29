import { Injectable, computed, signal } from '@angular/core';
import { supabase } from './supabase-client';
import { Item, ItemType } from '../models/item.model';
import { OfflineQueueService } from './offline-queue.service';
import { DevicesService } from './devices.service';
import { ToastService } from './toast.service';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { NativeNotificationService } from './native-notification.service';

export type FeedFilter = 'all' | 'unseen' | 'link' | 'media' | 'archived' | 'snoozed';

@Injectable({ providedIn: 'root' })
export class ItemsService {
  items = signal<Item[]>([]);
  filter = signal<FeedFilter>('all');
  searchQuery = signal('');
  selectedTag = signal<string | null>(null);

  currentTime = signal<number>(Date.now());
  private snoozeCheckInterval: any;
  private lastSnoozeCheck = Date.now();

  constructor(
    private offlineQueue: OfflineQueueService, 
    private devicesService: DevicesService,
    private toastSvc: ToastService,
    private notificationSvc: NativeNotificationService
  ) {
    this.snoozeCheckInterval = setInterval(() => {
      this.checkSnoozes();
    }, 60000);
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

  allTags = computed(() => {
    const tags = new Set<string>();
    for (const item of this.items()) {
      if (item.payload['tags'] && Array.isArray(item.payload['tags'])) {
        for (const tag of item.payload['tags']) {
          tags.add(tag);
        }
      }
    }
    return Array.from(tags).sort();
  });

  // Derived views — same pattern as DevicesService's plain signal, just
  // with a computed() layered on top since the feed needs filtering.
  filteredItems = computed(() => {
    let all = this.items();
    const nowStr = new Date(this.currentTime()).toISOString();
    
    // Filter out expired and archived items locally, unless viewing archive
    if (this.filter() === 'archived') {
      all = all.filter(i => i.status === 'archived');
    } else if (this.filter() === 'snoozed') {
      all = all.filter(i => i.snooze_until && i.snooze_until > nowStr && i.status !== 'archived');
    } else {
      all = all.filter(i => 
        (!i.expires_at || i.expires_at > nowStr) && 
        i.status !== 'archived' &&
        (!i.snooze_until || i.snooze_until <= nowStr)
      );
    }
    
    const tag = this.selectedTag();
    if (tag) {
      all = all.filter(i => {
        const itemTags = i.payload['tags'];
        return Array.isArray(itemTags) && itemTags.includes(tag);
      });
    }

    const query = this.searchQuery().trim().toLowerCase();
    if (query) {
      all = all.filter(i => {
        const payloadStr = JSON.stringify(i.payload).toLowerCase();
        return payloadStr.includes(query);
      });
    }

    let result = all;
    switch (this.filter()) {
      case 'unseen':
        result = all.filter((i) => i.status === 'unseen');
        break;
      case 'link':
        result = all.filter((i) => i.type === 'link');
        break;
      case 'media':
        result = all.filter((i) => i.type === 'image' || i.type === 'video' || i.type === 'reel');
        break;
    }

    // Stable sort: Pinned first, then by date (newest first), then by ID
    return result.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;

      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return diff !== 0 ? diff : b.id.localeCompare(a.id);
    });
  });

  unseenCount = computed(() => {
    const now = new Date().toISOString();
    return this.items().filter((i) => i.status === 'unseen' && (!i.expires_at || i.expires_at > now)).length;
  });

  async refresh() {
    const now = new Date().toISOString();

    // Background cleanup of expired items (fire and forget)
    supabase.from('items').delete().lt('expires_at', now).then();

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .neq('status', 'deleted')
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('items refresh failed', error);
      return;
    }
    this.items.set((data ?? []) as Item[]);
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

    const { error } = await supabase.from('items').insert({
      user_id: userData.user.id,
      source_device_id: this.devicesService.currentDeviceId,
      type: 'text' as ItemType,
      payload: { note: trimmed, tags }
    });

    if (error) {
      console.error('addText failed, queuing for retry', error);
      this.offlineQueue.enqueue({ kind: 'text', note: trimmed, tags, queuedAt: new Date().toISOString() });
      return;
    }
    await this.refresh();
  }

  async addLink(rawUrl: string, tags?: string[]) {
    if (!navigator.onLine) {
      this.offlineQueue.enqueue({ kind: 'link', url: rawUrl, tags, queuedAt: new Date().toISOString() });
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
        this.offlineQueue.enqueue({ kind: 'link', url: rawUrl, tags, queuedAt: new Date().toISOString() });
      } else {
        await this.refresh();
        this.toastSvc.show('Link already exists! Timestamp updated.');
      }
      return;
    }

    const { data: inserted, error } = await supabase
      .from('items')
      .insert({
        user_id: userData.user.id,
        source_device_id: this.devicesService.currentDeviceId,
        type,
        payload: { url: rawUrl, domain, tags }
      })
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

  private async enrichLink(itemId: string, url: string, fallbackDomain: string) {
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

  private async enrichReel(itemId: string, url: string) {
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
        await this.addLink(op.url, op.tags);
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
    const { error: insertError } = await supabase.from('items').insert({
      user_id: userData.user.id,
      source_device_id: this.devicesService.currentDeviceId,
      type,
      payload: { filename: file.name, tags },
      storage_key: storageKey
    });
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
    const { error } = await supabase.from('items').insert({
      user_id: userData.user.id,
      source_device_id: this.devicesService.currentDeviceId,
      type,
      payload: { filename, tags },
      storage_key: storageKey
    });
    if (error) console.error('addMediaFromStorageKey insert failed', error);
    await this.refresh();
  }

  /** Signed, time-limited download URL — the bucket is private, so this
   * is how ItemCardComponent actually renders an image/video, not a
   * public URL. */
  async getSignedDownloadUrl(storageKey: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from('media').createSignedUrl(storageKey, 3600);
    if (error || !data) {
      console.error('getSignedDownloadUrl failed', error);
      return null;
    }
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
    const { error } = await supabase
      .from('items')
      .update({ status: 'seen', seen_at: new Date().toISOString() })
      .eq('id', id);
    if (error) console.error('markSeen failed', error);
    await this.refresh();
  }

  async markUnread(id: string) {
    const { error } = await supabase
      .from('items')
      .update({ status: 'unseen', seen_at: null })
      .eq('id', id);
    if (error) console.error('markUnread failed', error);
    await this.refresh();
  }

  async togglePin(id: string, newPinState: boolean) {
    const { error } = await supabase
      .from('items')
      .update({ is_pinned: newPinState })
      .eq('id', id);
    if (error) console.error('togglePin failed', error);
    await this.refresh();
  }

  async updateExpire(id: string, expiresAt: string | null) {
    const { error } = await supabase
      .from('items')
      .update({ expires_at: expiresAt })
      .eq('id', id);
    if (error) console.error('updateExpire failed', error);
    await this.refresh();
  }

  async setSnooze(id: string, snoozeUntil: string | null) {
    const { error } = await supabase
      .from('items')
      .update({ snooze_until: snoozeUntil })
      .eq('id', id);
    if (error) console.error('snooze failed', error);
    await this.refresh();
  }

  async remove(id: string) {
    const { error } = await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
    if (error) console.error('remove failed', error);
    await this.refresh();
  }

  async archive(id: string) {
    const { error } = await supabase.from('items').update({ status: 'archived' }).eq('id', id);
    if (error) console.error('archive failed', error);
    await this.refresh();
  }

  async updateItemPayload(id: string, newPayload: any) {
    const { error } = await supabase
      .from('items')
      .update({ payload: newPayload })
      .eq('id', id);
    if (error) console.error('updateItemPayload failed', error);
    await this.refresh();
  }

  async updateTags(id: string, tags: string[]) {
    const item = this.items().find(i => i.id === id);
    if (!item) return;
    
    const newPayload = { ...item.payload, tags };
    await this.updateItemPayload(id, newPayload);
  }

  async markAllAsRead() {
    // Get all unseen items
    const unseenIds = this.items()
      .filter((i) => i.status === 'unseen')
      .map((i) => i.id);

    if (unseenIds.length === 0) return;

    // Supabase update for multiple items
    const { error } = await supabase
      .from('items')
      .update({ status: 'seen', seen_at: new Date().toISOString() })
      .in('id', unseenIds);

    if (error) {
      console.error('markAllAsRead failed', error);
      return;
    }
    await this.refresh();
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
}
