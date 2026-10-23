/** Public `GET /system/server-info` payload (fields the client uses). */
export interface ServerInfo {
  server_id: string;
  server_name: string;
  server_description: string | null;
  version: string;
  avatar_url: string | null;
  banner_url: string | null;
  members_count: number | null;
  online_members: number | null;
  is_private: boolean;
  max_message_length: number | null;
  max_total_attachment_size: number | null;
  welcome_message?: string | null;
  /** Upload limits, in MB. */
  max_image_size?: number | null;
  max_video_size?: number | null;
  max_sticker_size?: number | null;
  max_gif_size?: number | null;
}
