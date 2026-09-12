import { Injectable } from '@angular/core';
import { isAndroid, isTauri } from './platform';

export interface WallpaperStatus {
  enabled: boolean;
  permissionGranted: boolean;
  activeNow: boolean;
  target: 'home' | 'lock' | 'both';
  layout: string;
  daysToShow: number;
  showLocation: boolean;
  showAllDay: boolean;
  position: 'top' | 'center' | 'bottom';
  scrimOpacity: number;
  activeStart: string;
  activeEnd: string;
  activeDays: number[];
  calendars: number[];
}

export interface CalendarAccount {
  id: number;
  displayName: string;
  accountName: string;
  color: number;
  visible: boolean;
}

export interface WallpaperConfig {
  target?: 'home' | 'lock' | 'both';
  layout?: string;
  daysToShow?: number;
  showLocation?: boolean;
  showAllDay?: boolean;
  position?: 'top' | 'center' | 'bottom';
  scrimOpacity?: number;
  activeStart?: string;
  activeEnd?: string;
  activeDays?: number[];
  calendars?: number[];
}

/**
 * Bridge between the Angular settings UI and native Android calendar
 * wallpaper functionality via the AndroidBridge JS interface.
 *
 * On non-Android platforms this service is a no-op.
 */
@Injectable({ providedIn: 'root' })
export class WallpaperBridgeService {

  private get bridge(): any {
    return (window as any).AndroidBridge;
  }

  get isAvailable(): boolean {
    return isTauri() && isAndroid() && !!this.bridge;
  }

  /**
   * Enable the calendar wallpaper feature.
   * Triggers READ_CALENDAR permission request if not already granted.
   * Listen for 'rem-lays-calendar-permission' CustomEvent for the result.
   */
  enable(): void {
    if (!this.isAvailable) return;
    try {
      this.bridge.enableCalendarWallpaper();
    } catch (err) {
      console.error('[WallpaperBridge] enable failed:', err);
    }
  }

  /**
   * Disable the calendar wallpaper feature and restore original wallpaper.
   */
  disable(): void {
    if (!this.isAvailable) return;
    try {
      this.bridge.disableCalendarWallpaper();
    } catch (err) {
      console.error('[WallpaperBridge] disable failed:', err);
    }
  }

  /**
   * Update wallpaper configuration. Only include the keys you want to change.
   * Automatically triggers re-render if the feature is active.
   */
  setConfig(config: WallpaperConfig): void {
    if (!this.isAvailable) return;
    try {
      this.bridge.setWallpaperConfig(JSON.stringify(config));
    } catch (err) {
      console.error('[WallpaperBridge] setConfig failed:', err);
    }
  }

  /**
   * Get the current wallpaper feature status and all configuration.
   */
  getStatus(): WallpaperStatus | null {
    if (!this.isAvailable) return null;
    try {
      const json = this.bridge.getWallpaperStatus();
      return JSON.parse(json) as WallpaperStatus;
    } catch (err) {
      console.error('[WallpaperBridge] getStatus failed:', err);
      return null;
    }
  }

  /**
   * Get all calendar accounts on the device for the account picker.
   */
  getCalendarAccounts(): CalendarAccount[] {
    if (!this.isAvailable) return [];
    try {
      const json = this.bridge.getCalendarAccounts();
      return JSON.parse(json) as CalendarAccount[];
    } catch (err) {
      console.error('[WallpaperBridge] getCalendarAccounts failed:', err);
      return [];
    }
  }

  /**
   * Generate a preview image of the calendar wallpaper.
   * Returns a base64-encoded PNG string, or empty string on failure.
   */
  getPreview(): string {
    if (!this.isAvailable) return '';
    try {
      return this.bridge.getWallpaperPreview();
    } catch (err) {
      console.error('[WallpaperBridge] getPreview failed:', err);
      return '';
    }
  }

  /**
   * Manually trigger a wallpaper refresh right now.
   */
  refreshNow(): void {
    if (!this.isAvailable) return;
    try {
      this.bridge.refreshWallpaperNow();
    } catch (err) {
      console.error('[WallpaperBridge] refreshNow failed:', err);
    }
  }
}
