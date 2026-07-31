import { Injectable, signal } from '@angular/core';

export interface MenuItem {
  label: string;
  icon?: string; // SVG string
  action: (event?: MouseEvent) => void;
  danger?: boolean;
  keepOpen?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ContextMenuService {
  isOpen = signal(false);
  position = signal({ x: 0, y: 0 });
  items = signal<MenuItem[]>([]);

  open(event: MouseEvent, items: MenuItem[]) {
    event.preventDefault();
    this.position.set({ x: event.clientX, y: event.clientY });
    this.items.set(items);
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }
}
