import { Component, OnInit, signal, HostListener } from '@angular/core';
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
  isDragOver = signal(false);
  private dragCounter = 0;

  constructor(public itemsSvc: ItemsService, public boardsSvc: BoardsService) {}

  getBoardName(): string {
    const activeId = this.itemsSvc.activeBoardId();
    if (!activeId) return 'Items';
    const board = this.boardsSvc.boards().find(b => b.id === activeId);
    return board ? board.name : 'Board';
  }

  get connectedBoardDropLists(): string[] {
    const boardDrops = this.boardsSvc.boards().map(b => 'board-drop-' + b.id);
    const groupDrops = this.itemsSvc.filteredItems()
      .filter(i => i.type === 'group' || !!i.payload?.['is_group'])
      .map(i => 'group-drop-' + i.id);
    return [...boardDrops, ...groupDrops];
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

  showGroupPrompt = false;
  groupNameInput = '';

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent) {
    if (this.showGroupPrompt) {
      this.cancelGroupPrompt();
    }
  }

  // ─── Drag & Drop File Upload ─────────────────────────────
  @HostListener('dragenter', ['$event'])
  onDragEnter(event: DragEvent) {
    event.preventDefault();
    this.dragCounter++;
    if (event.dataTransfer?.types?.includes('Files')) {
      this.isDragOver.set(true);
    }
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragCounter--;
    if (this.dragCounter <= 0) {
      this.dragCounter = 0;
      this.isDragOver.set(false);
    }
  }

  @HostListener('drop', ['$event'])
  async onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragCounter = 0;
    this.isDragOver.set(false);

    const dt = event.dataTransfer;
    if (!dt?.files || dt.files.length === 0) return;

    // Filter to images and videos only
    const mediaFiles = Array.from(dt.files).filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    );

    if (mediaFiles.length === 0) return;

    this.itemsSvc.stagedFiles.update(current => [...current, ...mediaFiles]);
  }

  startGroupSelected() {
    const selectedIds = Array.from(this.itemsSvc.selectedItemIds());
    if (selectedIds.length === 0) return;
    this.groupNameInput = '';
    this.showGroupPrompt = true;
  }

  cancelGroupPrompt() {
    this.showGroupPrompt = false;
  }

  async confirmGroupPrompt() {
    this.showGroupPrompt = false;
    const selectedIds = Array.from(this.itemsSvc.selectedItemIds());
    if (selectedIds.length === 0) return;
    const name = this.groupNameInput.trim() || 'New Group';
    await this.itemsSvc.groupItems(name, selectedIds);
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
