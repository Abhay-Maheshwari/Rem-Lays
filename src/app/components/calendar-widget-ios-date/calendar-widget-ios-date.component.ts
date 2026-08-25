import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-calendar-widget-ios-date',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-widget-ios-date.component.html',
  styleUrl: './calendar-widget-ios-date.component.scss'
})
export class CalendarWidgetIosDateComponent {
  now = new Date();
}
