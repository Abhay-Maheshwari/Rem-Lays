import { Component, EventEmitter, Output, computed, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ItemsService } from '../../services/items.service';
import { BoardsService } from '../../services/boards.service';
import { ItemCardComponent } from '../item-card/item-card.component';
import { Item } from '../../models/item.model';

type DateType = 'deadline' | 'snoozed' | 'created';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, ItemCardComponent],
  templateUrl: './calendar.component.html',
  styleUrl: './calendar.component.scss'
})
export class CalendarComponent {
  @Output() navigate = new EventEmitter<'home' | 'feed' | 'settings' | 'digest'>();

  currentDate = new Date();
  currentMonth = signal(this.currentDate.getMonth());
  currentYear = signal(this.currentDate.getFullYear());
  selectedDate = signal<Date | null>(new Date());
  
  dateTypeFilter = signal<DateType>('deadline');
  boardFilter = signal<string>('all'); // 'all' or boardId
  
  agendaWidth = signal(350);
  isResizing = false;
  
  isDateTypeDropdownOpen = false;
  isBoardDropdownOpen = false;

  touchStartX = 0;
  touchEndX = 0;

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].screenX;
    this.handleSwipe();
  }

  handleSwipe() {
    // Only allow swipe on mobile/app version
    if (window.innerWidth > 760) return;
    
    const swipeThreshold = 50;
    if (this.touchEndX < this.touchStartX - swipeThreshold) {
      this.nextMonth(); // Swiped left, go to next month
    }
    if (this.touchEndX > this.touchStartX + swipeThreshold) {
      this.prevMonth(); // Swiped right, go to previous month
    }
  }

  toggleDateTypeDropdown(event: Event) {
    event.stopPropagation();
    this.isDateTypeDropdownOpen = !this.isDateTypeDropdownOpen;
    this.isBoardDropdownOpen = false;
  }

  toggleBoardDropdown(event: Event) {
    event.stopPropagation();
    this.isBoardDropdownOpen = !this.isBoardDropdownOpen;
    this.isDateTypeDropdownOpen = false;
  }

  @HostListener('document:click')
  closeDropdowns() {
    this.isDateTypeDropdownOpen = false;
    this.isBoardDropdownOpen = false;
  }

  startResize(event: MouseEvent) {
    this.isResizing = true;
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isResizing) return;
    let newWidth = window.innerWidth - event.clientX;
    if (newWidth < 300) newWidth = 300;
    if (newWidth > 800) newWidth = 800;
    this.agendaWidth.set(newWidth);
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    this.isResizing = false;
  }

  daysInMonth = computed(() => {
    const year = this.currentYear();
    const month = this.currentMonth();
    const daysCount = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    
    const days: { date: Date, currentMonth: boolean }[] = [];
    
    // Previous month padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        currentMonth: false
      });
    }
    
    // Current month
    for (let i = 1; i <= daysCount; i++) {
      days.push({
        date: new Date(year, month, i),
        currentMonth: true
      });
    }
    
    // Next month padding (to fill grid to multiple of 7)
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        currentMonth: false
      });
    }
    
    return days;
  });

  filteredItemsForMonth = computed(() => {
    let items = this.itemsSvc.items();
    const bFilter = this.boardFilter();
    
    if (bFilter === 'personal') {
      items = items.filter(i => !i.board_id);
    } else if (bFilter !== 'all') {
      items = items.filter(i => i.board_id === bFilter);
    }
    
    // We only care about items that have a valid date of the selected type
    return items.filter(i => this.getItemDate(i) !== null);
  });

  selectedDayItems = computed(() => {
    const date = this.selectedDate();
    if (!date) return [];
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.filteredItemsForMonth().filter(i => {
      const itemDate = this.getItemDate(i);
      if (!itemDate) return false;
      return itemDate >= startOfDay && itemDate <= endOfDay;
    }).sort((a, b) => {
       const dateA = this.getItemDate(a)!;
       const dateB = this.getItemDate(b)!;
       return dateA.getTime() - dateB.getTime();
    });
  });

  constructor(public itemsSvc: ItemsService, public boardsSvc: BoardsService) {}

  getItemDate(item: Item): Date | null {
    const type = this.dateTypeFilter();
    if (type === 'deadline') {
      return (item.payload as any)?.deadline ? new Date((item.payload as any).deadline) : null;
    } else if (type === 'snoozed') {
      return item.snooze_until ? new Date(item.snooze_until) : null;
    } else if (type === 'created') {
      return item.created_at ? new Date(item.created_at) : null;
    }
    return null;
  }

  getBoardName(id: string): string {
    if (id === 'personal') return 'Personal';
    const board = this.boardsSvc.boards().find(b => b.id === id);
    return board ? board.name : 'Unknown';
  }

  hasItemsOnDate(date: Date): boolean {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.filteredItemsForMonth().some(i => {
      const itemDate = this.getItemDate(i);
      if (!itemDate) return false;
      return itemDate >= startOfDay && itemDate <= endOfDay;
    });
  }
  
  getItemsCountOnDate(date: Date): number {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return this.filteredItemsForMonth().filter(i => {
      const itemDate = this.getItemDate(i);
      if (!itemDate) return false;
      return itemDate >= startOfDay && itemDate <= endOfDay;
    }).length;
  }

  prevMonth() {
    let m = this.currentMonth();
    if (m === 0) {
      this.currentMonth.set(11);
      this.currentYear.update(y => y - 1);
    } else {
      this.currentMonth.update(v => v - 1);
    }
  }

  nextMonth() {
    let m = this.currentMonth();
    if (m === 11) {
      this.currentMonth.set(0);
      this.currentYear.update(y => y + 1);
    } else {
      this.currentMonth.update(v => v + 1);
    }
  }

  selectDate(date: Date) {
    this.selectedDate.set(date);
    // Auto switch to month of selected date if clicked on padded day
    if (date.getMonth() !== this.currentMonth()) {
      this.currentMonth.set(date.getMonth());
      this.currentYear.set(date.getFullYear());
    }
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  }

  isSelected(date: Date): boolean {
    const selected = this.selectedDate();
    if (!selected) return false;
    return date.getDate() === selected.getDate() && 
           date.getMonth() === selected.getMonth() && 
           date.getFullYear() === selected.getFullYear();
  }
  
  getMonthName(): string {
     const date = new Date(this.currentYear(), this.currentMonth(), 1);
     return date.toLocaleString('default', { month: 'long' });
  }

  goBack() {
    this.navigate.emit('home');
  }
}
