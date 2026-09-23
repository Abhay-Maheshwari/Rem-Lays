import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  WallpaperBridgeService,
  WallpaperStatus,
  CalendarAccount,
  WallpaperConfig
} from '../../services/wallpaper-bridge.service';

@Component({
  selector: 'app-calendar-wallpaper-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-wallpaper-settings.component.html',
  styleUrl: './calendar-wallpaper-settings.component.scss'
})
export class CalendarWallpaperSettingsComponent implements OnInit, OnDestroy {
  @Output() goBack = new EventEmitter<void>();

  status: WallpaperStatus | null = null;
  accounts: CalendarAccount[] = [];
  previewSrc = '';
  isLoadingPreview = false;
  hasCustomBackground = false;

  // Local state for editing
  enabled = false;
  target: 'home' | 'lock' | 'both' = 'home';
  layout = 'dark_glass';
  daysToShow = 1;
  showLocation = true;
  showAllDay = true;
  position: 'top' | 'center' | 'bottom' = 'bottom';
  scrimOpacity = 70;
  activeStart = '08:00';
  activeEnd = '20:00';
  activeDays = new Set<number>([1, 2, 3, 4, 5]);
  selectedCalendars = new Set<number>();

  themes = [
    { id: 'dark_glass', name: 'Dark Glass', desc: 'Translucent dark', colors: ['#000000', '#0A84FF'] },
    { id: 'light_frost', name: 'Light Frost', desc: 'Frosted light', colors: ['#FFFFFF', '#007AFF'] },
    { id: 'amoled', name: 'AMOLED', desc: 'Pure black minimal', colors: ['#000000', '#30D158'] },
    { id: 'gradient_accent', name: 'Gradient', desc: 'Vibrant accent', colors: ['#1A1A2E', '#E94560'] },
    { id: 'image_blur', name: 'Image Blur', desc: 'For custom images', colors: ['#000000', '#FFFFFF'] },
    { id: 'gradient_sunset', name: 'Sunset', desc: 'Warm gradient', colors: ['#FF512F', '#DD2476'] },
    { id: 'week_agenda', name: 'Week View', desc: '7-day overview', colors: ['#1A1A2E', '#0A84FF'] }
  ];

  dayLabels = [
    { iso: 1, label: 'Mon' },
    { iso: 2, label: 'Tue' },
    { iso: 3, label: 'Wed' },
    { iso: 4, label: 'Thu' },
    { iso: 5, label: 'Fri' },
    { iso: 6, label: 'Sat' },
    { iso: 7, label: 'Sun' }
  ];

  private permissionListener: ((e: Event) => void) | null = null;

  constructor(public wpBridge: WallpaperBridgeService) {}

  ngOnInit() {
    this.loadStatus();
    this.loadAccounts();

    // Listen for permission result from native side
    this.permissionListener = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.granted) {
        this.enabled = true;
        this.loadStatus();
        this.loadAccounts();
        this.refreshPreview();
      }
    };
    window.addEventListener('rem-lays-calendar-permission', this.permissionListener);

    // Listen for image picked
    window.addEventListener('wallpaper-image-picked', () => {
      this.hasCustomBackground = true;
      this.refreshPreview();
    });
  }

  ngOnDestroy() {
    if (this.permissionListener) {
      window.removeEventListener('rem-lays-calendar-permission', this.permissionListener);
    }
  }

  loadStatus() {
    this.status = this.wpBridge.getStatus();
    if (this.status) {
      this.enabled = this.status.enabled;
      this.target = this.status.target;
      this.layout = this.status.layout;
      this.daysToShow = this.status.daysToShow;
      this.showLocation = this.status.showLocation;
      this.showAllDay = this.status.showAllDay;
      this.position = this.status.position;
      this.scrimOpacity = this.status.scrimOpacity;
      this.activeStart = this.status.activeStart;
      this.activeEnd = this.status.activeEnd;
      this.activeDays = new Set(this.status.activeDays);
      this.selectedCalendars = new Set(this.status.calendars);
      this.hasCustomBackground = this.status.hasCustomBackground || false;
    }
    if (this.enabled) {
      this.refreshPreview();
    }
  }

  loadAccounts() {
    this.accounts = this.wpBridge.getCalendarAccounts();
  }

  toggleEnabled() {
    if (this.enabled) {
      this.wpBridge.disable();
      this.enabled = false;
      this.previewSrc = '';
    } else {
      this.wpBridge.enable();
      // If permission is already granted, enable happens immediately;
      // otherwise the permission dialog is shown and result comes via event
      setTimeout(() => this.loadStatus(), 500);
    }
  }

  pickImage() {
    this.wpBridge.pickBackgroundImage();
  }

  clearImage() {
    this.hasCustomBackground = false;
    this.applyConfig({ backgroundUri: '' });
  }

  setTarget(target: 'home' | 'lock' | 'both') {
    this.target = target;
    this.applyConfig({ target });
  }

  selectTheme(themeId: string) {
    this.layout = themeId;
    this.applyConfig({ layout: themeId });
  }

  setPosition(pos: 'top' | 'center' | 'bottom') {
    this.position = pos;
    this.applyConfig({ position: pos });
  }

  onDaysToShowChange() {
    this.applyConfig({ daysToShow: this.daysToShow });
  }

  onScrimOpacityChange() {
    this.applyConfig({ scrimOpacity: this.scrimOpacity });
  }

  toggleShowLocation() {
    this.showLocation = !this.showLocation;
    this.applyConfig({ showLocation: this.showLocation });
  }

  toggleShowAllDay() {
    this.showAllDay = !this.showAllDay;
    this.applyConfig({ showAllDay: this.showAllDay });
  }

  toggleActiveDay(day: number) {
    if (this.activeDays.has(day)) {
      this.activeDays.delete(day);
    } else {
      this.activeDays.add(day);
    }
    this.applyConfig({ activeDays: Array.from(this.activeDays) });
  }

  onActiveStartChange() {
    this.applyConfig({ activeStart: this.activeStart });
  }

  onActiveEndChange() {
    this.applyConfig({ activeEnd: this.activeEnd });
  }

  toggleCalendar(id: number) {
    if (this.selectedCalendars.has(id)) {
      this.selectedCalendars.delete(id);
    } else {
      this.selectedCalendars.add(id);
    }
    this.applyConfig({ calendars: Array.from(this.selectedCalendars) });
  }

  isCalendarSelected(id: number): boolean {
    // Empty set means "all selected"
    return this.selectedCalendars.size === 0 || this.selectedCalendars.has(id);
  }

  refreshNow() {
    this.wpBridge.refreshNow();
    setTimeout(() => this.refreshPreview(), 1000);
  }

  refreshPreview() {
    if (!this.enabled) return;
    this.isLoadingPreview = true;
    // Use setTimeout to not block the UI — getWallpaperPreview is synchronous
    // on the JS side but the native side does heavy work
    setTimeout(() => {
      const base64 = this.wpBridge.getPreview();
      if (base64) {
        this.previewSrc = `data:image/png;base64,${base64}`;
      }
      this.isLoadingPreview = false;
    }, 100);
  }

  intToHex(color: number): string {
    // Android ARGB int to CSS hex color
    const r = (color >> 16) & 0xFF;
    const g = (color >> 8) & 0xFF;
    const b = color & 0xFF;
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  private applyConfig(partial: WallpaperConfig) {
    this.wpBridge.setConfig(partial);
    // Refresh preview after a short delay to allow native side to regenerate
    setTimeout(() => this.refreshPreview(), 800);
  }
}
