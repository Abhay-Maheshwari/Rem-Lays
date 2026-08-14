import { Component, EventEmitter, Input, OnInit, Output, signal, computed, HostListener } from '@angular/core';
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
  @Input() activeView: string = 'feed';
  @Output() navigated = new EventEmitter<void>();
  @Output() openDigest = new EventEmitter<void>();
  @Output() openHome = new EventEmitter<void>();

  isCollapsed = signal(false);

  reviewCollapsed = signal(true);
  boardsCollapsed = signal(true);
  tagsCollapsed = signal(true);
  devicesCollapsed = signal(true);

  editingDeviceId: string | null = null;
  editDeviceName: string = '';

  // Tag logic moved to feed component for unified search

  showCreateBoardModal = false;
  newBoardName = '';

  showManageMembersModal = false;
  activeManageBoardId: string | null = null;
  
  openShareDropdownBoard = signal<any | null>(null);
  shareDropdownPos = signal<{x: number, y: number} | null>(null);

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

  setAllItemsFilter() {
    this.itemsSvc.activeBoardId.set('*');
    this.itemsSvc.filter.set('all');
    this.navigated.emit();
  }

  // Tag manipulation methods moved to feed component

  setBoard(boardId: string) {
    this.itemsSvc.activeBoardId.set(boardId);
    this.itemsSvc.filter.set('all');
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

  dropItemOnBoard(event: CdkDragDrop<any>, boardId: string) {
    if (event.previousContainer.id === 'feedDropList') {
      const item = event.item.data;
      if (item && item.id) {
        this.itemsSvc.moveToBoard(item.id, boardId);
      }
    }
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

  async deleteDevice(device: any) {
    if (confirm(`Are you sure you want to delete "${device.device_name}"? It will be logged out immediately.`)) {
      await this.devicesSvc.deleteDevice(device.id);
    }
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

  toggleShareDropdown(board: any, event: MouseEvent) {
    event.stopPropagation();
    if (this.openShareDropdownBoard()?.id === board.id) {
      this.closeShareDropdown();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.openShareDropdownBoard.set(board);
    
    // Position slightly left of the right edge of the button, and just below it
    this.shareDropdownPos.set({ x: rect.right, y: rect.bottom + 4 });
  }

  closeShareDropdown() {
    this.openShareDropdownBoard.set(null);
    this.shareDropdownPos.set(null);
  }

  @HostListener('document:click')
  onDocumentClick() {
    if (this.openShareDropdownBoard()) {
      this.closeShareDropdown();
    }
  }
}
