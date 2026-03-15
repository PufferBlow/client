import { useCallback, useMemo, useRef, useState } from "react";
import type { Message } from "../../models";
import type { ComposerAttachmentPreview } from "./types";

type UseDashboardComposerOptions = {
  persistedChannelId: string | null | undefined;
  getMessageDraft: (channelId: string) => string;
  setMessageDraft: (channelId: string, draft: string) => void;
  clearMessageDraft: (channelId: string) => void;
  serverInfo: any;
  normalizeExtensions: (extensions?: string[] | null) => string[];
};

export function useDashboardComposer({
  persistedChannelId,
  getMessageDraft,
  setMessageDraft,
  clearMessageDraft,
  serverInfo,
  normalizeExtensions,
}: UseDashboardComposerOptions) {
  const [currentVoiceChannel, setCurrentVoiceChannel] = useState<{
    channelId: string;
    channelName: string;
    participants: number;
  } | null>(null);
  const [messageInput, setMessageInput] = useState(() => {
    if (persistedChannelId) {
      return getMessageDraft(persistedChannelId);
    }
    return "";
  });
  const [messageAttachments, setMessageAttachments] = useState<File[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const dashboardRef = useRef<HTMLDivElement>(null);
  const messageInputBarRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const serverDropdownRef = useRef<HTMLDivElement>(null);
  const cachedTextareaHeightRef = useRef(24);
  const draftPersistTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingDraftRef = useRef<{ channelId: string; message: string } | null>(null);

  const uploadPolicy = useMemo(() => {
    const imageExtensions = normalizeExtensions(serverInfo?.allowed_image_types);
    const videoExtensions = normalizeExtensions(serverInfo?.allowed_video_types);
    const audioExtensions = normalizeExtensions(serverInfo?.allowed_audio_types);
    const fileExtensions = normalizeExtensions(serverInfo?.allowed_file_types);
    const allExtensions = [...imageExtensions, ...videoExtensions, ...audioExtensions, ...fileExtensions];

    return {
      maxMessageLength: serverInfo?.max_message_length ?? null,
      maxTotalAttachmentSizeMb: serverInfo?.max_total_attachment_size ?? null,
      maxSizesByCategory: {
        image: serverInfo?.max_image_size ?? null,
        video: serverInfo?.max_video_size ?? null,
        audio: serverInfo?.max_audio_size ?? null,
        file: serverInfo?.max_file_size ?? null,
      },
      imageExtensions,
      videoExtensions,
      audioExtensions,
      fileExtensions,
      allExtensions,
      acceptAttribute: allExtensions.length > 0 ? allExtensions.map((extension) => `.${extension}`).join(",") : undefined,
    };
  }, [normalizeExtensions, serverInfo]);

  const composerAttachmentPreviews = useMemo<ComposerAttachmentPreview[]>(
    () =>
      messageAttachments.map((file) => ({
        file,
        kind: file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
            ? "video"
            : "file",
        url: file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : undefined,
      })),
    [messageAttachments],
  );

  const composerAttachmentSummary = useMemo(() => {
    const totalBytes = messageAttachments.reduce((sum, file) => sum + file.size, 0);
    return {
      count: messageAttachments.length,
      formattedSize:
        totalBytes >= 1024 * 1024
          ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.max(1, Math.round(totalBytes / 1024))} KB`,
    };
  }, [messageAttachments]);

  const persistDraftForChannel = useCallback(
    (channelId: string, message: string) => {
      const normalizedMessage = message.trim().length === 0 ? "" : message;
      if (normalizedMessage) {
        setMessageDraft(channelId, message);
      } else {
        clearMessageDraft(channelId);
      }
      pendingDraftRef.current = null;
    },
    [clearMessageDraft, setMessageDraft],
  );

  const cancelPendingDraftPersistence = useCallback(() => {
    if (draftPersistTimeoutRef.current) {
      clearTimeout(draftPersistTimeoutRef.current);
      draftPersistTimeoutRef.current = null;
    }
    pendingDraftRef.current = null;
  }, []);

  const flushPendingDraftPersistence = useCallback(() => {
    if (draftPersistTimeoutRef.current) {
      clearTimeout(draftPersistTimeoutRef.current);
      draftPersistTimeoutRef.current = null;
    }
    if (pendingDraftRef.current) {
      persistDraftForChannel(pendingDraftRef.current.channelId, pendingDraftRef.current.message);
    }
  }, [persistDraftForChannel]);

  const scheduleDraftPersistence = useCallback(
    (channelId: string, message: string) => {
      pendingDraftRef.current = { channelId, message };
      if (draftPersistTimeoutRef.current) {
        clearTimeout(draftPersistTimeoutRef.current);
      }

      draftPersistTimeoutRef.current = setTimeout(() => {
        if (!pendingDraftRef.current) {
          return;
        }

        persistDraftForChannel(pendingDraftRef.current.channelId, pendingDraftRef.current.message);
        draftPersistTimeoutRef.current = null;
      }, 250);
    },
    [persistDraftForChannel],
  );

  const resizeMessageComposer = useCallback(() => {
    const textarea = messageInputRef.current;
    if (!textarea) {
      return;
    }

    const minHeight = 24;
    const maxHeight = 200;

    requestAnimationFrame(() => {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const boundedHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      const shouldScroll = scrollHeight > maxHeight;

      if (
        Math.abs(boundedHeight - cachedTextareaHeightRef.current) <= 1 &&
        textarea.style.overflowY === (shouldScroll ? "auto" : "hidden")
      ) {
        textarea.style.height = `${boundedHeight}px`;
        return;
      }

      textarea.style.overflowY = shouldScroll ? "auto" : "hidden";
      textarea.style.height = `${boundedHeight}px`;
      cachedTextareaHeightRef.current = boundedHeight;
    });
  }, []);

  return {
    currentVoiceChannel,
    setCurrentVoiceChannel,
    messageInput,
    setMessageInput,
    messageAttachments,
    setMessageAttachments,
    isSendingMessage,
    setIsSendingMessage,
    replyTarget,
    setReplyTarget,
    isEmojiPickerOpen,
    setIsEmojiPickerOpen,
    dashboardRef,
    messageInputBarRef,
    messageInputRef,
    fileInputRef,
    messagesContainerRef,
    serverDropdownRef,
    uploadPolicy,
    composerAttachmentPreviews,
    composerAttachmentSummary,
    cancelPendingDraftPersistence,
    flushPendingDraftPersistence,
    scheduleDraftPersistence,
    resizeMessageComposer,
  };
}
