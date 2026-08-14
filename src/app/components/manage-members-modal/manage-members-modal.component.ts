import { Component, Input, Output, EventEmitter, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BoardsService } from '../../services/boards.service';
import { AuthService } from '../../services/auth.service';
import { BoardMemberDetails } from '../../models/board.model';
import { TagInputComponent } from '../tag-input/tag-input.component';

@Component({
  selector: 'app-manage-members-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TagInputComponent],
  templateUrl: './manage-members-modal.component.html',
  styleUrl: './manage-members-modal.component.scss'
})
export class ManageMembersModalComponent implements OnInit {
  @Input() boardId!: string;
  @Output() close = new EventEmitter<void>();
  
  members = signal<BoardMemberDetails[]>([]);
  isLoading = signal<boolean>(true);
  currentUserId: string | undefined;
  openDropdownId = signal<string | null>(null);
  
  board = computed(() => this.boardsSvc.boards().find(b => b.id === this.boardId));
  autoAssignTags = signal<string[]>([]);
  
  constructor(
    private boardsSvc: BoardsService,
    private authSvc: AuthService
  ) {
    this.currentUserId = this.authSvc.session()?.user?.id;
  }

  ngOnInit() {
    this.loadMembers();
    const b = this.board();
    if (b && b.auto_assign_hashtags) {
      this.autoAssignTags.set([...b.auto_assign_hashtags]);
    }
  }

  async loadMembers() {
    this.isLoading.set(true);
    const m = await this.boardsSvc.getMembers(this.boardId);
    this.members.set(m);
    this.isLoading.set(false);
  }

  async updateAutoAssignTags(tags: string[]) {
    this.autoAssignTags.set(tags);
    await this.boardsSvc.updateAutoAssignHashtags(this.boardId, tags);
  }

  isOwner() {
    const me = this.members().find(m => m.user_id === this.currentUserId);
    return me?.role === 'owner';
  }

  async changeRole(member: BoardMemberDetails, newRole: string) {
    if (member.role === 'owner' || !this.isOwner()) return;
    
    // Optimistic update
    const prevRole = member.role;
    member.role = newRole as 'editor' | 'viewer';
    
    const success = await this.boardsSvc.updateMemberRole(this.boardId, member.user_id, newRole);
    if (!success) {
      member.role = prevRole; // Revert
    }
  }

  async removeMember(member: BoardMemberDetails) {
    if (member.role === 'owner' || !this.isOwner()) return;
    
    if (confirm(`Are you sure you want to remove ${member.email} from the board?`)) {
      const success = await this.boardsSvc.kickMember(this.boardId, member.user_id);
      if (success) {
        this.members.update(m => m.filter(x => x.user_id !== member.user_id));
      }
    }
  }

  async deleteBoard() {
    if (!this.isOwner()) return;
    
    if (confirm('Are you sure you want to permanently delete this board? This action cannot be undone.')) {
      await this.boardsSvc.deleteBoard(this.boardId);
      this.close.emit();
    }
  }

  async leaveBoard() {
    if (this.isOwner()) return;
    
    if (confirm('Are you sure you want to leave this board?')) {
      await this.boardsSvc.leaveBoard(this.boardId);
      this.close.emit();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event: KeyboardEvent) {
    this.close.emit();
  }
}
