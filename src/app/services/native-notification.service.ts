import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { listen } from '@tauri-apps/api/event';

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
  
  public quickReply$ = new Subject<string>();

  async init() {
    if (!isTauri() || this.initialized) return;
    this.initialized = true;


    try {
      if (isMobile()) {
        const { isPermissionGranted, requestPermission, createChannel, registerActionTypes, onAction } = await import('@tauri-apps/plugin-notification');
        let granted = await isPermissionGranted();
        if (!granted) {
          const result = await requestPermission();
          granted = result === 'granted';
        }

        // Create the notification channel eagerly so it exists before
        // any FCM push arrives. Android silently drops notifications
        // targeting a channel that doesn't exist yet.
        if (granted) {
          try {
            await createChannel({
              id: 'rem-lays-high-priority',
              name: 'Incoming Items',
              description: 'Notifications for new items received',
              lights: true,
              lightColor: '#10b981',
              vibration: true,
              importance: 4,
              visibility: 1
            });
            console.log('[Notification] Channel "rem-lays-high-priority" created on init');
          } catch (e) {
            // Channel already exists — that's fine
            console.log('[Notification] Channel already exists or creation skipped');
          }

          try {
            await registerActionTypes([{
              id: '0',
              actions: [{
                id: 'reply_action',
                title: 'Add Note',
                input: true,
                inputButtonTitle: 'Save',
                inputPlaceholder: 'Type a quick note...'
              }]
            }]);
            await onAction((notification: any) => {
              if (notification.inputValue) {
                this.quickReply$.next(notification.inputValue);
              }
            });
          } catch(e) {
            console.error('[Notification] Failed to register quick reply action', e);
          }

          if (localStorage.getItem('remlays_pinned_quick_note') === 'true') {
            setTimeout(() => {
              this.showPinnedQuickNote();
            }, 500);
          }
        }
      }

      // Listen for quick reply from desktop notification webview
      listen<string>('quick-reply', (event) => {
        if (event.payload) {
          this.quickReply$.next(event.payload);
        }
      });

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
  async notifyIfBackgrounded(title: string, body: string, type: string = 'file', imageUrl?: string) {
    if (!isTauri() || this.windowFocused) return;
    
    try {
      if (isMobile()) {
        const { sendNotification, isPermissionGranted } = await import('@tauri-apps/plugin-notification');
        const granted = await isPermissionGranted();
        if (granted) {
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
        
        let url = window.location.origin + `/assets/notification.html?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&type=${encodeURIComponent(type)}`;
        if (imageUrl) {
          url += `&imageUrl=${encodeURIComponent(imageUrl)}`;
        }
        
        const isImageMode = type === 'image' && !!imageUrl;
        const winWidth = isImageMode ? 420 : 380;
        const winHeight = isImageMode ? 380 : 120;

        const webview = new WebviewWindow(label, {
          url: url,
          title: 'Rem-Lays Notification',
          width: winWidth,
          height: winHeight,
          decorations: false,
          transparent: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          visible: true,
          focus: false,
          resizable: false,
          x: window.screen.availWidth - winWidth - 24,
          y: window.screen.availHeight - winHeight - 24
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

  async showPinnedQuickNote() {
    if (!isMobile()) return;
    try {
      const { sendNotification } = await import('@tauri-apps/plugin-notification');
      sendNotification({
        id: 9999,
        title: 'Rem-Lays Quick Note',
        body: 'Tap to add a quick note directly to your inbox',
        largeBody: 'Tap to add a quick note directly to your inbox',
        summary: 'Add Note',
        channelId: 'rem-lays-high-priority',
        sound: 'default',
        iconColor: '#10b981',
        ongoing: true,
        actionTypeId: '0'
      });
    } catch (err) {
      console.error('Failed to show pinned quick note', err);
    }
  }

  async hidePinnedQuickNote() {
    if (!isMobile()) return;
    try {
      const { cancel } = await import('@tauri-apps/plugin-notification');
      await cancel([9999]);
    } catch (err) {
      console.error('Failed to hide pinned quick note', err);
    }
  }
}
