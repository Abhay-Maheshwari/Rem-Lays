import { Injectable } from '@angular/core';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>);
}

@Injectable({ providedIn: 'root' })
export class AutostartService {
  /**
   * No-op outside an actual Tauri window (e.g. a plain browser tab during
   * `ng serve`) — the autostart plugin's JS bindings only work inside
   * Tauri's webview, so this guards against noisy console errors there.
   */
  async ensureEnabled() {
    if (!isTauri()) return;
    try {
      const { isEnabled, enable } = await import('@tauri-apps/plugin-autostart');
      if (!(await isEnabled())) {
        await enable();
      }
    } catch (err) {
      // On Android, this plugin isn't registered at all — autostart
      // isn't a meaningful concept there the way it is on desktop, so
      // "not found" is expected, not a real failure. The durable fix is
      // gating the plugin's registration to desktop-only on the Rust
      // side (#[cfg(desktop)]) — pending a look at the current lib.rs,
      // since `tauri android init` restructured main.rs into lib.rs and
      // I haven't seen what that looks like now. This is a stopgap so
      // the console isn't misleadingly noisy in the meantime.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('not found')) {
        console.error('AutostartService.ensureEnabled failed', err);
      }
    }
  }
}
