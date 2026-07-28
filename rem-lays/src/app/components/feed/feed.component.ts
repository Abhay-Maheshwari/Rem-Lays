import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ItemsService } from '../../services/items.service';
import { ItemCardComponent } from '../item-card/item-card.component';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, FormsModule, ItemCardComponent],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.scss'
})
export class FeedComponent implements OnInit {
  streakCount = 0;

  constructor(public itemsSvc: ItemsService) {}

  async ngOnInit() {
    await this.itemsSvc.refresh();
  }

  async refresh() {
    await this.itemsSvc.refresh();
  }

  async markAllAsRead() {
    if (this.itemsSvc.unseenCount() > 0) {
      await this.itemsSvc.markAllAsRead();
      this.streakCount++;
    }
  }
}
