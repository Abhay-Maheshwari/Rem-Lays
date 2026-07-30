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
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { FeedComponent } from './components/feed/feed.component';
import { QuickActionBarComponent } from './components/quick-action-bar/quick-action-bar.component';
import { ItemViewerComponent } from './components/item-viewer/item-viewer.component';
import { DeviceNicknameModalComponent } from './components/device-nickname-modal/device-nickname-modal.component';
import { ContextMenuComponent } from './components/context-menu/context-menu.component';
import { WeeklyDigestComponent } from './components/weekly-digest/weekly-digest.component';
import { SharedItemViewerComponent } from './components/shared-item-viewer/shared-item-viewer.component';
import { getCurrentWindow } from '@tauri-apps/api/window';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SidebarComponent, FeedComponent, QuickActionBarComponent, ItemViewerComponent, DeviceNicknameModalComponent, ContextMenuComponent, WeeklyDigestComponent, SharedItemViewerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  isDesktop = !!(window as any).__TAURI_INTERNALS__ && !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // URL-based routing for shared item public pages
  sharedToken = signal<string | null>(this.parseSharedToken());
  inviteToken = signal<string | null>(this.parseInviteToken());

  private parseSharedToken(): string | null {
    const path = window.location.pathname;
    const match = path.match(/^\/shared\/([0-9a-f-]{36})$/i);
    return match ? match[1] : null;
  }

  private parseInviteToken(): string | null {
    const path = window.location.pathname;
    const match = path.match(/^\/invite\/([0-9a-f-]{36})$/i);
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
    private shareIntentSvc: ShareIntentService,
    private itemsSvc: ItemsService,
    private offlineQueue: OfflineQueueService,
    public toastSvc: ToastService,
    private boardsSvc: BoardsService
  ) {
    // Flush whatever's queued the moment connectivity actually returns —
    // not gated on sign-in state below, since 'online' can fire at any
    // time relative to that.
    this.offlineQueue.onReconnect(() => this.itemsSvc.flushOfflineQueue());

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
        this.boardsSvc.refresh();
        this.autostartSvc.ensureEnabled();
        this.notificationSvc.init();
        this.shareIntentSvc.startListening();
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
      }
    }, { allowSignalWrites: true });
    // Needed because PresenceService.disconnect() writes a signal
    // (onlineDeviceIds) synchronously — Angular blocks that by default
    // to prevent effects from looping on their own writes. Safe here:
    // this effect only reads auth.session(), never onlineDeviceIds, so
    // there's no cycle to create.
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
}
