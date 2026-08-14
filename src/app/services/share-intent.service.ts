import { Injectable, signal } from '@angular/core';
import { ItemsService } from './items.service';
import { supabase } from './supabase-client';

interface RemLaysShareEventDetail {
  mimeType: string;
  // Raw text for 'text/plain' shares; a content:// URI string for
  // image/video shares (see MainActivity.kt on the Android side).
  payload: string;
}

interface RemLaysMediaUploadedDetail {
  storageKey: string;
  mimeType: string;
  filename: string;
}

declare global {
  interface Window {
    // Registered by MainActivity.kt via webView.addJavascriptInterface().
    // Only exists inside the real Android build — undefined everywhere
    // else, including desktop and plain browser testing.
    AndroidBridge?: {
      uploadSharedMedia(uriString: string, mimeType: string, accessToken: string): void;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class ShareIntentService {
  private listening = false;
  pendingShare = signal<RemLaysShareEventDetail | null>(null);

  constructor(private itemsSvc: ItemsService) {}

  /**
   * Call once, after sign-in (see AppComponent). Three events wired up
   * here: the original share handoff, and two new ones for the native
   * media upload round trip — Kotlin dispatches 'rem-lays-media-uploaded'
   * on success or 'rem-lays-media-upload-failed' on failure, after doing
   * the actual byte upload itself (see MainActivity.kt) rather than
   * routing file bytes through JS.
   */
  startListening() {
    if (this.listening || typeof window === 'undefined') return;
    this.listening = true;

    window.addEventListener('rem-lays-share', (ev: Event) => {
      const detail = (ev as CustomEvent<RemLaysShareEventDetail>).detail;
      if (detail) this.handleShare(detail);
    });

    window.addEventListener('rem-lays-media-uploaded', (ev: Event) => {
      const detail = (ev as CustomEvent<RemLaysMediaUploadedDetail>).detail;
      if (detail) {
        this.itemsSvc.addMediaFromStorageKey(detail.storageKey, detail.mimeType, detail.filename);
      }
    });

    window.addEventListener('rem-lays-media-upload-failed', (ev: Event) => {
      const detail = (ev as CustomEvent<{ message: string }>).detail;
      console.error('Android media upload failed', detail?.message);
      // Surface it as a visible item rather than a silently swallowed
      // failure — the person shared something and deserves to know it
      // didn't land, not just have it vanish.
      this.itemsSvc.addText(`A shared photo/video failed to upload: ${detail?.message ?? 'unknown error'}`);
    });
  }

  private async handleShare(detail: RemLaysShareEventDetail) {
    const { mimeType, payload } = detail;

    if (mimeType === 'text/plain') {
      // Intercept and prompt the user instead of saving immediately
      this.pendingShare.set(detail);
      return;
    }

    if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
      if (!window.AndroidBridge) {
        console.error('AndroidBridge not available — is this actually running in the Android build?');
        return;
      }
      // Kotlin needs this to call presign-upload itself — everything
      // after that (reading bytes, the actual upload) happens natively,
      // no file bytes cross the JS/Kotlin boundary.
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        console.error('No access token available for native media upload');
        return;
      }
      window.AndroidBridge.uploadSharedMedia(payload, mimeType, accessToken);
      return;
    }

    console.warn('ShareIntentService: unhandled mimeType', mimeType);
  }
}
