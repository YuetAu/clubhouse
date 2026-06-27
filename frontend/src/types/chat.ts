export interface ChatMessage {
  id: string;
  room_id: string;
  author_id: string | null;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  is_anon: boolean;
  content: string;
  is_deleted: boolean;
  created_at: string;
}
