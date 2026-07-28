export interface Device {
  id: string;
  user_id: string;
  device_name: string;
  device_type: 'desktop' | 'phone';
  fcm_token: string | null;
  last_synced_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  revoked_at: string | null;
}
