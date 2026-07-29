export type ItemType = 'image' | 'video' | 'reel' | 'link' | 'text';
export type ItemStatus = 'unseen' | 'seen' | 'deleted' | 'archived';

export interface Item {
  id: string;
  user_id: string;
  source_device_id: string | null;
  type: ItemType;
  payload: { tags?: string[]; [key: string]: unknown };
  storage_key: string | null;
  thumbnail_key: string | null;
  status: ItemStatus;
  created_at: string;
  seen_at: string | null;
  is_pinned: boolean;
  expires_at: string | null;
  snooze_until: string | null;
}
