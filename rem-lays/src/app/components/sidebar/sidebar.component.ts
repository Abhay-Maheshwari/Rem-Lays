import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ItemsService, FeedFilter } from '../../services/items.service';
import { DevicesService } from '../../services/devices.service';
import { AuthService } from '../../services/auth.service';
import { PresenceService } from '../../services/presence.service';
import { FcmTokenService } from '../../services/fcm-token.service';
import { BoardsService } from '../../services/boards.service';
import { ThemeService } from '../../services/theme.service';
import { isAndroid } from '../../services/platform';

import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ManageMembersModalComponent } from '../manage-members-modal/manage-members-modal.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, ManageMembersModalComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
  host: {
    '[class.collapsed]': 'isCollapsed()'
  }
})
export class SidebarComponent implements OnInit {
  // Drives the mobile off-canvas drawer — irrelevant/inert on desktop
  // widths, see the @media block in this component's own stylesheet.
  @Input() open = false;
  @Output() navigated = new EventEmitter<void>();
  @Output() openDigest = new EventEmitter<void>();

  isCollapsed = signal(false);

  reviewCollapsed = signal(true);
  inboxCollapsed = signal(true);
  boardsCollapsed = signal(true);
  tagsCollapsed = signal(true);
  devicesCollapsed = signal(true);

  editingDeviceId: string | null = null;
  editDeviceName: string = '';

  showCreateBoardModal = false;
  newBoardName = '';

  showManageMembersModal = false;
  activeManageBoardId: string | null = null;

  constructor(
    public itemsSvc: ItemsService,
    public devicesSvc: DevicesService,
    public auth: AuthService,
    public presenceSvc: PresenceService,
    public boardsSvc: BoardsService,
    public themeSvc: ThemeService,
    private fcmTokenSvc: FcmTokenService
  ) {}

  async ngOnInit() {
    await this.devicesSvc.refresh();

    // Auto-register on load — idempotent, so this never creates a
    // duplicate row even across many app launches.
    const deviceType = isAndroid() ? 'phone' : 'desktop';
    const deviceName = isAndroid() ? 'Android phone (dev build)' : 'This device (dev build)';
    const deviceId = await this.devicesSvc.ensureThisDeviceRegistered(deviceName, deviceType);

    const userId = this.auth.session()?.user?.id;
    if (deviceId && userId) {
      this.presenceSvc.connect(userId, deviceId, deviceName);
      // Register FCM token on Android — no-op on desktop (FcmTokenService
      // checks isTauri() and gracefully handles the missing plugin).
      this.fcmTokenSvc.registerToken(deviceId);
    }
  }

  setFilter(f: FeedFilter) {
    this.itemsSvc.activeBoardId.set(null);
    this.itemsSvc.filter.set(f);
    this.navigated.emit();
  }

  setBoard(boardId: string) {
    this.itemsSvc.activeBoardId.set(boardId);
    // Keep the current filter (e.g. 'all' or 'media') but scope it to the board
    this.navigated.emit();
  }

  openCreateBoard() {
    this.newBoardName = '';
    this.showCreateBoardModal = true;
  }

  closeCreateBoard() {
    this.showCreateBoardModal = false;
  }

  toggleCollapse() {
    this.isCollapsed.update(v => !v);
  }

  dropBoard(event: CdkDragDrop<string[]>) {
    const currentBoards = [...this.boardsSvc.boards()];
    moveItemInArray(currentBoards, event.previousIndex, event.currentIndex);
    const newOrder = currentBoards.map(b => b.id);
    this.boardsSvc.reorderBoards(newOrder);
  }

  async confirmCreateBoard() {
    const name = this.newBoardName.trim();
    if (name) {
      this.showCreateBoardModal = false;
      await this.boardsSvc.createBoard(name);
    }
  }

  startEditDevice(device: any) {
    this.editingDeviceId = device.id;
    this.editDeviceName = device.device_name;
  }

  cancelEditDevice() {
    this.editingDeviceId = null;
  }

  async saveEditDevice(device: any) {
    if (this.editDeviceName.trim() && this.editDeviceName !== device.device_name) {
      await this.devicesSvc.renameDevice(device.id, this.editDeviceName.trim());
    }
    this.editingDeviceId = null;
  }

  openManageMembers(boardId: string) {
    this.activeManageBoardId = boardId;
    this.showManageMembersModal = true;
  }

  closeManageMembers() {
    this.showManageMembersModal = false;
    this.activeManageBoardId = null;
  }

  @Output() openSettingsPage = new EventEmitter<void>();

  openSettings() {
    this.openSettingsPage.emit();
  }
}
