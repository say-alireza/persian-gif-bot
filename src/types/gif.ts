export type GifStatus = 'active' | 'pending_review' | 'rejected';

export interface GifEntity {
  id: number;
  file_id: string;
  file_unique_id: string;
  title: string;
  caption: string | null;
  tags: string | null;
  views: number;
  votes_up: number;
  votes_down: number;
  status: GifStatus;
  created_at: string;
  updated_at: string;
  source: 'channel' | 'user';
  submitted_by: number | null;
  submitted_by_username: string | null;
  submitted_at: string | null;
  reviewed_by: number | null;
  reviewed_by_username: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
}

export interface GifSearchResult {
  id: number;
  file_id: string;
  title: string;
}

export interface AuditEntry {
  action: string;
  actor_id: number | null;
  actor_username: string | null;
  details: string | null;
  created_at: string;
}
