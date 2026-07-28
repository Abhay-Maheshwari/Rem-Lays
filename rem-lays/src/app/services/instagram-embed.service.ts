import { Injectable } from '@angular/core';

declare global {
  interface Window {
    // Populated once Instagram's own embed.js has loaded.
    instgrm?: {
      Embeds?: { process: () => void };
    };
  }
}

/**
 * Loads Instagram's embed.js exactly once for the whole app (recommended
 * when a page/feed can show many embeds at once, rather than loading the
 * script per-card), and exposes the reprocess call each reel card needs
 * after inserting its own oEmbed HTML — Instagram's script only turns the
 * placeholder blockquote into the real rendered embed when explicitly
 * told to look again.
 */
@Injectable({ providedIn: 'root' })
export class InstagramEmbedService {
  private scriptLoaded = false;

  ensureScriptLoaded() {
    if (this.scriptLoaded || typeof document === 'undefined') return;
    if (document.querySelector('script[data-rem-lays-instagram-embed]')) {
      this.scriptLoaded = true;
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    script.setAttribute('data-rem-lays-instagram-embed', 'true');
    document.head.appendChild(script);
    this.scriptLoaded = true;
  }

  reprocessEmbeds() {
    window.instgrm?.Embeds?.process();
  }
}
