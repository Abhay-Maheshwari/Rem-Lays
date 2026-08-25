import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ItemsService } from '../../services/items.service';
import { ItemViewerService } from '../../services/item-viewer.service';
import { Item } from '../../models/item.model';

@Component({
  selector: 'app-calendar-widget-month',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-widget-month.component.html',
  styleUrl: './calendar-widget-month.component.scss'
})
export class CalendarWidgetMonthComponent {
  currentMonthDate: Date = new Date();
  daysInMonth: { date: number; isCurrentMonth: boolean; fullDate: Date; items: Item[] }[] = [];
  weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  
  selectedDate: Date = new Date(); // Default to today
  
  constructor(public itemsSvc: ItemsService, private viewerSvc: ItemViewerService) {
    effect(() => {
      this.itemsSvc.items();
      this.generateCalendar();
    });
    this.selectedDate.setHours(0,0,0,0);
  }

  get scheduledItems(): Item[] {
    return this.itemsSvc.items().filter(i => i.status !== 'deleted' && i.payload?.['deadline']).sort((a, b) => {
      const aTime = new Date(a.payload['deadline'] as string).getTime();
      const bTime = new Date(b.payload['deadline'] as string).getTime();
      return aTime - bTime;
    });
  }

  get displayedItems(): Item[] {
    const items = this.scheduledItems;
    return items.filter(i => {
      const d = new Date(this.getItemTargetTime(i));
      return d.getFullYear() === this.selectedDate.getFullYear() &&
             d.getMonth() === this.selectedDate.getMonth() &&
             d.getDate() === this.selectedDate.getDate();
    });
  }

  getItemTargetTime(i: Item): number {
    return i.payload?.['deadline'] ? new Date(i.payload['deadline'] as string).getTime() : Infinity;
  }

  generateCalendar() {
    this.daysInMonth = [];
    const year = this.currentMonthDate.getFullYear();
    const month = this.currentMonthDate.getMonth();

    // In JS, 0 is Sunday. In our widget, M is first (1).
    let firstDayOfMonth = new Date(year, month, 1).getDay() - 1;
    if (firstDayOfMonth === -1) firstDayOfMonth = 6; // Sunday becomes 6

    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      this.daysInMonth.push({ date: daysInPrevMonth - i, isCurrentMonth: false, fullDate: d, items: this.getItemsForDate(d) });
    }

    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const d = new Date(year, month, i);
      this.daysInMonth.push({ date: i, isCurrentMonth: true, fullDate: d, items: this.getItemsForDate(d) });
    }

    const remainingDays = 42 - this.daysInMonth.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      this.daysInMonth.push({ date: i, isCurrentMonth: false, fullDate: d, items: this.getItemsForDate(d) });
    }
  }

  getItemsForDate(d: Date): Item[] {
    return this.scheduledItems.filter(i => {
      const target = new Date(this.getItemTargetTime(i));
      return target.getFullYear() === d.getFullYear() &&
             target.getMonth() === d.getMonth() &&
             target.getDate() === d.getDate();
    });
  }

  prevMonth() {
    this.currentMonthDate = new Date(this.currentMonthDate.getFullYear(), this.currentMonthDate.getMonth() - 1, 1);
    this.generateCalendar();
  }

  nextMonth() {
    this.currentMonthDate = new Date(this.currentMonthDate.getFullYear(), this.currentMonthDate.getMonth() + 1, 1);
    this.generateCalendar();
  }

  selectDate(d: Date) {
    this.selectedDate = new Date(d);
  }

  isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  isToday(d: Date): boolean {
    return this.isSameDay(new Date(), d);
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
