import { Injectable, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase-client';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { openUrl } from '@tauri-apps/plugin-opener';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Signal instead of an Observable-only approach — simplest thing that
  // works for a small app; swap for a proper store if this grows.
  session = signal<Session | null>(null);
  isInitializing = signal(true);

  constructor() {
    supabase.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      this.isInitializing.set(false);
    });
    supabase.auth.onAuthStateChange((_event, session) => this.session.set(session));

    const isTauri = typeof window !== 'undefined' && (
      '__TAURI_INTERNALS__' in window || 
      '__TAURI_IPC__' in window ||
      '__TAURI_INVOKE__' in window ||
      '__TAURI__' in window
    );

    // Mobile specific: Auto-refresh tokens when app comes to foreground.
    // If the device sleeps, Supabase's setTimeout for auto-refresh won't fire.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          console.log('[Auth] App became visible, refreshing session');
          supabase.auth.refreshSession().catch(e => console.error(e));
        }
      });
    }

    if (isTauri) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        getCurrentWindow().listen('tauri://focus', () => {
          console.log('[Auth] Window focused, refreshing session');
          supabase.auth.refreshSession().catch(e => console.error(e));
        });
      });
      import('@tauri-apps/api/event').then(module => {
        module.listen('tauri://resume', () => {
          console.log('[Auth] App resumed, refreshing session');
          supabase.auth.refreshSession().catch(e => console.error(e));
        });
      });
      
      // Handle deep links from OAuth redirects in Tauri apps
      console.log('[Auth] Registering onOpenUrl listener');
      onOpenUrl((urls) => {
        console.log('[Auth] onOpenUrl triggered with urls:', JSON.stringify(urls));
        for (const url of urls) {
          try {
            const parsedUrl = new URL(url);
            console.log('[Auth] Parsed URL search:', parsedUrl.search, 'hash:', parsedUrl.hash);
            
            // Handle Implicit Flow (hash)
            if (url.includes('access_token=')) {
              console.log('[Auth] Found access_token in URL');
              const hash = parsedUrl.hash.substring(1);
              const params = new URLSearchParams(hash);
              const access_token = params.get('access_token');
              const refresh_token = params.get('refresh_token');
              if (access_token && refresh_token) {
                supabase.auth.setSession({ access_token, refresh_token }).then(() => console.log('[Auth] Session set from implicit flow'));
              }
            } 
            // Handle PKCE Flow (query)
            const code = parsedUrl.searchParams.get('code');
            if (code) {
              console.log('[Auth] Found code in deep link, exchanging for session');
              supabase.auth.exchangeCodeForSession(code).catch(err => {
                console.error('[Auth] Error exchanging code for session:', err);
              });
              continue;
            }
          } catch (e) {
            console.error('[Auth] Error parsing deep link URL:', url, e);
          }
        }
      }).catch(err => console.error('[Auth] Error registering onOpenUrl:', err));

      // Also listen to any raw intent events from Tauri core
      import('@tauri-apps/api/event').then(module => {
        module.listen('tauri://intent', (event) => {
          console.log('[Auth] Received tauri://intent event:', JSON.stringify(event));
          if (event.payload && (event.payload as any).data) {
            const url = (event.payload as any).data;
            if (typeof url === 'string') {
              console.log('[Auth] Processing raw intent URL:', url);
              if (url.includes('access_token=')) {
                try {
                  const hash = url.split('#')[1];
                  const params = new URLSearchParams(hash);
                  const access_token = params.get('access_token');
                  const refresh_token = params.get('refresh_token');
                  if (access_token && refresh_token) {
                    supabase.auth.setSession({ access_token, refresh_token })
                      .then(() => console.log('[Auth] Session set from raw intent'));
                  }
                } catch (e) { console.error(e); }
              }
            }
          }
        });
        
        module.listen('deep-link://new-url', (event) => {
          console.log('[Auth] Received raw deep-link://new-url event:', JSON.stringify(event));
        });
      });
      
      if (typeof window !== 'undefined') {
        window.addEventListener('android-deep-link', (e: any) => {
          console.log('[Auth] Received android-deep-link custom event!', e.detail);
          const url = e.detail;
          if (typeof url === 'string' && url.includes('access_token=')) {
            try {
              const hash = url.split('#')[1];
              const params = new URLSearchParams(hash);
              const access_token = params.get('access_token');
              const refresh_token = params.get('refresh_token');
              if (access_token && refresh_token) {
                supabase.auth.setSession({ access_token, refresh_token })
                  .then(() => console.log('[Auth] Session set from custom android-deep-link'));
              }
            } catch (err) { console.error(err); }
          }
        });
      }

      // Also poll for current deep link url
      import('@tauri-apps/plugin-deep-link').then(module => {
        if (module.getCurrent) {
          module.getCurrent().then(urls => {
            console.log('[Auth] getCurrent() returned:', JSON.stringify(urls));
            if (urls && urls.length > 0) {
              urls.forEach(url => {
                if (typeof url === 'string' && url.includes('access_token=')) {
                  try {
                    const hash = url.split('#')[1];
                    const params = new URLSearchParams(hash);
                    const access_token = params.get('access_token');
                    const refresh_token = params.get('refresh_token');
                    if (access_token && refresh_token) {
                      supabase.auth.setSession({ access_token, refresh_token })
                        .then(() => console.log('[Auth] Session set from getCurrent()'));
                    }
                  } catch (e) { console.error(e); }
                }
              });
            }
          }).catch(e => console.error('[Auth] getCurrent() error:', e));
        }
      });
      
    } else {
      console.log('[Auth] Not running in Tauri, skipping onOpenUrl');
    }
  }

  /**
   * Desktop: forces Google to show the account picker every time, via
   * prompt: 'select_account'. Without this, an embedded webview (Tauri's
   * window, same as any WebView2/WKWebView-based app) silently reuses
   * whatever Google session cookie already landed in it — a plain
   * browser tab doesn't have this problem because it's juggling Google's
   * own account-chooser state across your whole browser profile already.
   *
   * Android: replace the body of this method with the native Credential
   * Manager flow (see README "Phase 0, step 4") which returns a Google
   * ID token directly, then call:
   *   supabase.auth.signInWithIdToken({ provider: 'google', token })
   * instead of signInWithOAuth. Left as a TODO here rather than guessed
   * at, since it depends on the Android Google Cloud OAuth client you
   * register yourself.
   */
  async signInWithGoogle() {
    const isTauri = typeof window !== 'undefined' && (
      '__TAURI_INTERNALS__' in window || 
      '__TAURI_IPC__' in window ||
      '__TAURI_INVOKE__' in window ||
      '__TAURI__' in window
    );
    
    const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    const useDeepLink = isTauri && isMobile;

    if (useDeepLink) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'remlays://auth/callback',
          queryParams: { prompt: 'select_account' },
          skipBrowserRedirect: true
        }
      });

      if (data?.url) {
        await openUrl(data.url);
      }
    } else {
      const options: any = {
        queryParams: { prompt: 'select_account' }
      };
      if (typeof window !== 'undefined') {
        options.redirectTo = window.location.origin;
      }
      // Desktop (or pure Web): Use standard embedded WebView / Browser redirect
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options
      });
    }
  }

  async signOut() {
    await supabase.auth.signOut();
    const isTauri = typeof window !== 'undefined' && (
      '__TAURI_INTERNALS__' in window || 
      '__TAURI_IPC__' in window ||
      '__TAURI_INVOKE__' in window ||
      '__TAURI__' in window
    );
    if (!isTauri && typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }

  async updateUserMetadata(data: any) {
    return await supabase.auth.updateUser({ data });
  }
}
