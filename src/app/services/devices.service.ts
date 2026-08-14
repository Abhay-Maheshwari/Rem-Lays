import { Injectable, signal } from '@angular/core';
import { supabase } from './supabase-client';
import { Device } from '../models/device.model';
import { LocalDbService } from './local-db.service';

const DEVICE_ID_KEY = 'rem-lays:device-id';

@Injectable({ providedIn: 'root' })
export class DevicesService {
  devices = signal<Device[]>([]);
  needsNickname = signal<boolean>(false);
  private localDeviceId: string | null = localStorage.getItem(DEVICE_ID_KEY);

  private registrationPromise: Promise<string | null> | null = null;

  constructor(private localDb: LocalDbService) {
    this.loadFromCache();
  }

  private async loadFromCache() {
    const cached = await this.localDb.getAll<Device>('devices');
    if (cached.length > 0 && this.devices().length === 0) {
      this.devices.set(cached);
    }
  }

  get currentDeviceId(): string | null {
    return this.localDeviceId;
  }

  async getValidDeviceId(): Promise<string | null> {
    if (this.localDeviceId) return this.localDeviceId;
    if (this.registrationPromise) return this.registrationPromise;
    
    // Fallback if accessed before SidebarComponent initializes it (e.g. fast share intent)
    const { isAndroid } = await import('./platform');
    const deviceType = isAndroid() ? 'phone' : 'desktop';
    const deviceName = isAndroid() ? 'Android phone (dev build)' : 'This device (dev build)';
    return this.ensureThisDeviceRegistered(deviceName, deviceType);
  }

  /**
   * Idempotent by design: safe to call on every app launch (which is
   * exactly how SidebarComponent uses it now) without creating duplicate
   * rows. The fix for the "registered 5 times" bug is entirely here —
   * it's not "insert on click" anymore, it's "insert once per install,
   * then just touch last_seen_at."
   *
   * Note: a plain browser tab and the Tauri desktop window are separate
   * webview contexts with their own localStorage, so each will register
   * itself once, as its own device — that split is intentional, not a
   * leftover of the bug.
   */
  async ensureThisDeviceRegistered(
    name: string,
    type: Device['device_type']
  ): Promise<string | null> {
    if (this.registrationPromise) return this.registrationPromise;

    this.registrationPromise = (async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    if (this.localDeviceId) {
      const { data: existing } = await supabase
        .from('devices')
        .select('id, revoked_at')
        .eq('id', this.localDeviceId)
        .maybeSingle();

      if (existing && !existing.revoked_at) {
        await supabase
          .from('devices')
          .update({
            last_seen_at: new Date().toISOString(),
            device_type: type
          })
          .eq('id', existing.id);
        await this.refresh();
        return existing.id;
      }
      // Stored id points at a row that's gone or revoked — fall through
      // and register fresh, same as a brand-new install.
    }

    const { data: inserted, error } = await supabase
      .from('devices')
      .insert({ user_id: userData.user.id, device_name: name, device_type: type })
      .select('id')
      .single();

    if (error || !inserted) {
      console.error('ensureThisDeviceRegistered failed', error);
      return null;
    }

    this.localDeviceId = inserted.id;
    localStorage.setItem(DEVICE_ID_KEY, inserted.id);
    await this.refresh();
    
    // Trigger the nickname prompt on fresh registration
    this.needsNickname.set(true);
    
    return inserted.id;
    })();

    return this.registrationPromise;
  }

  async refresh() {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('devices refresh failed', error);
      return;
    }
    this.devices.set((data ?? []) as Device[]);
    this.localDb.replaceAll('devices', (data ?? []) as Device[]);
  }

  async renameDevice(id: string, newName: string) {
    const { error } = await supabase
      .from('devices')
      .update({ device_name: newName })
      .eq('id', id);
      
    if (error) {
      console.error('renameDevice failed', error);
      return;
    }
    
    await this.refresh();
  }

  async deleteDevice(id: string) {
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('deleteDevice failed', error);
      return;
    }

    await this.refresh();
  }
}
