import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ItemsService } from '../../services/items.service';
import { ItemViewerService } from '../../services/item-viewer.service';
import { Item } from '../../models/item.model';

@Component({
  selector: 'app-calendar-widget-agenda',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-widget-agenda.component.html',
  styleUrl: './calendar-widget-agenda.component.scss'
})
export class CalendarWidgetAgendaComponent {
  constructor(public itemsSvc: ItemsService, private viewerSvc: ItemViewerService) {
    effect(() => {
      this.itemsSvc.items();
    });
  }

  get upcomingItems(): Item[] {
    const now = new Date();
    now.setHours(0,0,0,0);
    return this.itemsSvc.items()
      .filter(i => i.status !== 'deleted' && i.payload?.['deadline'])
      .filter(i => new Date(i.payload['deadline'] as string).getTime() >= now.getTime())
      .sort((a, b) => new Date(a.payload['deadline'] as string).getTime() - new Date(b.payload['deadline'] as string).getTime())
      .slice(0, 5); // Show top 5
  }

  getItemTargetTime(i: Item): Date {
    return new Date(i.payload!['deadline'] as string);
  }

  getItemTitle(i: Item): string {
    const v = i.payload?.['title'];
    if (typeof v === 'string' && v) return v;
    const url = i.payload?.['url'];
    if (typeof url === 'string' && url) return url;
    return 'Event';
  }

  openItem(item: Item) {
    this.viewerSvc.open(item);
  }
}
