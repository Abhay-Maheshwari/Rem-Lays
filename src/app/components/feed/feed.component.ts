import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ItemsService } from '../../services/items.service';
import { BoardsService } from '../../services/boards.service';
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

  constructor(public itemsSvc: ItemsService, public boardsSvc: BoardsService) {}

  getBoardName(): string {
    const activeId = this.itemsSvc.activeBoardId();
    if (!activeId) return 'Items';
    const board = this.boardsSvc.boards().find(b => b.id === activeId);
    return board ? board.name : 'Board';
  }

  async ngOnInit() {
    await this.itemsSvc.refresh();
  }

  async refresh() {
    await Promise.all([
      this.itemsSvc.refresh(),
      this.boardsSvc.refresh()
    ]);
  }

  async markAllAsRead() {
    if (this.itemsSvc.unseenCount() > 0) {
      await this.itemsSvc.markAllAsRead();
      this.streakCount++;
    }
  }
}
