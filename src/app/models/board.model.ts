export interface Board {
  id: string;
  owner_id: string;
  name: string;
  invite_token: string;
  viewer_invite_token?: string;
  created_at: string;
  auto_assign_hashtags?: string[];
}

export interface BoardMember {
  board_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  joined_at: string;
}

export interface BoardMemberDetails extends BoardMember {
  email: string;
}
