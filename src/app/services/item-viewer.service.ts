import { Injectable, signal } from '@angular/core';
import { Item } from '../models/item.model';

@Injectable({
  providedIn: 'root'
})
export class ItemViewerService {
  currentItem = signal<Item | null>(null);

  open(item: Item) {
    this.currentItem.set(item);
  }

  close() {
    this.currentItem.set(null);
  }
}
