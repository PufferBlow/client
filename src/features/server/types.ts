/** Public `GET /system/server-info` payload (fields the client uses). */
export interface ServerInfo {
  server_id: string;
  server_name: string;
  server_description: string | null;
  version: string;
  avatar_url: string | null;
  banner_url: string | null;
  /** `image` is an upload; anything else is the default art the look replaces. */
  avatar_kind?: string | null;
  banner_kind?: string | null;
  accent_color?: string | null;
  members_count: number | null;
  online_members: number | null;
  is_private: boolean;
  max_message_length: number | null;
  max_total_attachment_size: number | null;
  welcome_message?: string | null;
  /** How the owner chose the server to look; each part is null until chosen (then it comes from the server id). */
  look?: { icon_style: string | null; tone: string | null; tone2: string | null; banner_pattern: string | null };
  allowed_image_types?: string[] | null;
  allowed_video_types?: string[] | null;
  allowed_file_types?: string[] | null;
  allowed_sticker_types?: string[] | null;
  allowed_gif_types?: string[] | null;
  /** Upload limits, in MB. */
  max_image_size?: number | null;
  max_video_size?: number | null;
  max_sticker_size?: number | null;
  max_gif_size?: number | null;
}
