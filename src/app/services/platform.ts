/**
 * True when running inside an actual Tauri window (desktop or Android),
 * false in a plain browser tab (e.g. `ng serve` during development).
 * Shared by every service that wraps a Tauri-only plugin, so those
 * plugins' JS bindings don't get invoked (and error) outside Tauri.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in (window as unknown as Record<string, unknown>);
}

export function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
}
