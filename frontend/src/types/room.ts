export type RoomRole = "speaker" | "listener" | "viewer";

export type RoomType = "chitchat" | "stage";

export interface Room {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  topic_tags: string[] | null;
  room_type: RoomType;
  is_private: boolean;
  has_password: boolean;
  is_temporary: boolean;
  max_speakers: number;
  owner_id: string | null;
  created_at: string;
  scheduled_at: string | null;
  closed_at: string | null;
  speaker_count: number;
  listener_count: number;
}

export interface Participant {
  peer_id: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  is_anon: boolean;
  is_host: boolean;
  role: RoomRole;
  has_raised_hand: boolean;
  is_muted: boolean;
}
