import { Injectable, signal } from '@angular/core';
import { isTauri, isAndroid } from './platform';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class UpdateService {
  updateAvailable = signal(false);
  updateVersion = signal<string | null>(null);
  updateBody = signal<string | null>(null);
  isChecking = signal(false);
  isDownloading = signal(false);
  downloadProgress = signal(0);

  constructor(private toastSvc: ToastService) {}

  /**
   * Check for updates on startup (desktop only) with a 5s delay
   * to not block the initial load. No-op on mobile/web.
   */
  async checkOnStartup() {
    if (!isTauri() || isAndroid()) return;
    
    // Delay so we don't compete with initial data load
    setTimeout(() => this.checkForUpdates(true), 5000);
  }

  /**
   * Check if an update is available. Silent mode doesn't show
   * "you're up to date" toasts — only used on startup.
   */
  async checkForUpdates(silent = false) {
    if (!isTauri() || isAndroid()) {
      if (!silent) this.toastSvc.show('Updates are only available on desktop', 'error');
      return;
    }
    
    this.isChecking.set(true);
    
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      
      if (update) {
        this.updateAvailable.set(true);
        this.updateVersion.set(update.version);
        this.updateBody.set(update.body || null);
        if (!silent) {
          this.toastSvc.show(`Update v${update.version} available!`);
        }
      } else {
        this.updateAvailable.set(false);
        if (!silent) {
          this.toastSvc.show('You\'re on the latest version!');
        }
      }
    } catch (err: any) {
      console.error('Update check failed', err);
      if (!silent) {
        const msg = String(err).toLowerCase();
        if (msg.includes('404') || msg.includes('not supported') || msg.includes('development') || msg.includes('not found') || msg.includes('signature')) {
          this.toastSvc.show('You\'re on the latest version!');
        } else {
          this.toastSvc.show('Failed to check for updates', 'error');
        }
      }
    } finally {
      this.isChecking.set(false);
    }
  }

  /**
   * Download and install an available update, then relaunch the app.
   */
  async downloadAndInstall() {
    if (!isTauri() || isAndroid()) return;
    
    this.isDownloading.set(true);
    this.downloadProgress.set(0);
    
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      
      const update = await check();
      if (!update) {
        this.toastSvc.show('No update available');
        this.isDownloading.set(false);
        return;
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event: any) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            console.log(`[Update] Download started, size: ${contentLength}`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              this.downloadProgress.set(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            console.log('[Update] Download finished');
            this.downloadProgress.set(100);
            break;
        }
      });

      this.toastSvc.show('Update installed! Restarting...');
      
      // Small delay so the user sees the toast
      setTimeout(async () => {
        await relaunch();
      }, 1500);
    } catch (err) {
      console.error('Update download/install failed', err);
      this.toastSvc.show('Update failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
    } finally {
      this.isDownloading.set(false);
    }
  }

  /** Get current app version from Tauri config */
  async getCurrentVersion(): Promise<string> {
    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      return await getVersion();
    } catch {
      return '1.4.0'; // Fallback
    }
  }
}
