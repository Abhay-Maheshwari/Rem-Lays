import { Component, effect, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth.service';
import { RealtimeService } from './services/realtime.service';
import { PresenceService } from './services/presence.service';
import { AutostartService } from './services/autostart.service';
import { NativeNotificationService } from './services/native-notification.service';
import { ShareIntentService } from './services/share-intent.service';
import { ItemsService } from './services/items.service';
import { OfflineQueueService } from './services/offline-queue.service';
import { ToastService } from './services/toast.service';
import { BoardsService } from './services/boards.service';
import { UpdateService } from './services/update.service';
import { LocalDbService } from './services/local-db.service';
import { CacheService } from './services/cache.service';
import { WidgetBridgeService } from './services/widget-bridge.service';
import { ItemViewerService } from './services/item-viewer.service';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { FeedComponent } from './components/feed/feed.component';
import { QuickActionBarComponent } from './components/quick-action-bar/quick-action-bar.component';
import { ItemViewerComponent } from './components/item-viewer/item-viewer.component';
import { DeviceNicknameModalComponent } from './components/device-nickname-modal/device-nickname-modal.component';
import { ContextMenuComponent } from './components/context-menu/context-menu.component';
import { WeeklyDigestComponent } from './components/weekly-digest/weekly-digest.component';
import { SharedItemViewerComponent } from './components/shared-item-viewer/shared-item-viewer.component';
import { SettingsPageComponent } from './components/settings-page/settings-page.component';
import { TagInputComponent } from './components/tag-input/tag-input.component';
import { HomeComponent } from './components/home/home.component';
import { CalendarComponent } from './components/calendar/calendar.component';
import { getCurrentWindow } from '@tauri-apps/api/window';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SidebarComponent, FeedComponent, QuickActionBarComponent, ItemViewerComponent, DeviceNicknameModalComponent, ContextMenuComponent, WeeklyDigestComponent, SharedItemViewerComponent, SettingsPageComponent, TagInputComponent, HomeComponent, CalendarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  isDesktop = !!(window as any).__TAURI_INTERNALS__ && !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // URL-based routing for shared item public pages
  sharedToken = signal<string | null>(this.parseSharedToken());
  inviteToken = signal<string | null>(this.parseInviteToken());
  activeView = signal<'home' | 'feed' | 'settings' | 'calendar'>((localStorage.getItem('activeView') as any) || 'home');

  private parseSharedToken(): string | null {
    const path = window.location.pathname;
    const match = path.match(/^\/shared\/([^\/]+)\/?$/i);
    return match ? match[1] : null;
  }

  private parseInviteToken(): string | null {
    const path = window.location.pathname;
    const match = path.match(/^\/invite\/([^\/]+)\/?$/i);
    return match ? match[1] : null;
  }

  minimize() {
    if (this.isDesktop) getCurrentWindow().minimize();
  }

  maximize() {
    if (this.isDesktop) getCurrentWindow().toggleMaximize();
  }

  close() {
    if (this.isDesktop) getCurrentWindow().close();
  }

  constructor(
    public auth: AuthService,
    private realtimeSvc: RealtimeService,
    private presenceSvc: PresenceService,
    private autostartSvc: AutostartService,
    private notificationSvc: NativeNotificationService,
    public shareIntentSvc: ShareIntentService,
    private itemsSvc: ItemsService,
    private offlineQueue: OfflineQueueService,
    public toastSvc: ToastService,
    private boardsSvc: BoardsService,
    private updateSvc: UpdateService,
    private localDb: LocalDbService,
    private cacheSvc: CacheService,
    private widgetBridge: WidgetBridgeService,
    private viewerSvc: ItemViewerService
  ) {
    // Flush whatever's queued the moment connectivity actually returns —
    // not gated on sign-in state below, since 'online' can fire at any
    // time relative to that.
    this.offlineQueue.onReconnect(() => this.itemsSvc.flushOfflineQueue());

    // Listen for quick replies from notifications
    this.notificationSvc.quickReply$.subscribe((replyText) => {
       if (replyText && replyText.trim()) {
          this.itemsSvc.addText(replyText.trim());
          this.toastSvc.show('Reply sent', 'success');
          
          // Android dismisses the ongoing notification when a RemoteInput action is triggered.
          // We must re-issue the notification to keep it pinned.
          if (localStorage.getItem('remlays_pinned_quick_note') === 'true') {
             this.notificationSvc.showPinnedQuickNote();
          }
       }
    });

    // Items realtime only needs the user id, so it can connect the moment
    // a session exists. Presence needs this device's own row id too — that
    // depends on registration finishing first, so SidebarComponent (which
    // already owns that sequencing) is the one that calls
    // presenceSvc.connect(). Autostart/notifications are no-ops outside
    // an actual Tauri window; ShareIntentService's listener is harmless
    // to register anywhere, since the event it waits for only ever fires
    // from the Android native side.
    effect(() => {
      const session = this.auth.session();
      if (session?.user?.id) {
        this.realtimeSvc.connect(session.user.id);
        this.itemsSvc.refresh().then(() => {
          this.widgetBridge.updateWidgetData(this.itemsSvc.items(), this.itemsSvc.items().length);
        });
        this.boardsSvc.refresh();
        this.autostartSvc.ensureEnabled();
        this.notificationSvc.init();
        this.shareIntentSvc.startListening();
        this.updateSvc.checkOnStartup();

        // Push auth token to widget data bridge for WorkManager sync
        if (session.access_token) {
          this.widgetBridge.updateAuthToken(session.access_token);
        }
        // Also catch up here, not just on 'online' — covers the case
        // where the app was fully closed while something sat queued and
        // connectivity already came back before this launch.
        this.itemsSvc.flushOfflineQueue();

        // Handle invite tokens if present
        const invite = this.inviteToken();
        if (invite) {
          this.inviteToken.set(null); // Clear to avoid looping
          window.history.replaceState({}, document.title, '/');
          this.boardsSvc.joinBoard(invite).then(boardId => {
             if (boardId) {
                this.itemsSvc.activeBoardId.set(boardId);
             }
          });
        }
      } else {
        this.realtimeSvc.disconnect();
        this.presenceSvc.disconnect();
        // Clear all caches on sign-out to prevent stale data
        this.localDb.clearAll();
        this.cacheSvc.clear();
      }
    }, { allowSignalWrites: true });

    // Foreground reconciliation — full sync when app comes back
    // to the front, catching any changes missed while backgrounded.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.auth.session()?.user) {
          this.itemsSvc.refresh().then(() => {
            this.widgetBridge.updateWidgetData(this.itemsSvc.items(), this.itemsSvc.items().length);
          });
          this.boardsSvc.refresh();
        }
      });

      // Listen for deep-link actions dispatched by native Android widgets
      window.addEventListener('rem-lays-widget-action', ((event: CustomEvent) => {
        const { target, itemId } = event.detail || {};
        switch (target) {
          case 'quick_note':
            this.activeView.set('feed');
            setTimeout(() => {
              const actionInput = document.querySelector('.action-input') as HTMLInputElement | null;
              actionInput?.focus();
            }, 300);
            break;
          case 'feed':
            this.activeView.set('feed');
            break;
          case 'camera_capture':
            this.activeView.set('feed');
            // A small delay to let the feed render, then trigger file picker
            setTimeout(() => {
              const fileInput = document.querySelector('.media-upload-input') as HTMLInputElement | null;
              fileInput?.click();
            }, 500);
            break;
          case 'paste_link':
            this.activeView.set('feed');
            // Read clipboard and auto-add if it's a URL
            if (navigator.clipboard?.readText) {
              navigator.clipboard.readText().then(text => {
                const trimmed = text?.trim();
                if (trimmed && /^https?:\/\//i.test(trimmed)) {
                  this.itemsSvc.addLink(trimmed);
                  this.toastSvc.show('Link saved from clipboard', 'success');
                } else {
                  this.toastSvc.show('No URL found in clipboard', 'error');
                }
              }).catch(() => {
                this.toastSvc.show('Could not read clipboard', 'error');
              });
            }
            break;
          case 'item':
            if (itemId) {
              this.activeView.set('feed');
              const item = this.itemsSvc.items().find(i => i.id === itemId);
              if (item) {
                this.viewerSvc.open(item);
              }
            }
            break;
        }
      }) as EventListener);
    }
    
    // Persist active view across reloads
    effect(() => {
      localStorage.setItem('activeView', this.activeView());
    });
    
    // Apply initial body classes for settings
    if (typeof document !== 'undefined') {
      const savedCompact = localStorage.getItem('remlays_compact_mode');
      if (savedCompact === 'true') {
        document.body.classList.add('compact-mode');
      }
    }
  }

  // Mobile off-canvas drawer state — inert on desktop widths, where the
  // sidebar's own CSS ignores the .open class entirely above the breakpoint.
  sidebarOpen = signal(false);
  
  showShortcuts = signal(false);
  showWeeklyDigest = signal(false);

  toggleSidebar() {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar() {
    this.sidebarOpen.set(false);
  }

  async signIn() {
    await this.auth.signInWithGoogle();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    // Don't intercept if user is already typing in an input/textarea
    // unless it's the Escape key to blur.
    const activeEl = document.activeElement;
    const isInputActive = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.hasAttribute('contenteditable');

    if (event.key === 'Escape') {
      if (this.showShortcuts()) {
        this.showShortcuts.set(false);
        return;
      }
      if (isInputActive) {
        (activeEl as HTMLElement).blur();
      }
      return;
    }

    if (isInputActive) {
      return;
    }

    // '?' -> Toggle shortcuts modal
    if (event.key === '?' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.showShortcuts.update(v => !v);
      return;
    }

    // Ctrl/Cmd + K or '/' -> Focus Search
    if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !event.ctrlKey && !event.metaKey)) {
      event.preventDefault();
      const searchInput = document.querySelector('.search-input') as HTMLInputElement | null;
      searchInput?.focus();
      return;
    }

    // Ctrl/Cmd + N or 'c' -> Focus New Note (Quick Action Bar)
    if ((event.key === 'n' && (event.metaKey || event.ctrlKey)) || (event.key === 'c' && !event.ctrlKey && !event.metaKey)) {
      event.preventDefault();
      const actionInput = document.querySelector('.action-input') as HTMLInputElement | null;
      actionInput?.focus();
      return;
    }
  }

  @HostListener('document:contextmenu', ['$event'])
  onDocumentContextMenu(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // Allow default context menu only on text inputs for copy/paste
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
      event.preventDefault();
    }
  }

  pendingShareNote = signal('');
  pendingShareTags = signal<string[]>([]);

  cancelPendingShare() {
    this.shareIntentSvc.pendingShare.set(null);
    this.pendingShareNote.set('');
    this.pendingShareTags.set([]);
  }

  confirmPendingShare() {
    const detail = this.shareIntentSvc.pendingShare();
    if (!detail) return;
    
    this.shareIntentSvc.pendingShare.set(null);
    const { mimeType, payload } = detail;
    const trimmed = payload.trim();
    
    const noteTrimmed = this.pendingShareNote().trim();
    const finalNote = noteTrimmed ? noteTrimmed : undefined;
    const tags = this.pendingShareTags();
    
    // Clear inputs
    this.pendingShareNote.set('');
    this.pendingShareTags.set([]);
    
    if (/^https?:\/\//i.test(trimmed)) {
      this.itemsSvc.addLink(trimmed, tags.length > 0 ? tags : undefined, finalNote);
    } else {
      const fullText = finalNote ? `${finalNote}\n\n${trimmed}` : trimmed;
      this.itemsSvc.addText(fullText, tags.length > 0 ? tags : undefined);
    }
  }
}
