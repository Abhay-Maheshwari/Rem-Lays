import { Injectable, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase-client';

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private channel: RealtimeChannel | null = null;

  // Set of device ids currently holding an open socket on this channel —
  // this is what SidebarComponent's presence dot should actually check,
  // replacing the old "!d.revoked_at" stand-in from Phase 1.
  onlineDeviceIds = signal<Set<string>>(new Set());

  /**
   * One shared presence channel per user, with each device tracking
   * itself under its OWN key (its `devices.id`) rather than the user id —
   * otherwise every device for the same user would overwrite the same
   * presence slot instead of showing up as separate online devices.
   */
  connect(userId: string, deviceId: string, deviceName: string) {
    this.disconnect();

    this.channel = supabase.channel(`presence-${userId}`, {
      config: { presence: { key: deviceId } }
    });

    this.channel
      .on('presence', { event: 'sync' }, () => this.syncFromChannelState())
      .on('presence', { event: 'join' }, () => this.syncFromChannelState())
      .on('presence', { event: 'leave' }, () => this.syncFromChannelState())
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && this.channel) {
          await this.channel.track({ device_name: deviceName, online_at: new Date().toISOString() });
        }
      });
  }

  private syncFromChannelState() {
    if (!this.channel) return;
    const state = this.channel.presenceState();
    // presenceState()'s keys are exactly the per-device keys passed to
    // config.presence.key above — i.e. device ids already.
    this.onlineDeviceIds.set(new Set(Object.keys(state)));
  }

  disconnect() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.onlineDeviceIds.set(new Set());
  }
}
