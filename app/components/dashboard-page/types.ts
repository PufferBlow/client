import type { Channel, Message } from "../../models";

export interface DisplayUser {
  id: string;
  username: string;
  avatar?: string;
  banner?: string;
  accentColor?: string;
  bannerColor?: string;
  customStatus?: string;
  externalLinks?: { platform: string; url: string }[];
  status: "online" | "idle" | "afk" | "offline" | "dnd";
  bio?: string;
  joinedAt: string;
  originServer?: string;
  roles: string[];
  activity?: {
    type: "playing" | "listening" | "watching" | "streaming";
    name: string;
    details?: string;
  };
  mutualServers?: number;
  mutualFriends?: number;
  badges?: string[];
}

export interface ComposerAttachmentPreview {
  file: File;
  kind: "image" | "video" | "file";
  url?: string;
}

export type UploadCategory = "image" | "video" | "audio" | "file";

export const normalizeExtensions = (extensions?: string[] | null): string[] =>
  (extensions ?? [])
    .map((extension) => extension.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean);

export const getAttachmentCategory = (
  file: File,
  policy: {
    imageExtensions: string[];
    videoExtensions: string[];
    audioExtensions: string[];
  },
): UploadCategory => {
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/^\./, "") || "";

  if (policy.imageExtensions.includes(extension) || file.type.startsWith("image/")) {
    return "image";
  }
  if (policy.videoExtensions.includes(extension) || file.type.startsWith("video/")) {
    return "video";
  }
  if (policy.audioExtensions.includes(extension) || file.type.startsWith("audio/")) {
    return "audio";
  }
  return "file";
};

export const groupMessagesByAuthor = (messages: Message[]) => {
  if (messages.length === 0) {
    return [] as Message[][];
  }

  const groups: Message[][] = [];
  let currentGroup: Message[] = [];

  messages.forEach((message, index) => {
    const messageTime = new Date(message.sent_at);

    if (currentGroup.length === 0) {
      currentGroup = [message];
    } else {
      const prevMessageTime = new Date(currentGroup[currentGroup.length - 1].sent_at);
      const timeDiff = (messageTime.getTime() - prevMessageTime.getTime()) / 1000;
      if (message.sender_user_id === currentGroup[0].sender_user_id && timeDiff <= 30) {
        currentGroup.push(message);
      } else {
        groups.push(currentGroup);
        currentGroup = [message];
      }
    }

    if (index === messages.length - 1) {
      groups.push(currentGroup);
    }
  });

  return groups;
};
