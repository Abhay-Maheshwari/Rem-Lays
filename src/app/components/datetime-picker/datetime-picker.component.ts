import { Component, EventEmitter, Input, Output, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-datetime-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './datetime-picker.component.html',
  styleUrl: './datetime-picker.component.scss'
})
export class DatetimePickerComponent implements OnInit {
  @Input() initialDate: Date = new Date();
  @Input() showRecurrence = false;
  @Input() initialRecurrence: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly' = 'once';
  @Output() confirm = new EventEmitter<Date>();
  @Output() confirmWithRecurrence = new EventEmitter<{ date: Date, recurrence: string }>();
  @Output() cancel = new EventEmitter<void>();

  selectedDate: Date = new Date();
  currentMonthDate: Date = new Date();
  
  timeStr: string = '08:00'; // HH:mm

  daysInMonth: { date: number; isCurrentMonth: boolean; fullDate: Date }[] = [];
  weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  ngOnInit() {
    if (this.initialDate) {
      this.selectedDate = new Date(this.initialDate);
      this.currentMonthDate = new Date(this.initialDate);
      const h = this.selectedDate.getHours().toString().padStart(2, '0');
      const m = this.selectedDate.getMinutes().toString().padStart(2, '0');
      this.timeStr = `${h}:${m}`;
    }
    if (this.initialRecurrence) {
      this.selectedRecurrence = this.initialRecurrence;
    }
    this.generateCalendar();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.cancel.emit();
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
      this.daysInMonth.push({
        date: daysInPrevMonth - i,
        isCurrentMonth: false,
        fullDate: new Date(year, month - 1, daysInPrevMonth - i)
      });
    }

    // Current month's days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      this.daysInMonth.push({
        date: i,
        isCurrentMonth: true,
        fullDate: new Date(year, month, i)
      });
    }

    // Next month's leading days
    const remainingDays = 42 - this.daysInMonth.length; // 6 rows of 7 days
    for (let i = 1; i <= remainingDays; i++) {
      this.daysInMonth.push({
        date: i,
        isCurrentMonth: false,
        fullDate: new Date(year, month + 1, i)
      });
    }
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
    // Keep the time
    const [h, m] = this.timeStr.split(':').map(Number);
    this.selectedDate.setHours(h || 0, m || 0, 0, 0);
  }

  isSelected(d: Date): boolean {
    return this.selectedDate.getFullYear() === d.getFullYear() &&
           this.selectedDate.getMonth() === d.getMonth() &&
           this.selectedDate.getDate() === d.getDate();
  }

  isToday(d: Date): boolean {
    const today = new Date();
    return today.getFullYear() === d.getFullYear() &&
           today.getMonth() === d.getMonth() &&
           today.getDate() === d.getDate();
  }

  isPast(d: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  }

  get isPastDate(): boolean {
    const [h, m] = this.timeStr.split(':').map(Number);
    const selected = new Date(this.selectedDate);
    selected.setHours(h || 0, m || 0, 0, 0);
    return selected.getTime() < Date.now();
  }

  showTimeDropdown = false;
  hoursList: string[] = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  minutesList: string[] = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));
  
  get selectedHour(): string {
    return this.timeStr.split(':')[0];
  }
  
  get selectedMinute(): string {
    return this.timeStr.split(':')[1];
  }

  toggleTimeDropdown(event: Event) {
    event.stopPropagation();
    this.showTimeDropdown = !this.showTimeDropdown;
    
    // Scroll selected items into view when opened
    if (this.showTimeDropdown) {
      setTimeout(() => {
        const activeHour = document.querySelector('.hours-col .time-option.selected');
        if (activeHour) activeHour.scrollIntoView({ block: 'center' });
        
        const activeMin = document.querySelector('.mins-col .time-option.selected');
        if (activeMin) activeMin.scrollIntoView({ block: 'center' });
      }, 0);
    }
  }

  selectHour(h: string) {
    this.timeStr = `${h}:${this.selectedMinute}`;
  }

  selectMinute(m: string) {
    this.timeStr = `${this.selectedHour}:${m}`;
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.showTimeDropdown = false;
    this.showRecurrenceDropdown = false;
  }

  showRecurrenceDropdown = false;
  recurrenceOptions = ['once', 'daily', 'weekly', 'monthly', 'yearly'];
  selectedRecurrence = 'once';

  toggleRecurrenceDropdown(event: Event) {
    event.stopPropagation();
    this.showRecurrenceDropdown = !this.showRecurrenceDropdown;
    this.showTimeDropdown = false;
  }

  selectRecurrence(r: string) {
    this.selectedRecurrence = r;
    this.showRecurrenceDropdown = false;
  }

  onConfirm() {
    const [h, m] = this.timeStr.split(':').map(Number);
    this.selectedDate.setHours(h || 0, m || 0, 0, 0);
    if (this.showRecurrence) {
      this.confirmWithRecurrence.emit({ date: this.selectedDate, recurrence: this.selectedRecurrence });
    } else {
      this.confirm.emit(this.selectedDate);
    }
  }

  onCancel() {
    this.cancel.emit();
  }
}
