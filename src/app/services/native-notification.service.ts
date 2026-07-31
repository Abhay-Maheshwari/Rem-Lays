import { Injectable } from '@angular/core';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>);
}

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

@Injectable({ providedIn: 'root' })
export class NativeNotificationService {
  private windowFocused = true;
  private initialized = false;

  async init() {
    if (!isTauri() || this.initialized) return;
    this.initialized = true;

    try {
      if (isMobile()) {
        const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
        let granted = await isPermissionGranted();
        if (!granted) {
          await requestPermission();
        }
      }

      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      this.windowFocused = await win.isFocused();
      await win.listen('tauri://focus', () => (this.windowFocused = true));
      await win.listen('tauri://blur', () => (this.windowFocused = false));
    } catch (err) {
      console.error('NativeNotificationService.init failed', err);
    }
  }

  /**
   * Only fires an OS toast if the window is actually backgrounded — when
   * it's focused, RealtimeService's "just arrived" highlight already
   * covers it, and a toast on top of that would just be noise.
   */
  async notifyIfBackgrounded(title: string, body: string, type: string = 'file') {
    if (!isTauri() || this.windowFocused) return;
    
    try {
      if (isMobile()) {
        const { sendNotification, isPermissionGranted, createChannel } = await import('@tauri-apps/plugin-notification');
        const granted = await isPermissionGranted();
        if (granted) {
          try {
            await createChannel({
              id: 'rem-lays-high-priority',
              name: 'Incoming Items',
              description: 'Notifications for new items received',
              lights: true,
              lightColor: '#10b981',
              vibration: true,
              importance: 4, // High importance for heads-up banner
              visibility: 1  // Public visibility on lockscreen
            });
          } catch (e) {
            console.warn('Channel creation failed or already exists', e);
          }

          sendNotification({
            title,
            body,
            channelId: 'rem-lays-high-priority',
            sound: 'default',
            iconColor: '#10b981'
          });
        }
      } else {
        const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        
        const label = 'notification-' + Date.now();
        
        const url = window.location.origin + `/assets/notification.html?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&type=${encodeURIComponent(type)}`;
        
        const webview = new WebviewWindow(label, {
          url: url,
          width: 320,
          height: 360,
          decorations: false,
          transparent: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          focus: false,
          resizable: false,
          x: window.screen.availWidth - 320 - 24,
          y: window.screen.availHeight - 360 - 24
        });

        webview.once('tauri://error', function (e) {
          console.error('Error creating notification window', e);
          alert('Tauri Webview Error: ' + JSON.stringify(e));
        });
      }
    } catch (err) {
      console.error('notifyIfBackgrounded failed', err);
    }
  }
}
