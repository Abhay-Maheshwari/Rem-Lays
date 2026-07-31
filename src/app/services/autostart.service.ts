import { Injectable } from '@angular/core';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>);
}

@Injectable({ providedIn: 'root' })
export class AutostartService {
  async ensureEnabled() {
    if (!isTauri()) return;
    try {
      const { isEnabled, enable } = await import('@tauri-apps/plugin-autostart');
      if (!(await isEnabled())) {
        await enable();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('not found')) {
        console.error('AutostartService.ensureEnabled failed', err);
      }
    }
  }

  async isEnabled(): Promise<boolean> {
    if (!isTauri()) return false;
    try {
      const { isEnabled } = await import('@tauri-apps/plugin-autostart');
      return await isEnabled();
    } catch (err) {
      return false;
    }
  }

  async toggle(enable: boolean) {
    if (!isTauri()) return;
    try {
      const autostart = await import('@tauri-apps/plugin-autostart');
      if (enable) {
        await autostart.enable();
      } else {
        await autostart.disable();
      }
    } catch (err) {
      console.error('Failed to toggle autostart', err);
    }
  }
}
