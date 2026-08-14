import { Injectable } from '@angular/core';

const DB_NAME = 'rem-lays-cache';
const DB_VERSION = 1;

/** Store names — also used as keys for metadata timestamps. */
export type StoreName = 'items' | 'boards' | 'devices' | 'signed_urls' | 'metadata';

interface SignedUrlEntry {
  storageKey: string;
  signedUrl: string;
  expiresAt: number; // epoch ms
}

interface MetadataEntry {
  key: string;
  value: any;
}

/**
 * Thin IndexedDB wrapper for offline-first persistence.
 * No npm dependencies — raw browser API only.
 *
 * Design choices:
 * - One database, multiple object stores.
 * - All operations are async and return Promises.
 * - putAll() uses a single transaction for batch writes.
 * - Schema upgrades happen in the onupgradeneeded handler.
 */
@Injectable({ providedIn: 'root' })
export class LocalDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('items')) {
          db.createObjectStore('items', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('boards')) {
          db.createObjectStore('boards', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('devices')) {
          db.createObjectStore('devices', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('signed_urls')) {
          db.createObjectStore('signed_urls', { keyPath: 'storageKey' });
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error('IndexedDB open failed', request.error);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // ─── Generic CRUD ──────────────────────────────────────────────────

  async getAll<T>(store: StoreName): Promise<T[]> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async get<T>(store: StoreName, key: string): Promise<T | null> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve((req.result as T) ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async put<T>(store: StoreName, value: T): Promise<void> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(value);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Silently fail — cache miss is better than a crash
    }
  }

  /**
   * Replace the entire store contents with a new array.
   * Uses a single transaction: clear + putAll for consistency.
   */
  async replaceAll<T>(store: StoreName, values: T[]): Promise<void> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const os = tx.objectStore(store);
        os.clear();
        for (const v of values) {
          os.put(v);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Silently fail
    }
  }

  async delete(store: StoreName, key: string): Promise<void> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Silently fail
    }
  }

  // ─── Signed URL helpers ────────────────────────────────────────────

  async getSignedUrl(storageKey: string): Promise<string | null> {
    const entry = await this.get<SignedUrlEntry>('signed_urls', storageKey);
    if (!entry) return null;
    // Expired? Clean up and return null.
    if (Date.now() > entry.expiresAt) {
      await this.delete('signed_urls', storageKey);
      return null;
    }
    return entry.signedUrl;
  }

  async putSignedUrl(storageKey: string, signedUrl: string, ttlMs: number): Promise<void> {
    const entry: SignedUrlEntry = {
      storageKey,
      signedUrl,
      expiresAt: Date.now() + ttlMs,
    };
    await this.put('signed_urls', entry);
  }

  // ─── Metadata helpers ─────────────────────────────────────────────

  async getMeta(key: string): Promise<any> {
    const entry = await this.get<MetadataEntry>('metadata', key);
    return entry?.value ?? null;
  }

  async setMeta(key: string, value: any): Promise<void> {
    await this.put<MetadataEntry>('metadata', { key, value });
  }

  // ─── Nuclear option ────────────────────────────────────────────────

  /** Wipe everything — used on sign-out. */
  async clearAll(): Promise<void> {
    try {
      const db = await this.openDb();
      const stores: StoreName[] = ['items', 'boards', 'devices', 'signed_urls', 'metadata'];
      return new Promise((resolve, reject) => {
        const tx = db.transaction(stores, 'readwrite');
        for (const s of stores) {
          tx.objectStore(s).clear();
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // If DB isn't open yet, there's nothing to clear
    }
  }
}
