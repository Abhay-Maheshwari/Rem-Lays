import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  toast = signal<{ message: string; show: boolean; type: 'success' | 'error' }>({ message: '', show: false, type: 'success' });
  private timeoutId: any;

  show(message: string, type: 'success' | 'error' = 'success', durationMs: number = 3000) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    
    this.toast.set({ message, show: true, type });
    
    this.timeoutId = setTimeout(() => {
      this.toast.update(t => ({ ...t, show: false }));
    }, durationMs);
  }
}
