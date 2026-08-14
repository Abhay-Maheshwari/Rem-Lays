import { Injectable, signal } from '@angular/core';
import { supabase } from './supabase-client';
import { Board, BoardMemberDetails } from '../models/board.model';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { LocalDbService } from './local-db.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BoardsService {
  boards = signal<Board[]>([]);

  constructor(private auth: AuthService, private toastSvc: ToastService, private localDb: LocalDbService) {
    // Load cached boards instantly, then sync from network
    this.loadFromCache();
    this.auth.session() ? this.refresh() : this.boards.set([]);
  }

  private async loadFromCache() {
    const cached = await this.localDb.getAll<Board>('boards');
    if (cached.length > 0 && this.boards().length === 0) {
      this.boards.set(cached);
    }
  }

  async refresh() {
    const user = this.auth.session()?.user;
    if (!user) return;

    // Try the ordered query first
    const res = await supabase
      .from('board_members')
      .select('order_index, role, boards(*)')
      .eq('user_id', user.id)
      .order('order_index', { ascending: true })
      .order('joined_at', { ascending: false });

    // Fallback if the migration hasn't been applied yet
    if (res.error) {
      console.warn('Ordered query failed, falling back to standard query:', res.error);
      const fallback = await supabase
        .from('boards')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (!fallback.error) {
        this.boards.set(fallback.data as Board[]);
      }
      return;
    }
    
    const mapped = (res.data || []).map((row: any) => {
      return Array.isArray(row.boards) ? row.boards[0] : row.boards;
    }).filter(b => b != null);
    
    this.boards.set(mapped as Board[]);
    this.localDb.replaceAll('boards', mapped as Board[]);
  }

  async reorderBoards(boardIds: string[]) {
    // Optimistic UI update
    const currentBoards = [...this.boards()];
    const boardMap = new Map(currentBoards.map(b => [b.id, b]));
    const newBoards = boardIds.map(id => boardMap.get(id)).filter(b => b != null) as Board[];
    
    const newBoardIds = new Set(boardIds);
    const remaining = currentBoards.filter(b => !newBoardIds.has(b.id));
    this.boards.set([...newBoards, ...remaining]);

    // Save to DB
    const { error } = await supabase.rpc('update_board_order', { board_ids: boardIds });
    if (error) {
      console.error('Failed to save board order', error);
      this.toastSvc.show('Failed to save board order', 'error');
      this.refresh();
    }
  }

  async createBoard(name: string) {
    const user = this.auth.session()?.user;
    if (!user) return null;

    const { data, error } = await supabase
      .from('boards')
      .insert({ name, owner_id: user.id })
      .select('*')
      .single();

    if (error) {
      console.error('Failed to create board', error);
      this.toastSvc.show('Failed to create board', 'error');
      return null;
    }

    // Owner is automatically a member due to RLS? No, we need to add them to board_members.
    // Wait, the RPC or trigger normally handles this. If not, we insert it manually.
    await supabase.from('board_members').insert({
      board_id: data.id,
      user_id: user.id,
      role: 'owner'
    });

    await this.refresh();
    this.toastSvc.show('Board created successfully!');
    return data as Board;
  }

  async deleteBoard(id: string) {
    const { error } = await supabase.from('boards').delete().eq('id', id);
    if (error) {
      console.error('Failed to delete board', error);
      this.toastSvc.show('Failed to delete board', 'error');
      return;
    }
    await this.refresh();
  }

  async joinBoard(token: string) {
    const { data, error } = await supabase.rpc('join_board', { token });
    if (error) {
      console.error('Failed to join board', error);
      this.toastSvc.show('Invalid or expired invite link', 'error');
      return null;
    }
    await this.refresh();
    this.toastSvc.show('Successfully joined board!');
    return data;
  }

  async leaveBoard(boardId: string) {
    const user = this.auth.session()?.user;
    if (!user) return;

    const { error } = await supabase.from('board_members').delete().eq('board_id', boardId).eq('user_id', user.id);
    if (error) {
      console.error('Failed to leave board', error);
      this.toastSvc.show('Failed to leave board', 'error');
      return;
    }
    await this.refresh();
  }

  getInviteLink(board: Board, role: 'editor' | 'viewer' = 'editor') {
    const token = role === 'viewer' && board.viewer_invite_token ? board.viewer_invite_token : board.invite_token;
    return `${environment.publicWebAppUrl}/invite/${token}`;
  }

  copyInviteLink(board: Board, role: 'editor' | 'viewer' = 'editor') {
    const url = this.getInviteLink(board, role);
    navigator.clipboard.writeText(url).then(
      () => this.toastSvc.show(`${role === 'editor' ? 'Editor' : 'Viewer'} invite link copied!`),
      () => this.toastSvc.show('Could not copy link', 'error')
    );
  }

  async getMembers(boardId: string): Promise<BoardMemberDetails[]> {
    const { data, error } = await supabase.rpc('get_board_members', { b_id: boardId });
    if (error) {
      console.error('Failed to get board members', error);
      this.toastSvc.show('Failed to load members', 'error');
      return [];
    }
    return data as BoardMemberDetails[];
  }

  async updateMemberRole(boardId: string, targetUserId: string, newRole: string) {
    const { error } = await supabase.rpc('update_board_member_role', { 
      b_id: boardId, 
      target_user_id: targetUserId, 
      new_role: newRole 
    });
    
    if (error) {
      console.error('Failed to update member role', error);
      this.toastSvc.show('Failed to update role', 'error');
      return false;
    }
    
    this.toastSvc.show('Role updated successfully');
    return true;
  }

  async kickMember(boardId: string, targetUserId: string) {
    const { error } = await supabase.rpc('remove_board_member', { 
      b_id: boardId, 
      target_user_id: targetUserId 
    });
    
    if (error) {
      console.error('Failed to remove member', error);
      this.toastSvc.show('Failed to remove member', 'error');
      return false;
    }
    
    this.toastSvc.show('Member removed successfully');
    return true;
  }
  async updateAutoAssignHashtags(boardId: string, tags: string[]) {
    const { error } = await supabase.from('boards').update({ auto_assign_hashtags: tags }).eq('id', boardId);
    if (error) {
      console.error('Failed to update auto-assign hashtags', error);
      this.toastSvc.show('Failed to update hashtags', 'error');
      return false;
    }
    
    this.toastSvc.show('Auto-assign hashtags updated');
    await this.refresh();
    return true;
  }
}
