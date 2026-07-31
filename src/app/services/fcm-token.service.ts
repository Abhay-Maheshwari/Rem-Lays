import { Injectable } from '@angular/core';
import { isTauri } from './platform';
import { supabase } from './supabase-client';

@Injectable({ providedIn: 'root' })
export class FcmTokenService {
  private initialized = false;

  /**
   * Call once, after both sign-in AND device registration have resolved
   * a real devices.id — this needs that id to write the token onto.
   * SidebarComponent already owns that exact sequencing for
   * PresenceService, so it's the natural place to call this too.
   * No-op outside Tauri/Android: desktop has no FCM token to register,
   * and this plugin (tauri-plugin-fcm) is mobile-only.
   */
  async registerToken(deviceId: string) {
    if (!isTauri() || this.initialized) return;
    this.initialized = true;

    try {
      const { checkPermissions, requestPermissions, register, getToken, onTokenRefresh } =
        await import('tauri-plugin-fcm');

      let permission = await checkPermissions();
      if (permission === 'prompt' || permission === 'prompt-with-rationale') {
        permission = await requestPermissions();
      }
      if (permission !== 'granted') return;

      await register();
      const { token } = await getToken();
      await this.saveToken(deviceId, token);

      // Tokens rotate periodically — keep the stored one current so
      // push-fcm never sends to a stale token.
      await onTokenRefresh(async (event: { token: string }) => {
        await this.saveToken(deviceId, event.token);
      });
    } catch (err) {
      // Expected on desktop: tauri-plugin-fcm is mobile-only (per its own
      // docs — Android/iOS supported, desktop platforms aren't), so
      // "not found" here just means "this is the desktop build," not a
      // real failure. Desktop doesn't need an FCM token anyway — it
      // already gets notified via the live Realtime socket + focus/blur
      // tracking from Phase 3. Anything else is worth seeing.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('not found')) {
        console.error('FcmTokenService.registerToken failed', err);
      }
    }
  }

  private async saveToken(deviceId: string, token: string) {
    const { error } = await supabase.from('devices').update({ fcm_token: token }).eq('id', deviceId);
    if (error) console.error('Saving FCM token failed', error);
  }
}
