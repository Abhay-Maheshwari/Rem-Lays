import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BoardsService } from '../../services/boards.service';
import { AuthService } from '../../services/auth.service';
import { BoardMemberDetails } from '../../models/board.model';

@Component({
  selector: 'app-manage-members-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manage-members-modal.component.html',
  styleUrl: './manage-members-modal.component.scss'
})
export class ManageMembersModalComponent implements OnInit {
  @Input() boardId!: string;
  @Output() close = new EventEmitter<void>();
  
  members = signal<BoardMemberDetails[]>([]);
  isLoading = signal<boolean>(true);
  currentUserId: string | undefined;
  
  constructor(
    private boardsSvc: BoardsService,
    private authSvc: AuthService
  ) {
    this.currentUserId = this.authSvc.session()?.user?.id;
  }

  ngOnInit() {
    this.loadMembers();
  }

  async loadMembers() {
    this.isLoading.set(true);
    const m = await this.boardsSvc.getMembers(this.boardId);
    this.members.set(m);
    this.isLoading.set(false);
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
}
