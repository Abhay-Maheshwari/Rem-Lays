import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ItemsService } from '../../services/items.service';
import { BoardsService } from '../../services/boards.service';
import { ItemCardComponent } from '../item-card/item-card.component';
import { DragDropModule } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [CommonModule, FormsModule, ItemCardComponent, DragDropModule],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.scss'
})
export class FeedComponent implements OnInit {
  streakCount = 0;
  loading = signal(true);
  showBoardPicker = false;

  constructor(public itemsSvc: ItemsService, public boardsSvc: BoardsService) {}

  getBoardName(): string {
    const activeId = this.itemsSvc.activeBoardId();
    if (!activeId) return 'Items';
    const board = this.boardsSvc.boards().find(b => b.id === activeId);
    return board ? board.name : 'Board';
  }

  get connectedBoardDropLists(): string[] {
    return this.boardsSvc.boards().map(b => 'board-drop-' + b.id);
  }

  async ngOnInit() {
    this.loading.set(true);
    await this.itemsSvc.refresh();
    this.loading.set(false);
  }

  async refresh() {
    this.loading.set(true);
    await Promise.all([
      this.itemsSvc.refresh(),
      this.boardsSvc.refresh()
    ]);
    this.loading.set(false);
  }

  async markAllAsRead() {
    if (this.itemsSvc.unseenCount() > 0) {
      await this.itemsSvc.markAllAsRead();
      this.streakCount++;
    }
  }

  async selectBoard(boardId: string | null) {
    this.showBoardPicker = false;
    await this.itemsSvc.moveSelectedToBoard(boardId);
  }

  startSelection() {
    this.showBoardPicker = false;
    this.itemsSvc.selectionMode.set(true);
  }

  cancelSelection() {
    this.showBoardPicker = false;
    this.itemsSvc.clearSelection();
  }

  // --- Unified Search & Tags ---
  isSearchFocused = false;

  get tagSuggestions(): string[] {
    const query = this.itemsSvc.searchQuery().trim().toLowerCase();
    const allTags = this.itemsSvc.allTags();
    
    // Suggest tags that match the search query (if any), excluding already selected ones
    return allTags.filter(tag => {
      const isSelected = this.itemsSvc.selectedTags().has(tag);
      if (isSelected) return false;
      if (query && query.startsWith('#')) {
         return tag.toLowerCase().includes(query.substring(1));
      }
      if (query) {
         return tag.toLowerCase().includes(query);
      }
      return true; // if no query, suggest all unselected tags
    }).slice(0, 8); // Limit suggestions to 8
  }

  onSearchFocus() {
    this.isSearchFocused = true;
  }

  onSearchBlur() {
    // Delay hiding to allow click events on suggestions to fire
    setTimeout(() => {
      this.isSearchFocused = false;
    }, 200);
  }

  selectTag(tag: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    const current = new Set(this.itemsSvc.selectedTags());
    current.add(tag);
    this.itemsSvc.selectedTags.set(current);
    // Clear search query after selecting a tag
    this.itemsSvc.searchQuery.set('');
  }

  removeTag(tag: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    const current = new Set(this.itemsSvc.selectedTags());
    current.delete(tag);
    this.itemsSvc.selectedTags.set(current);
  }

  clearAllTags(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.itemsSvc.selectedTags.set(new Set());
  }

  toggleTagMatchMode(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    const current = this.itemsSvc.tagMatchMode();
    const next = current === 'OR' ? 'AND' : current === 'AND' ? 'NOT' : 'OR';
    this.itemsSvc.tagMatchMode.set(next);
  }

  trackById(index: number, item: any): string {
    return item.id;
  }
}
