import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ItemsService } from '../../services/items.service';
import { ItemViewerService } from '../../services/item-viewer.service';
import { Item } from '../../models/item.model';

@Component({
  selector: 'app-calendar-widget-ios-small-agenda',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-widget-ios-small-agenda.component.html',
  styleUrl: './calendar-widget-ios-small-agenda.component.scss'
})
export class CalendarWidgetIosSmallAgendaComponent {
  now = new Date();
  
  // iOS Calendar colors
  colors = ['#c864ff', '#3b82f6', '#f59e0b', '#10b981', '#ef4444'];

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
      .slice(0, 3); // Fit max 3 in small square
  }

  getItemTitle(i: Item): string {
    const v = i.payload?.['title'];
    if (typeof v === 'string' && v) return v;
    return 'Event';
  }
  
  getItemTargetTime(i: Item): Date {
    return new Date(i.payload!['deadline'] as string);
  }

  openItem(item: Item) {
    this.viewerSvc.open(item);
  }
}
