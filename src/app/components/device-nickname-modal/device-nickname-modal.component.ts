import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DevicesService } from '../../services/devices.service';

@Component({
  selector: 'app-device-nickname-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './device-nickname-modal.component.html',
  styleUrl: './device-nickname-modal.component.scss'
})
export class DeviceNicknameModalComponent {
  deviceName = '';
  
  constructor(public devicesSvc: DevicesService) {
    effect(() => {
      if (this.devicesSvc.needsNickname()) {
        const id = this.devicesSvc.currentDeviceId;
        const device = this.devicesSvc.devices().find(d => d.id === id);
        if (device) {
          this.deviceName = device.device_name;
        }
      }
    });
  }

  async save() {
    if (!this.deviceName.trim()) return;
    const id = this.devicesSvc.currentDeviceId;
    if (id) {
      await this.devicesSvc.renameDevice(id, this.deviceName.trim());
    }
    this.devicesSvc.needsNickname.set(false);
  }

  skip() {
    this.devicesSvc.needsNickname.set(false);
  }
}
