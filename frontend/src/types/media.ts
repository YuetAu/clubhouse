/** Stub types for future RTSP and YouTube media slots. */

export interface RtspStreamInfo {
  slotId: string;
  roomId: string;
  sourceUrl: string;
  label: string | null;
  isActive: boolean;
}

export interface YoutubeShareInfo {
  slotId: string;
  roomId: string;
  videoId: string;
  label: string | null;
}
