import { Injectable, signal } from '@angular/core';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase-client';
import { ItemsService } from './items.service';
import { NativeNotificationService } from './native-notification.service';
import { Item } from '../models/item.model';
import { DevicesService } from './devices.service';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private channel: RealtimeChannel | null = null;
  private currentUserId: string | null = null;

  // Purely UI sugar — drives the brief "just arrived" highlight on
  // ItemCardComponent. Not part of the actual read-state model at all,
  // which still lives entirely in items.status on the server.
  recentlyArrivedIds = signal<Set<string>>(new Set());

  constructor(
    private itemsSvc: ItemsService,
    private notificationSvc: NativeNotificationService,
    private devicesSvc: DevicesService
  ) {}

  connect(userId: string) {
    if (this.channel && this.currentUserId === userId) return;
    this.disconnect();
    this.currentUserId = userId;

    this.channel = supabase
      .channel(`items-changes-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `user_id=eq.${userId}` },
        (payload: RealtimePostgresChangesPayload<Item>) => this.handleChange(payload)
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('items realtime channel', status, '— retrying in 3s');
          if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
          }
          const userId = this.currentUserId;
          if (userId) {
            setTimeout(() => this.connect(userId), 3000);
          }
        }
      });
  }

  disconnect() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.currentUserId = null;
  }

  private handleChange(payload: RealtimePostgresChangesPayload<Item>) {
    const current = this.itemsSvc.items();

    if (payload.eventType === 'INSERT') {
      const newItem = payload.new as Item;
      // This client's own inserts already call ItemsService.refresh()
      // right after writing — the Realtime echo of that same insert can
      // arrive moments later, so skip it if it's already in the list.
      if (current.some((i) => i.id === newItem.id)) return;

      this.itemsSvc.items.set([newItem, ...current]);

      // Don't notify or play sound if this device sent the item
      if (newItem.source_device_id === this.devicesSvc.currentDeviceId) return;

      this.flagAsRecentlyArrived(newItem.id);
      
      let displayTitle = '';
      if (newItem.type === 'text') {
        const v = newItem.payload?.['note'];
        displayTitle = typeof v === 'string' ? v : 'A note was shared';
      } else if (newItem.type === 'link') {
        const v = newItem.payload?.['url'];
        displayTitle = typeof v === 'string' ? v : 'A link was shared';
      } else {
        const v = newItem.payload?.['filename'];
        displayTitle = typeof v === 'string' ? v : `A ${newItem.type} was shared`;
      }

      const device = this.devicesSvc.devices().find(d => d.id === newItem.source_device_id);
      const sourceDeviceName = device ? device.device_name : 'Unknown device';

      this.notificationSvc.notifyIfBackgrounded(
        displayTitle,
        `Sent from ${sourceDeviceName}`,
        newItem.type
      );
      return;
    }

    if (payload.eventType === 'UPDATE') {
      const updated = payload.new as Item;
      if (updated.status === 'deleted') {
        this.itemsSvc.items.set(current.filter((i) => i.id !== updated.id));
      } else {
        this.itemsSvc.items.set(current.map((i) => (i.id === updated.id ? updated : i)));
      }
      return;
    }

    if (payload.eventType === 'DELETE') {
      const oldId = (payload.old as Partial<Item>).id;
      if (oldId) {
        this.itemsSvc.items.set(current.filter((i) => i.id !== oldId));
      }
    }
  }

  private flagAsRecentlyArrived(id: string) {
    const next = new Set(this.recentlyArrivedIds());
    next.add(id);
    this.recentlyArrivedIds.set(next);

    try {
      const audio = new Audio('assets/pop.wav');
      audio.play().catch(e => console.warn('Audio play failed', e));
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (e) {
      console.warn('Playback/vibration error', e);
    }

    setTimeout(() => {
      const after = new Set(this.recentlyArrivedIds());
      after.delete(id);
      this.recentlyArrivedIds.set(after);
    }, 1200);
  }
}
