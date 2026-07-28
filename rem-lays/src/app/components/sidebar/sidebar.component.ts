import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ItemsService, FeedFilter } from '../../services/items.service';
import { DevicesService } from '../../services/devices.service';
import { AuthService } from '../../services/auth.service';
import { PresenceService } from '../../services/presence.service';
import { FcmTokenService } from '../../services/fcm-token.service';
import { isAndroid } from '../../services/platform';

import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {
  // Drives the mobile off-canvas drawer — irrelevant/inert on desktop
  // widths, see the @media block in this component's own stylesheet.
  @Input() open = false;
  @Output() navigated = new EventEmitter<void>();

  editingDeviceId: string | null = null;
  editDeviceName: string = '';

  constructor(
    public itemsSvc: ItemsService,
    public devicesSvc: DevicesService,
    public auth: AuthService,
    public presenceSvc: PresenceService,
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
    this.itemsSvc.filter.set(f);
    // On mobile, picking a filter is also "I'm done with the drawer" —
    // on desktop this just emits into nothing, AppComponent's own
    // sidebarOpen state doesn't matter there since the CSS ignores it
    // above the breakpoint.
    this.navigated.emit();
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
}
