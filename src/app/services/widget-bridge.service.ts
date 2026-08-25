import { Injectable } from '@angular/core';
import { isAndroid, isTauri } from './platform';

/**
 * Bridge between the Angular app and native Android home screen widgets.
 *
 * After each data refresh, this service serialises the unseen items into
 * the compact WidgetItem format and pushes them to the native side via
 * the AndroidBridge JS interface. The native Kotlin code then writes to
 * SharedPreferences so the Glance widgets can read the data.
 *
 * On non-Android platforms this service is a no-op.
 */
@Injectable({ providedIn: 'root' })
export class WidgetBridgeService {

  private get bridge(): any {
    return (window as any).AndroidBridge;
  }

  private get isAvailable(): boolean {
    return isTauri() && isAndroid() && !!this.bridge;
  }

  /**
   * Push the latest unseen items to the widget data layer.
   * Call this after every `itemsSvc.refresh()` completes.
   */
  updateWidgetData(items: any[], totalCount: number): void {
    if (!this.isAvailable) return;

    try {
      const unseenItems = items
        .filter(i => i.status === 'unseen')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(i => ({
          id: i.id,
          type: i.type,
          title: this.extractTitle(i),
          createdAt: new Date(i.created_at).getTime(),
          status: i.status,
          deadlineAt: i.payload?.deadline
            ? new Date(i.payload.deadline).getTime()
            : null
        }));

      const unseenCount = items.filter(i => i.status === 'unseen').length;

      this.bridge.writeWidgetData(
        JSON.stringify(unseenItems),
        unseenCount,
        totalCount
      );
    } catch (err) {
      console.error('[WidgetBridge] updateWidgetData failed:', err);
    }
  }

  /**
   * Push the user's auth token so the WorkManager sync worker can
   * authenticate against Supabase independently.
   */
  updateAuthToken(accessToken: string): void {
    if (!this.isAvailable) return;

    try {
      this.bridge.writeAuthToken(accessToken);
    } catch (err) {
      console.error('[WidgetBridge] updateAuthToken failed:', err);
    }
  }

  private extractTitle(item: any): string {
    if (typeof item.payload?.title === 'string' && item.payload.title) {
      return item.payload.title;
    }
    if (typeof item.payload?.url === 'string' && item.payload.url) {
      return item.payload.url;
    }
    if (typeof item.payload?.note === 'string' && item.payload.note) {
      return item.payload.note.substring(0, 60) + (item.payload.note.length > 60 ? '…' : '');
    }
    return item.type ?? 'Item';
  }
}
