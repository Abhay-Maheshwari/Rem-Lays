import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ItemsService } from '../../services/items.service';
import { ItemViewerService } from '../../services/item-viewer.service';
import { Item } from '../../models/item.model';

@Component({
  selector: 'app-calendar-widget-split',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-widget-split.component.html',
  styleUrl: './calendar-widget-split.component.scss'
})
export class CalendarWidgetSplitComponent {
  now = new Date();

  constructor(public itemsSvc: ItemsService, private viewerSvc: ItemViewerService) {
    effect(() => {
      this.itemsSvc.items();
    });
  }

  get upcomingItems(): Item[] {
    const today = new Date();
    today.setHours(0,0,0,0);
    return this.itemsSvc.items()
      .filter(i => i.status !== 'deleted' && i.payload?.['deadline'])
      .filter(i => new Date(i.payload['deadline'] as string).getTime() >= today.getTime())
      .sort((a, b) => new Date(a.payload['deadline'] as string).getTime() - new Date(b.payload['deadline'] as string).getTime())
      .slice(0, 2); // Show top 2 in the small right pane
  }
  
  get totalUpcomingCount(): number {
     const today = new Date();
     today.setHours(0,0,0,0);
     return this.itemsSvc.items()
      .filter(i => i.status !== 'deleted' && i.payload?.['deadline'])
      .filter(i => new Date(i.payload['deadline'] as string).getTime() >= today.getTime()).length;
  }

  getItemTargetTime(i: Item): Date {
    return new Date(i.payload!['deadline'] as string);
  }

  getItemTitle(i: Item): string {
    const v = i.payload?.['title'];
    if (typeof v === 'string' && v) return v;
    return 'Event';
  }

  openItem(item: Item) {
    this.viewerSvc.open(item);
  }
}
