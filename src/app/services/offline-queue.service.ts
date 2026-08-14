import { Injectable, signal } from '@angular/core';

type QueuedOp =
  | { kind: 'text'; note: string; tags?: string[]; queuedAt: string }
  | { kind: 'link'; url: string; tags?: string[]; note?: string; queuedAt: string };
// Media isn't queued here — a File object can't survive JSON
// serialization into localStorage, and Android's native media upload is
// a separate Kotlin-side path that doesn't go through this queue at all
// (see the design notes on why that gap is left open for now).

const QUEUE_KEY = 'rem-lays:offline-queue';

/**
 * Deliberately simple, JS-only offline queue — not native WorkManager.
 * Covers "I shared something with no signal, don't lose it," flushed on
 * reconnect or next launch. Does NOT guarantee delivery if the app
 * process is fully killed while offline; that would need WorkManager,
 * a bigger native undertaking than this pass is scoped for.
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  pendingCount = signal(0);
  private listenerAttached = false;

  constructor() {
    this.pendingCount.set(this.load().length);
  }

  private load(): QueuedOp[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
    } catch {
      return [];
    }
  }

  private save(queue: QueuedOp[]) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    this.pendingCount.set(queue.length);
  }

  enqueue(op: QueuedOp) {
    const queue = this.load();
    queue.push(op);
    this.save(queue);
  }

  /** Clears the stored queue and returns what was in it — callers replay
   * each entry, and anything that fails again re-enqueues itself
   * naturally through the normal addText/addLink failure path. */
  dequeueAll(): QueuedOp[] {
    const queue = this.load();
    this.save([]);
    return queue;
  }

  onReconnect(callback: () => void) {
    if (this.listenerAttached || typeof window === 'undefined') return;
    this.listenerAttached = true;
    window.addEventListener('online', callback);
  }
}

export type { QueuedOp };
