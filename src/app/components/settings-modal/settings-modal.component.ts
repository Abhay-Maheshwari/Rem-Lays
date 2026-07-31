import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AutostartService } from '../../services/autostart.service';
import { AuthService } from '../../services/auth.service';
import { ItemsService } from '../../services/items.service';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings-modal.component.html',
  styleUrl: './settings-modal.component.scss'
})
export class SettingsModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  
  isAutostartEnabled = false;

  constructor(
    private autostartSvc: AutostartService,
    public auth: AuthService,
    public itemsSvc: ItemsService
  ) {}

  async ngOnInit() {
    this.isAutostartEnabled = await this.autostartSvc.isEnabled();
  }

  async toggleAutostart() {
    this.isAutostartEnabled = !this.isAutostartEnabled;
    await this.autostartSvc.toggle(this.isAutostartEnabled);
  }
}
