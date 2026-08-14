import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ItemsService } from '../../services/items.service';
import { AuthService } from '../../services/auth.service';
import { BoardsService } from '../../services/boards.service';
import { CalendarWidgetComponent } from '../calendar-widget/calendar-widget.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, CalendarWidgetComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  @Output() navigate = new EventEmitter<'feed' | 'settings' | 'digest' | 'calendar'>();

  userName = 'Explorer';
  
  presets = [
    { id: 'default', name: 'Default', style: 'var(--bg-main)' },
    { id: 'blue', name: 'Blue', style: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, var(--bg-main) 100%)' },
    { id: 'purple', name: 'Purple', style: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, var(--bg-main) 100%)' },
    { id: 'emerald', name: 'Emerald', style: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, var(--bg-main) 100%)' },
    { id: 'rose', name: 'Rose', style: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, var(--bg-main) 100%)' }
  ];
  
  currentBg = this.presets[0];
  
  constructor(public itemsSvc: ItemsService, public authSvc: AuthService, public boardsSvc: BoardsService) {
    const session = this.authSvc.session();
    if (session?.user?.user_metadata?.['full_name']) {
      this.userName = session.user.user_metadata['full_name'].split(' ')[0];
    }
    
    const savedBg = localStorage.getItem('dashboard_bg');
    if (savedBg) {
      const found = this.presets.find(p => p.id === savedBg);
      if (found) this.currentBg = found;
    }
  }

  ngOnInit() {
  }

  get totalItems() {
    return this.itemsSvc.items().length;
  }

  get unreadItems() {
    return this.itemsSvc.items().filter(i => i.status === 'unseen').length;
  }

  get linksCount() {
    return this.itemsSvc.items().filter(i => i.type === 'link').length;
  }

  goTo(view: 'feed' | 'settings' | 'digest' | 'calendar') {
    this.navigate.emit(view);
  }

  goToBoard(boardId: string) {
    this.itemsSvc.activeBoardId.set(boardId);
    this.itemsSvc.filter.set('all');
    this.navigate.emit('feed');
  }

  isCreatingBoard = false;
  newBoardName = '';

  startCreateBoard() {
    this.isCreatingBoard = true;
    this.newBoardName = '';
  }

  cancelCreateBoard() {
    this.isCreatingBoard = false;
    this.newBoardName = '';
  }

  async confirmCreateBoard() {
    const name = this.newBoardName.trim();
    if (name) {
      await this.boardsSvc.createBoard(name);
    }
    this.isCreatingBoard = false;
    this.newBoardName = '';
  }
}
