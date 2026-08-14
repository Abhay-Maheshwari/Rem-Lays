import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutostartService } from '../../services/autostart.service';
import { AuthService } from '../../services/auth.service';
import { ItemsService } from '../../services/items.service';
import { ThemeService, Theme } from '../../services/theme.service';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../../services/platform';
import { UpdateService } from '../../services/update.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss'
})
export class SettingsPageComponent implements OnInit {
  @Output() closeSettings = new EventEmitter<void>();
  
  activeTab: 'account' | 'appearance' | 'system' | 'data' = 'account';
  
  // States
  isAutostartEnabled = false;
  isCompactMode = false;
  isMinimizeToTray = true;
  displayName = '';
  isEditingName = false;
  currentVersion = '';
  
  presets = [
    { id: 'default', name: 'Default', style: 'var(--bg-main)' },
    { id: 'blue', name: 'Blue', style: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, var(--bg-main) 100%)' },
    { id: 'purple', name: 'Purple', style: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, var(--bg-main) 100%)' },
    { id: 'emerald', name: 'Emerald', style: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, var(--bg-main) 100%)' },
    { id: 'rose', name: 'Rose', style: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, var(--bg-main) 100%)' }
  ];
  currentBgId = 'default';

  constructor(
    private autostartSvc: AutostartService,
    public auth: AuthService,
    public itemsSvc: ItemsService,
    public themeSvc: ThemeService,
    public updateSvc: UpdateService
  ) {}

  async ngOnInit() {
    this.isAutostartEnabled = await this.autostartSvc.isEnabled();
    this.displayName = this.auth.session()?.user?.user_metadata?.['display_name'] || '';
    this.currentVersion = await this.updateSvc.getCurrentVersion();
    
    const savedCompact = localStorage.getItem('remlays_compact_mode');
    this.isCompactMode = savedCompact === 'true';

    const savedBg = localStorage.getItem('dashboard_bg');
    if (savedBg) {
      this.currentBgId = savedBg;
    }

    if (isTauri()) {
        const savedTray = localStorage.getItem('remlays_minimize_to_tray');
        if (savedTray !== null) {
            this.isMinimizeToTray = savedTray === 'true';
        } else {
            this.isMinimizeToTray = true;
        }

        try {
            await invoke('set_close_to_tray', { enabled: this.isMinimizeToTray });
        } catch(e) {
            console.warn('set_close_to_tray not implemented yet');
        }
    }
  }

  async toggleAutostart() {
    this.isAutostartEnabled = !this.isAutostartEnabled;
    await this.autostartSvc.toggle(this.isAutostartEnabled);
  }

  setTheme(theme: Theme) {
    this.themeSvc.setTheme(theme);
  }

  setDashboardBg(bgId: string) {
    this.currentBgId = bgId;
    localStorage.setItem('dashboard_bg', bgId);
  }

  toggleCompactMode() {
    this.isCompactMode = !this.isCompactMode;
    localStorage.setItem('remlays_compact_mode', String(this.isCompactMode));
    if (this.isCompactMode) {
      document.body.classList.add('compact-mode');
    } else {
      document.body.classList.remove('compact-mode');
    }
  }

  async toggleMinimizeToTray() {
    if (!isTauri()) return;
    this.isMinimizeToTray = !this.isMinimizeToTray;
    localStorage.setItem('remlays_minimize_to_tray', String(this.isMinimizeToTray));
    try {
        await invoke('set_close_to_tray', { enabled: this.isMinimizeToTray });
    } catch(e) {
        console.error('Failed to toggle tray', e);
    }
  }
  
  async saveDisplayName() {
    this.isEditingName = false;
    const name = this.displayName.trim();
    if (!name) return;
    try {
        await this.auth.updateUserMetadata({ display_name: name });
    } catch (e) {
        // Fallback if not added to auth service yet
        if((this.auth as any).supabase) {
            await (this.auth as any).supabase.auth.updateUser({
                data: { display_name: name }
            });
        }
    }
  }

  clearLocalCache() {
    if(confirm('Are you sure you want to clear local cache? You will need to re-login.')) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    }
  }
}
