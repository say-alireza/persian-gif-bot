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
  status: 'active' | 'pending_review' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface GifSearchResult {
  id: number;
  file_id: string;
  title: string;
}
