import { Injectable, computed, signal } from '@angular/core';
import { supabase } from './supabase-client';
import { Item, ItemType } from '../models/item.model';
import { OfflineQueueService } from './offline-queue.service';
import { DevicesService } from './devices.service';

export type FeedFilter = 'all' | 'unseen' | 'link' | 'media';

@Injectable({ providedIn: 'root' })
export class ItemsService {
  items = signal<Item[]>([]);
  filter = signal<FeedFilter>('all');
  searchQuery = signal('');
  selectedTag = signal<string | null>(null);

  constructor(private offlineQueue: OfflineQueueService, private devicesService: DevicesService) {}

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

    switch (this.filter()) {
      case 'unseen':
        return all.filter((i) => i.status === 'unseen');
      case 'link':
        return all.filter((i) => i.type === 'link');
      case 'media':
        return all.filter((i) => i.type === 'image' || i.type === 'video' || i.type === 'reel');
      default:
        return all;
    }
  });



  unseenCount = computed(() => this.items().filter((i) => i.status === 'unseen').length);

  async refresh() {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .neq('status', 'deleted')
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
      if (error || !data) return;
      const result = data as { authorName?: string; html?: string };
      
      const item = this.items().find(i => i.id === itemId);
      const dataPayload = item ? item.payload : {};

      await supabase
        .from('items')
        .update({
          payload: { ...dataPayload, url, authorName: result.authorName, embedHtml: result.html }
        })
        .eq('id', itemId);
    } catch (err) {
      console.error('enrichReel failed', err);
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

  async remove(id: string) {
    const { error } = await supabase.from('items').update({ status: 'deleted' }).eq('id', id);
    if (error) console.error('remove failed', error);
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
}
