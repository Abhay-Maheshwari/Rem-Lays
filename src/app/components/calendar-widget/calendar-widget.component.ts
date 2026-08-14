import { Component, OnInit, effect, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ItemsService } from '../../services/items.service';
import { Item } from '../../models/item.model';
import { ItemViewerService } from '../../services/item-viewer.service';

@Component({
  selector: 'app-calendar-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-widget.component.html',
  styleUrl: './calendar-widget.component.scss'
})
export class CalendarWidgetComponent implements OnInit {
  currentMonthDate: Date = new Date();
  daysInMonth: { date: number; isCurrentMonth: boolean; fullDate: Date; items: Item[] }[] = [];
  weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  
  selectedDate: Date | null = null;
  
  @Output() navigate = new EventEmitter<void>();
  
  constructor(public itemsSvc: ItemsService, private viewerSvc: ItemViewerService) {
    effect(() => {
      this.itemsSvc.items(); // track items signal
      this.generateCalendar();
    });
  }

  ngOnInit() {
    // Initial generation handled by effect
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
    if (!this.selectedDate) {
      // Show upcoming items (from today onwards)
      const now = new Date();
      now.setHours(0,0,0,0);
      return items.filter(i => {
        const time = this.getItemTargetTime(i);
        return time >= now.getTime();
      });
    }
    
    return items.filter(i => {
      const d = new Date(this.getItemTargetTime(i));
      return d.getFullYear() === this.selectedDate!.getFullYear() &&
             d.getMonth() === this.selectedDate!.getMonth() &&
             d.getDate() === this.selectedDate!.getDate();
    });
  }
  
  getItemTargetTime(i: Item): number {
    return i.payload?.['deadline'] ? new Date(i.payload['deadline'] as string).getTime() : Infinity;
  }

  generateCalendar() {
    this.daysInMonth = [];
    const year = this.currentMonthDate.getFullYear();
    const month = this.currentMonthDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Previous month's trailing days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      this.daysInMonth.push({
        date: daysInPrevMonth - i,
        isCurrentMonth: false,
        fullDate: d,
        items: this.getItemsForDate(d)
      });
    }

    // Current month's days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      const d = new Date(year, month, i);
      this.daysInMonth.push({
        date: i,
        isCurrentMonth: true,
        fullDate: d,
        items: this.getItemsForDate(d)
      });
    }

    // Next month's leading days
    const remainingDays = 42 - this.daysInMonth.length;
    for (let i = 1; i <= remainingDays; i++) {
      const d = new Date(year, month + 1, i);
      this.daysInMonth.push({
        date: i,
        isCurrentMonth: false,
        fullDate: d,
        items: this.getItemsForDate(d)
      });
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
    if (this.selectedDate && this.isSameDay(this.selectedDate, d)) {
      this.selectedDate = null; // Toggle off
    } else {
      this.selectedDate = new Date(d);
    }
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
    const url = i.payload?.['url'];
    if (typeof url === 'string' && url) return url;
    const note = i.payload?.['note'];
    if (typeof note === 'string' && note) return note.substring(0, 50) + (note.length > 50 ? '...' : '');
    return i.type;
  }
  
  openFullCalendar() {
    this.navigate.emit();
  }
  
  openItem(item: Item) {
    this.viewerSvc.open(item);
  }
}
