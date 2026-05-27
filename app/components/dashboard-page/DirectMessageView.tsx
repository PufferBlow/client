/**
 * Direct-message chat surface rendered in the main pane when the
 * user opens a DM from the Friends panel.
 *
 * Visual style mirrors the channel chat surface — same scrolling
 * message list rhythm, grouped messages with avatar + username +
 * timestamp header, and a composer wrapped in the same
 * rounded-xl bordered surface with the "Enter to send · Shift+Enter
 * for newline · char counter" footer. Layout decisions intentionally
 * track DashboardPage's channel branch (not extracted into a shared
 * component yet — that's a real refactor; this rewrite just makes
 * the surfaces look like they belong to the same product).
 *
 * Composer affordances (matches the channel composer at parity):
 *   * "+" upload picker — image / video / audio / file. Files are
 *     queued in `pendingAttachments` and shown as chips above the
 *     textarea. On send, each file is uploaded through the storage
 *     endpoint and the resulting URLs are attached to the DM's
 *     `attachments` list (the server's DM wire surface accepts a
 *     list of URL strings, not multipart). If the instance hasn't
 *     enabled non-owner uploads, the storage endpoint 403s and the
 *     user gets a clear "this instance doesn't allow DM
 *     attachments" message instead of a silent failure.
 *   * Emoji picker — same component as the channel composer. Emoji
 *     selections are inserted into the draft; GIF selections are
 *     appended as markdown image syntax (`![title](url)`) so the
 *     DM renderer's existing image handling picks them up (same
 *     pattern channels use today, no new wire shape needed).
 *
 * Right-click context menu on messages — a subset of the channel
 * menu. DMs don't carry reactions or threaded replies, so the rows
 * shown are: Copy Message, Copy Message ID, Delete (own messages
 * only), Report Message. Delete and Report require server endpoints
 * that don't exist yet for DMs; until they do, the menu items
 * surface a toast explaining the action will land alongside the
 * server-side support. Keeping the menu wired now means the UI
 * doesn't need re-plumbing when the endpoints ship.
 *
 * Federation: the underlying `/api/v1/dms/messages` and
 * `/api/v1/dms/send` endpoints accept a `peer` value that can be a
 * local user_id, a username, an actor URI, or `user@instance`. We
 * pass the friend's local-DB `user_id` (which the server side will
 * resolve through `ActivityPubManager._resolve_peer` — for shadow
 * users that round-trips out to the remote actor on first send,
 * cached afterwards).
 *
 * Realtime: this iteration polls every 5 seconds via react-query's
 * `refetchInterval`. The global WS doesn't carry DM events today —
 * once it does, swap the poll for an in-memory append fed by the
 * WS handler. The component interface here doesn't change.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  editDirectMessage,
  loadDirectMessages,
  sendDirectMessage,
  type DirectMessagePayload,
} from "../../services/activitypub";
import {
  createFallbackAvatarUrl,
  createFullUrl,
  getAuthTokenFromCookies,
  getHostPortFromCookies,
  getHostPortFromStorage,
  useCurrentUserProfile,
} from "../../services/user";
import { createApiClient } from "../../services/apiClient";
import { useNetworkStatus } from "../../services/networkStatus";
import { EmojiPicker } from "../EmojiPicker";
import { MessageContextMenu } from "../MessageContextMenu";
import { MarkdownRenderer } from "../MarkdownRenderer";
import { MessageEmbeds } from "../MessageEmbeds";
import { AttachmentGrid } from "../AttachmentBubble";
import { ProgressiveImage } from "../ui/ProgressiveImage";
import { EditedTag } from "../EditedTag";
import { InlineMessageEditor } from "../InlineMessageEditor";
import { MessageReplyContext } from "../MessageReplyContext";
import {
  buildReplyMessageBody,
  findReplyParent,
  parseReplyContext,
} from "../../utils/replyContext";
import type { MessageAttachment } from "../../models/Message";
import type { ShowToast } from "../Toast";

interface DirectMessageViewProps {
  /** The friend's local-DB user_id (or shadow user_id for federated).
   *  Used as the `peer` value the server resolves. */
  peerUserId: string;
  /** Pre-formatted handle for the header — just the username now
   *  (the `@host` suffix is intentionally dropped at the formatter
   *  level so local and federated friends look identical in the UI). */
  peerHandle: string;
  /** Hydrated `users.avatar_url` for the friend, plumbed through
   *  from the Friends panel row. Null/empty → header falls back
   *  to a DiceBear identicon keyed on `peerHandle`. */
  peerAvatarUrl?: string | null;
  /** Back affordance — clears the selection in the parent so the
   *  user lands back on the DM "no conversation open" placeholder. */
  onBack: () => void;
  /** Shared toast — used for upload failures, copy confirmations,
   *  and the "not yet implemented" notices for actions that need
   *  server endpoints that haven't shipped yet (delete / report
   *  on DMs). */
  showToast: ShowToast;
}

const POLL_INTERVAL_MS = 5000;
const MESSAGES_PER_PAGE = 50;
const MAX_MESSAGE_LENGTH = 4000;
const GROUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Group consecutive messages from the same sender within a 5-min
 * window — same heuristic the channel chat uses so the visual
 * cadence (one avatar per "burst") is identical.
 */
function groupMessages(
  messages: DirectMessagePayload[],
): DirectMessagePayload[][] {
  const groups: DirectMessagePayload[][] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (!last) {
      groups.push([msg]);
      continue;
    }
    const head = last[0];
    const sameSender =
      (msg.sender_user_id || msg.sender_id) ===
      (head.sender_user_id || head.sender_id);
    const headTs = head.sent_at ? new Date(head.sent_at).getTime() : 0;
    const msgTs = msg.sent_at ? new Date(msg.sent_at).getTime() : 0;
    const withinWindow =
      headTs && msgTs && Math.abs(msgTs - headTs) <= GROUP_WINDOW_MS;
    if (sameSender && withinWindow) {
      last.push(msg);
    } else {
      groups.push([msg]);
    }
  }
  return groups;
}

/**
 * Coerce the DM payload's loosely-typed `attachments` field into the
 * `MessageAttachment` shape the channel side uses with `AttachmentGrid`.
 *
 * DM wire surface: `attachments` is `list[str]` (URLs only — the
 * server doesn't carry filenames or MIME types out for DMs today).
 * Channel wire surface: a typed object with `url / filename / type /
 * size / lqip_url`. To keep one shared `AttachmentGrid` between the
 * two surfaces we synthesize the missing fields from the URL:
 *
 *   * `filename` ← the last path segment of the URL (strip query)
 *   * `type` ← guess from the filename extension; falls back to
 *     `application/octet-stream` so the grid routes the file to its
 *     generic-document chip rather than the image lightbox
 *   * `size` ← `0` (unknown — the chip renders without a byte count)
 *
 * Tolerant of either shape: if the server starts returning the typed
 * object on the wire (planned alongside the DM upload work), the
 * branch passes the row straight through unchanged.
 */
function normalizeDmAttachments(
  raw: unknown[] | undefined,
): MessageAttachment[] {
  if (!raw || raw.length === 0) return [];
  return raw.map((entry): MessageAttachment => {
    if (typeof entry === "string") {
      const url = entry;
      const lastSegment = url.split("?")[0].split("/").pop() || "file";
      const ext = lastSegment.includes(".")
        ? lastSegment.slice(lastSegment.lastIndexOf(".") + 1).toLowerCase()
        : "";
      const type = (() => {
        if (["png", "jpg", "jpeg", "gif", "webp", "avif"].includes(ext))
          return `image/${ext === "jpg" ? "jpeg" : ext}`;
        if (["mp4", "webm", "mov", "mkv"].includes(ext))
          return `video/${ext === "mov" ? "quicktime" : ext}`;
        if (["mp3", "wav", "flac", "ogg", "m4a"].includes(ext))
          return `audio/${ext === "m4a" ? "mp4" : ext}`;
        return "application/octet-stream";
      })();
      return {
        url,
        filename: lastSegment,
        type,
        size: 0,
      };
    }
    // Object shape — trust the server. Spread is safe because
    // `MessageAttachment` is a flat record.
    const obj = entry as Partial<MessageAttachment>;
    return {
      url: obj.url || "",
      filename: obj.filename || "attachment",
      type: obj.type || "application/octet-stream",
      size: obj.size ?? 0,
      lqip_url: obj.lqip_url ?? null,
    };
  });
}

interface PendingAttachment {
  /** Stable id for React keys + chip removal. */
  id: string;
  file: File;
  /** Object-URL preview for images; null for other types. Revoked
   *  when the attachment is removed or the component unmounts so we
   *  don't leak blob URLs across many DM threads. */
  previewUrl: string | null;
}

interface DmContextMenuState {
  position: { x: number; y: number };
  message: DirectMessagePayload;
}

export function DirectMessageView({
  peerUserId,
  peerHandle,
  peerAvatarUrl,
  onBack,
  showToast,
}: DirectMessageViewProps) {
  const hostPort =
    (typeof window !== "undefined" &&
      (getHostPortFromStorage() || getHostPortFromCookies())) ||
    undefined;
  const authToken =
    (typeof window !== "undefined" && getAuthTokenFromCookies()) || undefined;
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUserProfile();

  const messagesQueryKey = ["dms", "messages", peerUserId] as const;

  const messagesQuery = useQuery({
    queryKey: messagesQueryKey,
    queryFn: async () => {
      if (!hostPort || !authToken) {
        throw new Error("Not signed in.");
      }
      const response = await loadDirectMessages(
        authToken,
        peerUserId,
        1,
        MESSAGES_PER_PAGE,
        hostPort,
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to load messages.");
      }
      return response.data;
    },
    refetchInterval: POLL_INTERVAL_MS,
    enabled: !!hostPort && !!authToken && !!peerUserId,
  });

  const sendMutation = useMutation({
    mutationFn: async (args: {
      text: string;
      // Typed attachment objects with MIME/filename hints so the
      // renderer can pick the right bubble at read time (images
      // render as image bubbles, videos as video bubbles, etc).
      // The previous URL-only shape forced the renderer to guess
      // from the URL extension — broke for hashed storage URLs.
      attachments: Array<{ url: string; filename: string; type: string; size: number }>;
      stickerIds?: string[];
    }) => {
      if (!hostPort || !authToken) throw new Error("Not signed in.");
      const response = await sendDirectMessage(
        {
          auth_token: authToken,
          peer: peerUserId,
          message: args.text,
          attachments: args.attachments.length > 0 ? args.attachments : undefined,
          sticker_ids:
            args.stickerIds && args.stickerIds.length > 0 ? args.stickerIds : undefined,
        },
        hostPort,
      );
      if (!response.success) {
        throw new Error(response.error || "Failed to send message.");
      }
      return response.data;
    },
    onSuccess: () => {
      // Refetch immediately — the polling cycle would catch the
      // new message in <=5s, but we want the round-trip to feel
      // tight. No optimistic insert because the server's response
      // doesn't carry the final message_id on the wire today.
      void queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
  });

  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [uploadPickerOpen, setUploadPickerOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [contextMenu, setContextMenu] = useState<DmContextMenuState | null>(null);
  // When the user opens the emoji picker from a message's hover
  // cluster (the "Add reaction" smiley), we stash the target message
  // id here so the picker's onSelect path knows it's a reaction
  // intent rather than a "insert into draft" intent. Same convention
  // the channel composer uses with `reactionTargetRef`.
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  // Tracks which group's hover cluster is currently visible. Same
  // belt-and-braces pattern the channel chat uses — Tailwind's
  // ``group-hover:opacity-100`` is the primary, this state is the
  // backup for environments where pointer events get intercepted
  // by parent containers.
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  // Which DM message is being edited inline. Null = no editor open.
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  // Reply target — the message being replied to. Drives the slim
  // reply pill above the composer (mirrors the channel chat's
  // pill exactly) and the markdown blockquote that gets prepended
  // to the body on send. Clearing it cancels the reply.
  const [replyTarget, setReplyTarget] = useState<DirectMessagePayload | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const uploadPickerRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const messages = messagesQuery.data?.messages ?? [];
  const groups = useMemo(() => groupMessages(messages), [messages]);

  // Auto-scroll to bottom on new messages — same near-bottom
  // heuristic the channel chat uses so the user doesn't get
  // yanked down while reading older messages.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // Auto-resize the composer textarea on input (cap at ~6 lines so
  // it never eats the message list). Mirrors the channel composer's
  // `resizeMessageComposer` behaviour at a smaller scale.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(ta.scrollHeight, 160);
    ta.style.height = `${next}px`;
  }, [draft]);

  // Close the upload picker on outside-click — same pattern as the
  // channel composer's upload menu.
  useEffect(() => {
    if (!uploadPickerOpen) return;
    const onClickAway = (e: MouseEvent) => {
      if (
        uploadPickerRef.current &&
        !uploadPickerRef.current.contains(e.target as Node)
      ) {
        setUploadPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [uploadPickerOpen]);

  // Revoke object URLs on unmount + when individual attachments
  // are removed so blob URLs don't pile up across many DM threads.
  useEffect(() => {
    return () => {
      pendingAttachments.forEach((att) => {
        if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
      });
    };
    // intentionally only on unmount — per-attachment cleanup happens
    // in handleRemoveAttachment below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilesPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    setPendingAttachments((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : null,
      })),
    ]);
  };

  const handleRemoveAttachment = (id: string) => {
    setPendingAttachments((prev) => {
      const removed = prev.find((p) => p.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  /**
   * Upload one file via the storage endpoint and return the URL.
   * Surfaces a clear toast on 403 (instance hasn't enabled non-
   * owner uploads) so the user isn't left guessing why their
   * attachment didn't go through.
   */
  /**
   * Upload one file via the storage endpoint and return the typed
   * attachment dict (`{url, filename, type, size}`) for inclusion
   * in the DM payload.
   *
   * Returns the FULL response shape — not just the URL — so the
   * renderer downstream has the MIME hint it needs to pick the
   * right bubble. The previous URL-only return was the root cause
   * of "images render as a generic file" in DMs: the storage URL
   * `/storage/<hash>` has no extension for the client renderer to
   * sniff, so without `type` riding along it fell through to the
   * default "application/octet-stream" bucket.
   */
  const uploadOne = async (
    file: File,
  ): Promise<{ url: string; filename: string; type: string; size: number } | null> => {
    if (!hostPort || !authToken) return null;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("directory", "uploads");
    try {
      const apiClient = createApiClient(hostPort);
      const response = await apiClient.post<{
        status_code: number;
        url: string;
        filename?: string;
        type?: string;
        size?: number;
      }>(
        `/api/v1/storage/upload?auth_token=${encodeURIComponent(authToken)}`,
        formData,
      );
      if (!response.success || !response.data?.url) {
        const msg = response.error || "Upload failed.";
        if (/privilege|not allowed|403/i.test(msg)) {
          showToast({
            message: "This instance hasn't enabled DM file attachments.",
            tone: "error",
            category: "system",
          });
        } else {
          showToast({
            message: `Couldn't upload ${file.name}: ${msg}`,
            tone: "error",
            category: "system",
          });
        }
        return null;
      }
      return {
        url: response.data.url,
        // Server-known filename / MIME / size are populated when
        // the storage manager could parse them. Defensive fallback
        // to the File object's own fields keeps the typed shape
        // intact on the rare case the server skipped enrichment.
        filename: response.data.filename || file.name,
        type: response.data.type || file.type || "application/octet-stream",
        size: response.data.size ?? file.size ?? 0,
      };
    } catch (err) {
      showToast({
        message:
          err instanceof Error
            ? `Couldn't upload ${file.name}: ${err.message}`
            : `Couldn't upload ${file.name}.`,
        tone: "error",
        category: "system",
      });
      return null;
    }
  };

  const handleSend = async () => {
    if (sendMutation.isPending || isUploading) return;
    const text = draft.trim();
    if (!text && pendingAttachments.length === 0) return;

    // Upload pending files first; bail if any fail (the upload helper
    // already surfaced a toast). Returned objects carry the typed
    // `{url, filename, type, size}` shape so the server can persist
    // the MIME hint for the renderer to use on read.
    let attachmentObjects: Array<{ url: string; filename: string; type: string; size: number }> = [];
    if (pendingAttachments.length > 0) {
      setIsUploading(true);
      try {
        const results = await Promise.all(
          pendingAttachments.map((p) => uploadOne(p.file)),
        );
        if (results.some((r) => r === null)) {
          setIsUploading(false);
          return;
        }
        attachmentObjects = results as Array<{ url: string; filename: string; type: string; size: number }>;
      } finally {
        setIsUploading(false);
      }
    }

    // Reply encoding: when a reply target is set, prepend the
    // standard markdown blockquote header via the SHARED helper
    // (`buildReplyMessageBody` in utils/replyContext) so the wire
    // shape matches what channel messages emit. The reading-side
    // `parseReplyContext` then renders the rich reply card
    // identically across surfaces.
    const replyAuthor =
      replyTarget?.sender_username ||
      replyTarget?.username ||
      (replyTarget?.sender_user_id === peerUserId ? peerHandle : undefined) ||
      "Unknown User";
    const outgoingBody = replyTarget
      ? buildReplyMessageBody(text, {
          message: replyTarget.message || "",
          author: replyAuthor,
        })
      : text;

    sendMutation.mutate(
      { text: outgoingBody, attachments: attachmentObjects },
      {
        onSuccess: () => {
          // Clear preview URLs only after a successful send so the
          // chips don't blank out mid-flight on errors.
          pendingAttachments.forEach((p) => {
            if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
          });
          setPendingAttachments([]);
          // Clear the reply target so the pill disappears and
          // future sends are not interpreted as replies.
          setReplyTarget(null);
        },
      },
    );
    setDraft("");
  };

  // Device-level offline gate. When false, the send button is
  // disabled and an inline hint replaces the "Enter to send"
  // helper. We do NOT queue messages — the goal is honesty:
  // pretending a send succeeded when the request can't even leave
  // the device is the worst possible UX.
  const isOnline = useNetworkStatus();

  const canSend =
    isOnline &&
    !sendMutation.isPending &&
    !isUploading &&
    (draft.trim().length > 0 || pendingAttachments.length > 0);

  const handleEmojiSelect = (emoji: string) => {
    if (reactionTargetId) {
      // Reaction intent — the user clicked the smiley on a specific
      // message's hover cluster. DM reactions aren't a server feature
      // yet, so surface an honest "coming soon" toast instead of a
      // silent no-op. The UI plumbing stays in place so this lights
      // up the moment the endpoint lands.
      showToast({
        message: "DM reactions will land alongside the server endpoint.",
        tone: "warning",
        category: "system",
      });
      setReactionTargetId(null);
      setIsEmojiPickerOpen(false);
      return;
    }
    setDraft((prev) => prev + emoji);
    setIsEmojiPickerOpen(false);
    // Restore focus to the textarea so the user can keep typing.
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  /**
   * Start a reply: set the target and focus the textarea. The reply
   * pill above the composer renders from this state; the actual
   * markdown blockquote is built on send via ``buildReplyMessageBody``
   * (the channel side uses the same helper, so wire-level encoding
   * is identical). Replaces the older prefix-into-draft helper —
   * the user shouldn't have to delete a quote block by hand to
   * back out of a reply.
   */
  const startReply = (msg: DirectMessagePayload) => {
    setReplyTarget(msg);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  /**
   * Send a sticker as its own DM. If the smiley was clicked from a
   * message's hover cluster (reactionTargetId is set), we treat it
   * as a reaction intent instead — but DM reactions don't have a
   * server endpoint yet, so we fall through to the existing
   * "coming soon" toast in handleEmojiSelect's reaction branch.
   */
  const handleStickerSelect = (sticker: { sticker_id: string; alias: string | null; display_name: string }) => {
    if (reactionTargetId) {
      // Same "coming soon" path as emoji/GIF reactions on DMs.
      showToast({
        message: "DM reactions will land alongside the server endpoint.",
        tone: "warning",
        category: "system",
      });
      setReactionTargetId(null);
      setIsEmojiPickerOpen(false);
      return;
    }
    sendMutation.mutate(
      { text: "", attachments: [], stickerIds: [sticker.sticker_id] },
      {
        onError: () => {
          showToast({
            message: "Couldn't send sticker.",
            tone: "error",
            category: "system",
          });
        },
      },
    );
    setIsEmojiPickerOpen(false);
  };

  const handleGifSelect = (gif: { url: string; title: string }) => {
    if (reactionTargetId) {
      // The hover-cluster smiley opens the picker on the emoji tab,
      // but the user can still flip to GIFs. Treat that the same way
      // as an emoji reaction intent — there's no concept of "GIF
      // reaction" today, so the toast covers both cases.
      showToast({
        message: "DM reactions will land alongside the server endpoint.",
        tone: "warning",
        category: "system",
      });
      setReactionTargetId(null);
      setIsEmojiPickerOpen(false);
      return;
    }
    // Same shape the channel composer uses for GIFs — markdown image
    // syntax appended as a separate line. The DM renderer picks it
    // up the same way channel rendering does (markdown → <img>).
    const snippet = `\n![${gif.title}](${gif.url})\n`;
    setDraft((prev) => (prev ? prev + snippet : snippet.trimStart()));
    setIsEmojiPickerOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  /**
   * Persist an inline DM edit. Same flow as the channel side —
   * PATCH the body, patch the local message cache with the
   * post-edit shape so the row updates without waiting for the
   * next poll.
   */
  const handleSaveDmEdit = async (messageId: string, newBody: string) => {
    if (!hostPort || !authToken) {
      showToast({
        message: "You don't appear to be signed in.",
        tone: "error",
        category: "system",
      });
      return;
    }
    try {
      const response = await editDirectMessage(authToken, messageId, newBody, hostPort);
      if (!response.success || !response.data) {
        showToast({
          message: response.error || "Couldn't save the edit.",
          tone: "error",
          category: "system",
        });
        return;
      }
      // Patch the react-query cache directly so the message row
      // re-renders with the new body + edit metadata immediately.
      const patchData = response.data;
      queryClient.setQueryData(messagesQueryKey, (old: typeof messagesQuery.data | undefined) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.map((m) =>
            m.message_id === messageId
              ? {
                  ...m,
                  message: patchData.message,
                  edit_count: patchData.edit_count,
                  last_edited_at: patchData.last_edited_at,
                }
              : m,
          ),
        };
      });
      setEditingMessageId(null);
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Couldn't save the edit.",
        tone: "error",
        category: "system",
      });
    }
  };

  /**
   * Scroll the message list to a specific DM message + briefly
   * highlight it. Mirrors the channel's `scrollToMessage` helper:
   * looks up the row by its `dm-msg-<id>` anchor, smooth-scrolls
   * into view, then toggles a one-shot ring/bg highlight that
   * fades after ~1.6s. Used by the reply-context strip's
   * "jump to original" affordance.
   */
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const scrollToDmMessage = (messageId: string) => {
    const el = document.getElementById(`dm-msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(messageId);
    window.setTimeout(() => {
      setHighlightedMessageId((current) =>
        current === messageId ? null : current,
      );
    }, 1600);
  };

  /**
   * Resolve the parent message's avatar URL for the reply card.
   * DM payloads carry `sender_avatar_url` directly (server-hydrated
   * by `_hydrate_messages`); we route through `createFullUrl` so
   * server-relative paths resolve against the active instance,
   * and fall back to the peer's avatar (when the parent is from
   * the peer) and finally a DiceBear identicon. Same fallback
   * chain the group-head avatar uses — keeps the reply card and
   * the speaker row in agreement on every render.
   */
  const resolveDmReplyAvatar = (
    parent: DirectMessagePayload | null,
    fallbackUsername: string,
  ): string => {
    if (parent) {
      const fromMsg = createFullUrl(parent.sender_avatar_url ?? undefined);
      if (fromMsg) return fromMsg;
      const parentSender = parent.sender_user_id || parent.sender_id || "";
      if (parentSender === peerUserId) {
        const fromPeer = createFullUrl(peerAvatarUrl ?? undefined);
        if (fromPeer) return fromPeer;
      }
    }
    return createFallbackAvatarUrl(fallbackUsername || "user");
  };

  // ── Context menu handlers ───────────────────────────────────────
  const closeContextMenu = () => setContextMenu(null);

  const handleCopyMessage = (msg: DirectMessagePayload) => {
    void navigator.clipboard.writeText(msg.message ?? "");
    showToast({
      message: "Message copied to clipboard.",
      tone: "success",
      category: "system",
    });
  };

  const handleCopyMessageId = (msg: DirectMessagePayload) => {
    void navigator.clipboard.writeText(msg.message_id ?? "");
    showToast({
      message: "Message ID copied.",
      tone: "success",
      category: "system",
    });
  };

  const handleDeleteDmMessage = () => {
    // The server doesn't expose a DM-delete endpoint yet. Surfacing
    // an honest "coming soon" toast instead of silently failing keeps
    // the user's expectations calibrated; the menu row stays wired
    // so it lights up automatically when the endpoint lands.
    showToast({
      message: "Deleting DM messages will land alongside the server endpoint.",
      tone: "warning",
      category: "system",
    });
  };

  const handleReportDmMessage = () => {
    showToast({
      message: "Reporting DM messages will land alongside the server endpoint.",
      tone: "warning",
      category: "system",
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header — same height/rhythm as ChatHeader so swapping
          between channel and DM views doesn't shift the composer
          position. Back button on the left + handle + subtitle. */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          title="Back to Friends"
          aria-label="Back to friends list"
          className="rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <img
          src={createFullUrl(peerAvatarUrl ?? undefined) || createFallbackAvatarUrl(peerHandle)}
          alt=""
          className="h-7 w-7 rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] object-cover"
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text)]">
            @{peerHandle}
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)]">
            Direct message
          </div>
        </div>
      </div>

      {/* Message list — same container shape as the channel scroller
          (`flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4
          break-words`) so a DM and a channel feel like the same
          page with a different conversation in it. */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 break-words"
      >
        {messagesQuery.isLoading && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div className="text-[var(--color-text-muted)] text-sm">Loading…</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-[var(--color-text-secondary)]">
              <div className="text-[var(--color-text-muted)] text-sm">No messages yet</div>
              <div className="text-[var(--color-text-muted)] text-xs mt-1">
                This is the beginning of your conversation with @{peerHandle}
              </div>
            </div>
          </div>
        ) : (
          groups.map((group) => {
            const head = group[0];
            // Sender identity comes off the hydrated server fields the
            // DM read path injects (`MessagesManager._hydrate_messages`).
            // We fall back to the older `username` field for caches
            // written by pre-hydration builds, then to the user_id /
            // sender_id, then to the peer info from props as a final
            // safety net (a self-message wouldn't reach this branch
            // since `sender_user_id` matches the viewer, but a
            // misconfigured row shouldn't render as raw UUID). Same
            // resolution order channels use.
            const senderUserId = head.sender_user_id || head.sender_id || "";
            const isFromPeer = senderUserId === peerUserId;
            const displayName =
              head.sender_username ||
              head.username ||
              (isFromPeer ? peerHandle : undefined) ||
              (currentUser?.user_id === senderUserId
                ? currentUser?.username
                : undefined) ||
              senderUserId ||
              "Unknown";
            // Avatar source: hydrated `sender_avatar_url` first
            // (normalised through createFullUrl so relative paths
            // resolve against the active instance), then the peer's
            // hydrated avatar (passed in props from the Friends
            // panel — covers the very first message arriving before
            // the viewer's user-cache catches up), then a DiceBear
            // identicon keyed on the display name. Same fallback
            // chain channels use.
            const avatarFromMsg = createFullUrl(head.sender_avatar_url ?? undefined);
            const avatarFromPeer = isFromPeer
              ? createFullUrl(peerAvatarUrl ?? undefined)
              : undefined;
            const displayAvatar =
              avatarFromMsg ||
              avatarFromPeer ||
              createFallbackAvatarUrl(displayName);
            const displayAvatarLqip = createFullUrl(head.sender_avatar_lqip_url ?? undefined) ?? null;
            const headTs = head.sent_at
              ? new Date(head.sent_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })
              : "";
            // Reply context for the group HEAD message — same
            // pattern channels use: parse the markdown blockquote
            // header at the top of the body, find the parent
            // message in our loaded conversation, build the rich
            // reply card via `MessageReplyContext`. The strip sits
            // ABOVE the avatar+name row so the visual flow reads
            // "this reply targets X" → "speaker says" → "body."
            const headReplyParsed = parseReplyContext(head.message || "");
            const headReplyParent = headReplyParsed
              ? findReplyParent(
                  messages,
                  headReplyParsed.author,
                  headReplyParsed.excerpt,
                  // DMs don't carry a global users-by-id map; the
                  // sender_username on the row is the authoritative
                  // source. Match by walking the messages list.
                  (senderId) => {
                    for (const m of messages) {
                      if ((m.sender_user_id || m.sender_id) === senderId) {
                        return m.sender_username || m.username;
                      }
                    }
                    return undefined;
                  },
                )
              : null;
            const headReplyAvatar = headReplyParsed
              ? resolveDmReplyAvatar(headReplyParent, headReplyParsed.author)
              : null;
            return (
              <React.Fragment key={head.message_id}>
                {/* Reply context strip — sits ABOVE the avatar +
                    username row, indented to align with the
                    message column (not the avatar gutter). Same
                    indentation + DOM ordering as the channel reply
                    strip so the visual cadence matches. */}
                {headReplyParsed && headReplyAvatar !== null && (
                  <div className="px-2 pl-[3.5rem]">
                    <MessageReplyContext
                      author={headReplyParsed.author}
                      excerpt={headReplyParsed.excerpt}
                      parent={
                        // MessageReplyContext expects a Message
                        // type but only reads message_id from
                        // parent. The DM payload's message_id is
                        // the same shape, so we cast through the
                        // structural minimum the component uses.
                        headReplyParent
                          ? ({
                              message_id: headReplyParent.message_id,
                            } as unknown as import("../../models").Message)
                          : null
                      }
                      parentAvatar={headReplyAvatar}
                      onJump={scrollToDmMessage}
                    />
                  </div>
                )}
              <div
                // Mirror the channel row container: `group relative
                // flex items-start space-x-3 px-2 py-1 rounded`. The
                // `group` class is what lets the hover action cluster
                // below fade in only while the pointer is over the
                // row — same convention the channel uses.
                className="group relative flex items-start space-x-3 px-2 py-1 rounded"
                // State-driven hover backup for the action cluster
                // (see the cluster comment for why). Cheap; only
                // fires on mouse boundary crossings, not on every
                // pointer move.
                onMouseEnter={() => setHoveredGroupId(head.message_id)}
                onMouseLeave={() => setHoveredGroupId(null)}
                onContextMenu={(e) => {
                  // Right-clicking anywhere on the group falls back
                  // to opening the menu on the group head, matching
                  // the channel's group-context-menu behaviour.
                  e.preventDefault();
                  setContextMenu({
                    position: { x: e.clientX, y: e.clientY },
                    message: head,
                  });
                }}
              >
                {/* Avatar — 40×40 round with LQIP crossfade via
                    ProgressiveImage, identical to the channel
                    rendering. DiceBear fallback for users whose
                    avatar_url is unset. */}
                <div className="w-10 h-10 rounded-full flex-shrink-0 relative">
                  <ProgressiveImage
                    src={displayAvatar}
                    placeholderSrc={displayAvatarLqip}
                    alt={displayName}
                    wrapperClassName="w-full h-full rounded-full"
                    className="rounded-full"
                    fallback={
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--color-surface-secondary)] text-sm font-semibold text-[var(--color-text)]">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    }
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-[var(--color-text)] font-medium select-text">
                      {displayName}
                    </span>
                    <span className="text-[var(--color-text-secondary)] text-xs select-text">
                      {headTs}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {group.map((msg, msgIndex) => {
                      // Continuation messages (anything after the
                      // group-leading message) get a hover-revealed
                      // timestamp tucked into the empty avatar gutter,
                      // matching the channel chat's pattern (see the
                      // `group/msg` block in DashboardPage).
                      const isContinuation = msgIndex > 0;
                      const msgTime = msg.sent_at
                        ? new Date(msg.sent_at).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })
                        : "";
                      const attachments = normalizeDmAttachments(msg.attachments);
                      // Strip the reply marker block from the body
                      // BEFORE handing to MarkdownRenderer. When a
                      // message starts with `> Replying to @X\n> ...`
                      // the rich reply card (rendered above the
                      // group head, or inline below for continuation
                      // messages) carries that information visually
                      // — re-rendering the raw blockquote underneath
                      // would duplicate it as ugly markdown quote
                      // lines. parseReplyContext returns the body
                      // with the marker peeled off.
                      const parsedMsg = parseReplyContext(msg.message || "");
                      const visibleBody = parsedMsg ? parsedMsg.body : (msg.message || "");
                      // Continuation messages that ARE themselves
                      // replies show their own inline reply strip
                      // (rare — usually only the first message in a
                      // grouping is a reply, but it does happen
                      // when a user replies twice in a row to
                      // different parents).
                      const continuationReplyParent =
                        isContinuation && parsedMsg
                          ? findReplyParent(
                              messages,
                              parsedMsg.author,
                              parsedMsg.excerpt,
                              (senderId) => {
                                for (const m of messages) {
                                  if ((m.sender_user_id || m.sender_id) === senderId) {
                                    return m.sender_username || m.username;
                                  }
                                }
                                return undefined;
                              },
                            )
                          : null;
                      const continuationReplyAvatar =
                        isContinuation && parsedMsg
                          ? resolveDmReplyAvatar(continuationReplyParent, parsedMsg.author)
                          : null;
                      return (
                        <div
                          key={msg.message_id}
                          // `id="dm-msg-..."` mirrors the channel
                          // side's scroll-target anchor convention so
                          // a future deep-link / jump-to-message
                          // feature in DMs picks up the exact same
                          // scroll API without refactoring layouts.
                          id={`dm-msg-${msg.message_id}`}
                          // `group/msg` so the per-message hover
                          // timestamp on continuation rows can light
                          // up independently of the parent group's
                          // hover state — identical class structure
                          // to the channel rows.
                          className="group/msg relative min-w-0"
                          // Per-message right-click target so the
                          // menu's copy / delete / report act on the
                          // specific row the user clicked rather than
                          // the whole group.
                          onContextMenu={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setContextMenu({
                              position: { x: e.clientX, y: e.clientY },
                              message: msg,
                            });
                          }}
                        >
                          {isContinuation && (
                            <span
                              className="pointer-events-none absolute -left-[3.25rem] top-0.5 text-[10px] tabular-nums text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover/msg:opacity-100"
                              aria-hidden="true"
                            >
                              {msgTime}
                            </span>
                          )}
                          {/* Same rendering pipeline as the channel
                              chat: MarkdownRenderer for the body
                              (code blocks, links, lists, inline
                              styling, mentions, emoji aliases),
                              MessageEmbeds for URL-driven inline
                              previews (YouTube, GIPHY, etc.).
                              Replies are not supported on the DM
                              wire surface — `parseReplyContext` is
                              skipped here. */}
                          {editingMessageId === msg.message_id ? (
                            // Inline edit path. Same component the
                            // channel chat uses so the edit affordance
                            // is consistent across surfaces.
                            <InlineMessageEditor
                              initialBody={msg.message || ""}
                              onCancel={() => setEditingMessageId(null)}
                              onSave={async (next) => {
                                await handleSaveDmEdit(msg.message_id, next);
                              }}
                            />
                          ) : (
                            <>
                              {/* Continuation messages that are
                                  themselves replies render their
                                  reply card inline above the body —
                                  same pattern the channel uses for
                                  rare "two replies in a row"
                                  cases. The group head's reply
                                  card was rendered ABOVE the
                                  avatar row already. */}
                              {isContinuation && parsedMsg && continuationReplyAvatar !== null && (
                                <div className="mb-1">
                                  <MessageReplyContext
                                    author={parsedMsg.author}
                                    excerpt={parsedMsg.excerpt}
                                    parent={
                                      continuationReplyParent
                                        ? ({
                                            message_id: continuationReplyParent.message_id,
                                          } as unknown as import("../../models").Message)
                                        : null
                                    }
                                    parentAvatar={continuationReplyAvatar}
                                    onJump={scrollToDmMessage}
                                  />
                                </div>
                              )}
                              <MarkdownRenderer
                                content={visibleBody}
                                className="text-[var(--color-text)]"
                              />
                              <EditedTag
                                count={msg.edit_count ?? 0}
                                at={msg.last_edited_at ?? null}
                              />
                              <MessageEmbeds content={visibleBody} />

                              {attachments.length > 0 && (
                                <AttachmentGrid attachments={attachments} />
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Hover action cluster — small floating card with
                    three buttons (react / reply / more) flush to the
                    top-right of the group. Identical layout and class
                    string as the channel-side cluster so the two
                    surfaces feel like one product.

                    Visibility: ``group-hover:opacity-100`` should
                    handle this on its own, but practice shows it can
                    be defeated by intermediate elements that steal
                    pointer events (the messages-area scroll
                    container, in particular). To be robust we ALSO
                    track hover with React state — same belt-and-
                    braces approach the channel cluster uses (see the
                    ``hoveredMessageId === firstMessage.message_id``
                    branch in DashboardPage). ``z-10`` keeps the
                    cluster above continuation-message hover
                    timestamps and any markdown content with its own
                    stacking context.

                    DM-specific behaviour:
                      - React opens the same EmojiPicker the composer
                        uses; on selection we surface a "coming soon"
                        toast because the server doesn't yet expose
                        per-message reactions for DM rows. The button
                        stays wired so it lights up automatically
                        when the endpoint lands.
                      - Reply inserts a markdown blockquote into the
                        composer draft (`> @user: excerpt\n`) — the
                        same wire-level encoding channels use for
                        replies. Works client-side without server
                        changes; once a typed reply edge exists for
                        DMs we'll swap the prefix-insertion for a
                        proper reply-target state.
                      - More opens the same MessageContextMenu used
                        on right-click, anchored at the cluster
                        button rather than the cursor. */}
                <div
                  className={`absolute -top-3 right-2 z-10 flex items-center gap-0.5 rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-0.5 py-0.5 shadow-[var(--shadow-popover)] transition-opacity group-hover:opacity-100 ${
                    hoveredGroupId === head.message_id ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReactionTargetId(head.message_id);
                      setIsEmojiPickerOpen(true);
                    }}
                    className="pb-icon-btn h-7 w-7 border-0 hover:bg-[var(--color-hover)]"
                    title="Add reaction"
                    aria-label="Add reaction"
                  >
                    <svg
                      className="pb-icon"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                      <line x1="9" y1="9" x2="9.01" y2="9" />
                      <line x1="15" y1="9" x2="15.01" y2="9" />
                      <path d="M19 5v4M17 7h4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Set the reply target — the pill above the
                      // composer renders from this state. Same
                      // pattern the channel chat uses.
                      startReply(head);
                    }}
                    className="pb-icon-btn h-7 w-7 border-0 hover:bg-[var(--color-hover)]"
                    title="Reply"
                    aria-label="Reply"
                  >
                    <svg
                      className="pb-icon -scale-x-100"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <polyline points="9 14 4 9 9 4" />
                      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                      setContextMenu({
                        position: { x: rect.right, y: rect.bottom + 4 },
                        message: head,
                      });
                    }}
                    className="pb-icon-btn h-7 w-7 border-0 hover:bg-[var(--color-hover)]"
                    title="More options"
                    aria-label="Message options"
                  >
                    <svg
                      className="pb-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6h.01M12 12h.01M12 18h.01"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Composer — same wrapper shell as the channel composer
          (`rounded-xl border bg-[var(--color-surface-secondary)]
          px-6 py-4`) with the same footer convention (Enter to
          send · Shift+Enter for newline · char counter). Now with
          the "+" upload picker and emoji button matching the
          channel composer's left-edge controls. */}
      <div className="px-4 pb-4 pt-2">
        {/* Reply pill — slim bar attached to the top edge of the
            composer (rounded-t-xl, border-b-0 so it visually
            connects to the composer beneath). Mirrors the
            channel-side pill verbatim: reply arrow, peer avatar,
            "Replying to NAME", muted excerpt, close X. Cancel
            clears the reply target; the body is plain text again.
            On send, ``buildReplyMessageBody`` prepends the markdown
            blockquote so the wire shape matches what channels
            emit. */}
        {replyTarget && (() => {
          const replySenderId =
            replyTarget.sender_user_id || replyTarget.sender_id || "";
          const replyFromPeer = replySenderId === peerUserId;
          const replyAuthor =
            replyTarget.sender_username ||
            replyTarget.username ||
            (replyFromPeer ? peerHandle : undefined) ||
            (currentUser?.user_id === replySenderId
              ? currentUser?.username
              : undefined) ||
            "Unknown User";
          // Strip any nested reply header off the target body
          // before previewing — see the comment in
          // buildReplyMessageBody for why.
          const parsedTarget = parseReplyContext(replyTarget.message || "");
          const visibleTargetText = parsedTarget
            ? parsedTarget.body
            : (replyTarget.message || "");
          const rawText = visibleTargetText.replace(/\s+/g, " ").trim();
          const PREVIEW_CHAR_CAP = 120;
          const previewText = rawText
            ? rawText.length > PREVIEW_CHAR_CAP
              ? `${rawText.slice(0, PREVIEW_CHAR_CAP).trimEnd()}…`
              : rawText
            : "Attachment-only message";
          // Avatar resolution: server-attached on the message
          // payload first (sender_avatar_url), then the peer's
          // passed-in avatar (covers messages from the peer where
          // hydration may not have populated sender_avatar_url),
          // then DiceBear fallback.
          const replyAvatarSrc =
            createFullUrl(replyTarget.sender_avatar_url ?? undefined) ||
            (replyFromPeer ? createFullUrl(peerAvatarUrl ?? undefined) : null) ||
            createFallbackAvatarUrl(replyAuthor);
          return (
            <div className="flex items-center gap-2 rounded-t-xl border border-b-0 border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-1.5">
              <svg
                className="h-3.5 w-3.5 shrink-0 -scale-x-100 text-[var(--color-text-muted)]"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <polyline points="9 14 4 9 9 4" />
                <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
              </svg>
              <img
                src={replyAvatarSrc}
                alt=""
                className="h-5 w-5 shrink-0 rounded-full object-cover"
              />
              <span className="text-xs font-semibold text-[var(--color-text)] truncate max-w-[10rem]">
                {replyAuthor}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] truncate min-w-0 flex-1">
                {previewText}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setReplyTarget(null);
                }}
                className="shrink-0 rounded-full p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-error)]/15 hover:text-[var(--color-error)]"
                title="Cancel reply"
                aria-label="Cancel reply"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          );
        })()}
        <div
          className={`relative border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-6 py-4 ${
            replyTarget ? "rounded-b-xl border-t-0" : "rounded-xl"
          } ${sendMutation.isPending || isUploading ? "opacity-90" : ""}`}
        >
          {/* Pending attachment chips — same vertical slot the
              channel composer uses, just inside the DM bar. */}
          {/* Attachment previews — matches the channel composer
              layout exactly: card grid with image / video / file
              thumbnail (96×96 area), filename truncated below,
              size + type in muted text, X to remove. Channel uses
              `composerAttachmentPreviews` from useDashboardComposer;
              DMs synthesize the same preview shape inline from
              the local file objects since the DM upload path
              hasn't been hoisted into a shared hook yet. */}
          {pendingAttachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {pendingAttachments.map((att) => {
                const isImage = att.file.type.startsWith("image/");
                const isVideo = att.file.type.startsWith("video/");
                const sizeMb = att.file.size / (1024 * 1024);
                return (
                  <div
                    key={att.id}
                    className="relative bg-[var(--color-surface-secondary)] rounded-lg p-3 border border-[var(--color-border)] group hover:border-[var(--color-border)] transition-colors"
                  >
                    {isImage && att.previewUrl ? (
                      <div className="flex flex-col items-center space-y-2">
                        <img
                          src={att.previewUrl}
                          alt={att.file.name}
                          className="max-w-24 max-h-24 object-cover rounded"
                        />
                        <div className="text-center">
                          <p
                            className="text-xs text-[var(--color-text)] font-medium truncate max-w-24"
                            title={att.file.name}
                          >
                            {att.file.name}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {sizeMb.toFixed(1)}MB
                          </p>
                        </div>
                      </div>
                    ) : isVideo && att.previewUrl ? (
                      <div className="flex flex-col items-center space-y-2">
                        <video
                          src={att.previewUrl}
                          className="max-w-24 max-h-24 rounded object-cover"
                          muted
                          preload="metadata"
                        />
                        <div className="text-center">
                          <p
                            className="text-xs text-[var(--color-text)] font-medium truncate max-w-24"
                            title={att.file.name}
                          >
                            {att.file.name}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {sizeMb.toFixed(1)}MB • Video
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-2 text-center">
                        <svg
                          className="w-12 h-12 text-[var(--color-text-secondary)]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <div>
                          <p
                            className="text-xs text-[var(--color-text)] font-medium truncate max-w-24"
                            title={att.file.name}
                          >
                            {att.file.name}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {sizeMb.toFixed(1)}MB • {att.file.type || "Unknown type"}
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Remove button — matches the channel composer's
                        position + tone exactly. Hidden until hover so
                        the preview chrome stays clean at rest. */}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      title="Remove attachment"
                      aria-label="Remove attachment"
                      className="absolute -top-2 -right-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-error)] text-[var(--color-on-primary)] opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-end gap-3">
            {/* Hidden inputs — one per upload category. All funnel
                through the same `handleFilesPicked`. */}
            <input ref={imageInputRef} type="file" multiple accept="image/*" onChange={handleFilesPicked} className="hidden" />
            <input ref={videoInputRef} type="file" multiple accept="video/*" onChange={handleFilesPicked} className="hidden" />
            <input ref={audioInputRef} type="file" multiple accept="audio/*" onChange={handleFilesPicked} className="hidden" />
            <input ref={fileInputRef} type="file" multiple onChange={handleFilesPicked} className="hidden" />

            {/* "+" upload picker — matches the channel composer's
                anchored categorized menu. */}
            <div className="relative" ref={uploadPickerRef}>
              <button
                type="button"
                onClick={() => setUploadPickerOpen((prev) => !prev)}
                className="pb-icon-btn flex-shrink-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
                disabled={sendMutation.isPending || isUploading}
                title="Attach a file"
                aria-label="Attach a file"
                aria-haspopup="menu"
                aria-expanded={uploadPickerOpen}
              >
                <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              {uploadPickerOpen && (
                <div
                  role="menu"
                  aria-label="Attachment type"
                  className="absolute bottom-full left-0 z-20 mb-2 w-52 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
                >
                  {[
                    { id: "image", label: "Image", sub: "PNG, JPG, GIF…", iconPath: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", ref: imageInputRef },
                    { id: "video", label: "Video", sub: "MP4, WebM, MOV…", iconPath: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z", ref: videoInputRef },
                    { id: "audio", label: "Audio", sub: "MP3, WAV, FLAC…", iconPath: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z", ref: audioInputRef },
                    { id: "file", label: "File", sub: "Anything else", iconPath: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", ref: fileInputRef },
                  ].map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setUploadPickerOpen(false);
                        entry.ref.current?.click();
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                    >
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={entry.iconPath} />
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{entry.label}</span>
                        <span className="block truncate text-xs text-[var(--color-text-muted)]">
                          {entry.sub}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={`Message @${peerHandle}`}
                disabled={sendMutation.isPending || isUploading}
                rows={1}
                maxLength={MAX_MESSAGE_LENGTH}
                className="w-full bg-transparent text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none resize-none h-6 break-words overflow-wrap-anywhere disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Emoji button + picker — uses the same EmojiPicker
                component the channel composer uses, including the
                GIF tab. */}
            <button
              type="button"
              onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
              disabled={sendMutation.isPending || isUploading}
              className={`pb-icon-btn ${
                isEmojiPickerOpen
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)]"
              }`}
              title="Add emoji or GIF"
              aria-label="Add emoji or GIF"
            >
              <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => { void handleSend(); }}
              disabled={!canSend}
              className="pb-icon-btn bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[var(--color-primary)]"
              title={canSend ? "Send message" : "Type a message or attach a file"}
              aria-label="Send message"
            >
              {sendMutation.isPending || isUploading ? (
                <span
                  role="status"
                  aria-label={isUploading ? "Uploading" : "Sending"}
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
              ) : (
                <svg className="pb-icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
            <div className="flex flex-wrap items-center gap-2">
              {/* Offline takes over the helper text slot — the
                  "Enter to send" hint would be misleading when
                  pressing Enter can't actually send anything. */}
              {!isOnline ? (
                <span className="text-[var(--color-error)]">
                  You're offline — sends will fail until you reconnect.
                </span>
              ) : (
                <>
                  <span>Enter to send</span>
                  <span>Shift+Enter for newline</span>
                </>
              )}
              {pendingAttachments.length > 0 && (
                <span>
                  {pendingAttachments.length} attachment{pendingAttachments.length === 1 ? "" : "s"}
                </span>
              )}
              {isUploading && <span>Uploading…</span>}
              {sendMutation.isError && (
                <span className="text-[var(--color-error)]">
                  {sendMutation.error instanceof Error
                    ? sendMutation.error.message
                    : "Send failed"}
                </span>
              )}
            </div>
            <span>
              {draft.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>
        </div>

        {/* Emoji picker — anchored by the composer the same way the
            channel composer anchors it. */}
        <EmojiPicker
          isOpen={isEmojiPickerOpen}
          onClose={() => {
            setIsEmojiPickerOpen(false);
            // Drop any pending reaction intent so the next composer-
            // initiated emoji pick doesn't accidentally fire a
            // reaction toast. Same dismissal contract the channel
            // composer uses.
            setReactionTargetId(null);
          }}
          onEmojiSelect={handleEmojiSelect}
          onGifSelect={handleGifSelect}
          onStickerSelect={handleStickerSelect}
        />
      </div>

      {/* Right-click context menu — subset of the channel options.
          DMs don't carry reactions or threaded replies, so the
          menu shows: Copy Message, Copy Message ID, Delete (own),
          Report Message. Edit / moderation rows are deliberately
          omitted — DMs aren't subject to channel moderator powers
          (they're between two people), and editing isn't supported
          on the wire surface yet. */}
      {contextMenu && (() => {
        const isOwn =
          !!currentUser &&
          (contextMenu.message.sender_user_id === currentUser.user_id ||
            contextMenu.message.sender_id === currentUser.user_id);
        return (
          <MessageContextMenu
            isOpen
            position={contextMenu.position}
            onClose={closeContextMenu}
            onCopyMessage={() => handleCopyMessage(contextMenu.message)}
            onCopyMessageId={() => handleCopyMessageId(contextMenu.message)}
            onReply={() => {
              // Sets the reply target + focuses the composer.
              // The pill above the composer renders from the
              // shared state; on send the body is wrapped via
              // buildReplyMessageBody so the wire shape matches
              // channel replies exactly.
              startReply(contextMenu.message);
              closeContextMenu();
            }}
            onEdit={
              // Edit Message is wired to PATCH /api/v1/dms/messages/{id}.
              // Capability matches Delete — only the original author
              // can edit. Opens the inline editor on the row.
              isOwn
                ? () => {
                    setEditingMessageId(contextMenu.message.message_id);
                    closeContextMenu();
                  }
                : undefined
            }
            canEdit={isOwn}
            onDelete={handleDeleteDmMessage}
            onReportMessage={handleReportDmMessage}
            isSelf={isOwn}
            canDelete={isOwn}
            canReport
          />
        );
      })()}
    </div>
  );
}
