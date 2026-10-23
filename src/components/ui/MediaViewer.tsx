import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Forward, Hash, Loader2, Send, X, ZoomIn, ZoomOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useChannels } from "../../features/channels/hooks";
import { hasText } from "../../features/channels/types";
import { forwardMessage, peerHandle, type ForwardTarget } from "../../features/dms/api";
import { useConversations } from "../../features/dms/hooks";
import { dmKeys } from "../../features/dms/keys";
import { conversationFor, rememberOutgoing } from "../../features/dms/outgoing";
import { useMyProfile } from "../../features/users/hooks";
import { displayName, downloadFile, formatBytes } from "../../lib/files";
import { classifyAuthError } from "../../utils/authErrors";
import { Avatar } from "../dashboard/Avatar";

export interface ViewerItem {
  /** Absolute URL. */
  href: string;
  filename: string;
  type: string;
  kind: "image" | "video";
}

interface MediaViewerProps {
  /** The message the media belongs to; forwarding sends the whole message. */
  messageId: string;
  items: ViewerItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Who posted it, shown top left. */
  author: { name: string; avatarUrl: string | null };
  sentAt: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.5;
const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

const toolButton =
  "grid h-9 w-9 place-items-center rounded-lg border-0 bg-transparent text-white/80 outline-none transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={toolButton}>
      {children}
    </button>
  );
}

const formatSent = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

/**
 * Full-screen view of a message's images and videos: step through them, zoom and pan an image,
 * download the file, or forward it to a channel. Escape or the close button leaves it.
 */
export function MediaViewer({ messageId, items, index, onIndexChange, onClose, author, sentAt }: MediaViewerProps) {
  const item = items[index];
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [forwarding, setForwarding] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const isImage = item?.kind === "image";

  const go = useCallback(
    (step: number) => {
      onIndexChange((index + step + items.length) % items.length);
    },
    [index, items.length, onIndexChange],
  );

  const changeZoom = useCallback((next: number) => {
    const value = clampZoom(next);
    setZoom(value);
    if (value === MIN_ZOOM) setOffset({ x: 0, y: 0 });
  }, []);

  // Each item starts unzoomed and unpanned.
  const [shownIndex, setShownIndex] = useState(index);
  if (shownIndex !== index) {
    setShownIndex(index);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  useEffect(() => {
    if (forwarding) return; // the dialog owns the keyboard while it is open
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft" && items.length > 1) go(-1);
      else if (event.key === "ArrowRight" && items.length > 1) go(1);
      else if (isImage && (event.key === "+" || event.key === "=")) changeZoom(zoom + ZOOM_STEP);
      else if (isImage && event.key === "-") changeZoom(zoom - ZOOM_STEP);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [forwarding, onClose, go, items.length, isImage, changeZoom, zoom]);

  useEffect(() => {
    if (!notice || downloading) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice, downloading]);

  if (!item) return null;
  const name = displayName(item.filename);

  const download = () => {
    if (downloading) return;
    setDownloading(true);
    setNotice({ text: "Downloading…", tone: "info" });
    downloadFile(item.href, name, {
      onProgress: (loaded, total) =>
        setNotice({ text: total > 0 ? `Downloading… ${Math.round((loaded / total) * 100)}%` : `Downloading… ${formatBytes(loaded)}`, tone: "info" }),
    })
      .then(() => setNotice({ text: "Downloaded", tone: "info" }))
      .catch((error: unknown) => setNotice({ text: classifyAuthError(error, "Couldn't download the file.").message, tone: "error" }))
      .finally(() => setDownloading(false));
  };

  const startDrag = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (zoom === MIN_ZOOM) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  };
  const moveDrag = (event: ReactPointerEvent<HTMLImageElement>) => {
    const start = drag.current;
    if (start) setOffset({ x: start.ox + event.clientX - start.x, y: start.oy + event.clientY - start.y });
  };
  const endDrag = () => {
    drag.current = null;
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Viewing ${name}`} className="fixed inset-0 z-50 flex flex-col bg-black/92 text-white">
      <header className="flex shrink-0 items-center justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={author.name} src={author.avatarUrl} size={36} />
          <div className="min-w-0 leading-tight">
            <p className="m-0 truncate text-sm font-semibold">{author.name}</p>
            <p className="m-0 truncate text-xs text-white/60">
              {formatSent(sentAt)}
              {formatSent(sentAt) && " · "}
              {name}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div role="toolbar" aria-label="Attachment actions" className="flex items-center gap-0.5 rounded-xl border border-white/15 bg-white/10 p-1">
            {isImage && (
              <>
                <ToolButton label="Zoom in" onClick={() => changeZoom(zoom + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM}>
                  <ZoomIn size={18} aria-hidden="true" />
                </ToolButton>
                <ToolButton label="Zoom out" onClick={() => changeZoom(zoom - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM}>
                  <ZoomOut size={18} aria-hidden="true" />
                </ToolButton>
              </>
            )}
            <ToolButton label="Forward" onClick={() => setForwarding(true)}>
              <Forward size={18} aria-hidden="true" />
            </ToolButton>
            <ToolButton label="Download" onClick={download}>
              <Download size={18} aria-hidden="true" />
            </ToolButton>
          </div>
          <button type="button" aria-label="Close" title="Close" onClick={onClose} className={`${toolButton} border border-white/15 bg-white/10`}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-16"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onWheel={(event) => {
          if (isImage) changeZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
        }}
      >
        {items.length > 1 && (
          <button type="button" aria-label="Previous" title="Previous" onClick={() => go(-1)} className={`${toolButton} absolute left-5 top-1/2 -translate-y-1/2 border border-white/15 bg-white/10`}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
        )}

        {isImage ? (
          <img
            key={item.href}
            src={item.href}
            alt={name}
            draggable={false}
            onDoubleClick={() => changeZoom(zoom === MIN_ZOOM ? 2 : MIN_ZOOM)}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, cursor: zoom > MIN_ZOOM ? "grab" : "zoom-in" }}
            className="max-h-full max-w-full select-none object-contain transition-transform duration-100"
          />
        ) : (
          <video key={item.href} src={item.href} controls autoPlay aria-label={name} className="max-h-full max-w-full rounded-lg bg-black" />
        )}

        {items.length > 1 && (
          <button type="button" aria-label="Next" title="Next" onClick={() => go(1)} className={`${toolButton} absolute right-5 top-1/2 -translate-y-1/2 border border-white/15 bg-white/10`}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      {items.length > 1 && (
        <nav aria-label="Attachments" className="flex shrink-0 items-center justify-center gap-2 px-5 py-4">
          {items.map((entry, i) => (
            <button
              key={entry.href}
              type="button"
              aria-label={`Show ${displayName(entry.filename)}`}
              aria-current={i === index || undefined}
              onClick={() => onIndexChange(i)}
              className={`h-12 w-12 overflow-hidden rounded-lg border-2 bg-black p-0 outline-none focus-visible:outline-2 focus-visible:outline-focus ${i === index ? "border-white" : "border-transparent opacity-60 hover:opacity-100"}`}
            >
              {entry.kind === "image" ? (
                <img src={entry.href} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={entry.href} preload="metadata" muted className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </nav>
      )}

      {notice && (
        <p role="status" className={`absolute bottom-20 left-1/2 m-0 -translate-x-1/2 rounded-xl border bg-black/85 px-4 py-2 text-sm ${notice.tone === "error" ? "border-error/50 text-error" : "border-white/20 text-white"}`}>
          {notice.text}
        </p>
      )}

      {forwarding && (
        <ForwardDialog
          messageId={messageId}
          onClose={() => setForwarding(false)}
          onForwarded={(recipient) => {
            setForwarding(false);
            setNotice({ text: `Forwarded to ${recipient}.`, tone: "info" });
          }}
        />
      )}
    </div>,
    document.body,
  );
}

/** The server-side address of someone on another instance: `name@host`. */
const REMOTE_HANDLE = /^[^@\s]+@[^@\s]+\.[^@\s]+$|^[^@\s]+@localhost(:\d+)?$/i;

/** Picks who gets the message as a DM: someone you already talk to, or `name@server` on another instance. */
function ForwardDialog({ messageId, onClose, onForwarded }: { messageId: string; onClose: () => void; onForwarded: (recipient: string) => void }) {
  const { data, isPending, error } = useConversations();
  const { data: me } = useMyProfile();
  const queryClient = useQueryClient();
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const conversations = data ?? [];
  const { data: channelList } = useChannels();
  const channels = (channelList ?? []).filter(hasText);
  const addressValid = REMOTE_HANDLE.test(address.trim());

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** `busyKey` marks which row shows the spinner; `recipient` is what the confirmation names. */
  const forward = async (target: ForwardTarget, busyKey: string, recipient: string) => {
    setSendingTo(busyKey);
    setFailure(null);
    try {
      const { conversationId } = await forwardMessage(messageId, target);
      if ("peer" in target) {
        // A first message to someone new isn't listed by the server until they answer.
        if (me && conversationId && !conversations.some((c) => c.id === conversationId)) {
          rememberOutgoing(me.user_id, conversationFor({ id: conversationId, peer: target.peer, myHost: me.origin_server ?? "", preview: "Forwarded message" }));
        }
        void queryClient.invalidateQueries({ queryKey: dmKeys.conversations });
      }
      onForwarded(recipient);
    } catch (err) {
      setFailure(classifyAuthError(err, "Couldn't forward the message.").message);
      setSendingTo(null);
    }
  };

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !sendingTo) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Forward to" className="w-full max-w-sm rounded-2xl border border-border-secondary bg-surface p-5 text-text shadow-modal">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="m-0 text-lg font-semibold">Forward to</h2>
          <button type="button" aria-label="Cancel" title="Cancel" onClick={onClose} disabled={sendingTo !== null} className="grid h-8 w-8 place-items-center rounded-lg border-0 bg-transparent text-text-secondary hover:bg-hover hover:text-text disabled:opacity-40">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="m-0 mb-3 text-[12.5px] text-text-muted">Posted as a new message, with its text and attachments.</p>
        {failure && (
          <p role="alert" className="m-0 mb-2 text-[13px] text-error">
            {failure}
          </p>
        )}

        {channels.length > 0 && (
          <>
            <h3 className="m-0 px-2.5 pb-1 text-[11.5px] font-bold uppercase tracking-[0.08em] text-text-muted">Channels</h3>
            <ul className="m-0 mb-2 flex max-h-40 list-none flex-col gap-0.5 overflow-y-auto p-0">
              {channels.map((channel) => (
                <li key={channel.channel_id}>
                  <button
                    type="button"
                    disabled={sendingTo !== null}
                    onClick={() => void forward({ channelId: channel.channel_id }, `channel:${channel.channel_id}`, `#${channel.channel_name}`)}
                    className="flex w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 py-2 text-left text-sm text-text outline-none hover:bg-hover focus-visible:bg-hover disabled:opacity-50"
                  >
                    <Hash size={16} aria-hidden="true" className="shrink-0 text-text-muted" />
                    <span className="min-w-0 flex-1 truncate">{channel.channel_name}</span>
                    {sendingTo === `channel:${channel.channel_id}` && <Loader2 size={15} aria-hidden="true" className="shrink-0 animate-spin" />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="m-0 px-2.5 pb-1 text-[11.5px] font-bold uppercase tracking-[0.08em] text-text-muted">Direct messages</h3>
        {isPending ? (
          <p className="m-0 py-3 text-sm text-text-secondary">Loading conversations…</p>
        ) : error ? (
          <p role="alert" className="m-0 py-3 text-sm text-error">
            Couldn't load your conversations.
          </p>
        ) : conversations.length === 0 ? (
          <p className="m-0 py-3 text-sm text-text-secondary">No conversations yet. Enter an address below.</p>
        ) : (
          <ul className="m-0 flex max-h-56 list-none flex-col gap-0.5 overflow-y-auto p-0">
            {conversations.map((conversation) => {
              const peer = peerHandle({ username: conversation.peerUsername, host: conversation.peerHost }, me?.origin_server);
              const remote = peer.includes("@");
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    disabled={sendingTo !== null}
                    onClick={() => void forward({ peer }, peer, conversation.peerUsername)}
                    className="flex w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 py-2 text-left text-sm text-text outline-none hover:bg-hover focus-visible:bg-hover disabled:opacity-50"
                  >
                    <Avatar name={conversation.peerUsername} src={conversation.peerAvatarUrl} seed={conversation.peerUserId} size={28} />
                    <span className="min-w-0 flex-1 truncate">
                      {conversation.peerUsername}
                      {remote && <span className="ml-1.5 text-[12px] text-text-muted">@{conversation.peerHost}</span>}
                    </span>
                    {sendingTo === peer && <Loader2 size={15} aria-hidden="true" className="shrink-0 animate-spin" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form
          className="mt-3 flex items-center gap-2 border-t border-border-secondary pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            const peer = address.trim();
            if (addressValid && sendingTo === null) void forward({ peer }, peer, peer);
          }}
        >
          <input
            type="text"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            disabled={sendingTo !== null}
            placeholder="name@other-server.example"
            aria-label="Address on another server"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-border-secondary bg-surface-secondary px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus-visible:border-focus"
          />
          <button
            type="submit"
            aria-label="Forward to this address"
            title="Forward to this address"
            disabled={!addressValid || sendingTo !== null}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border-0 bg-primary text-on-primary outline-none hover:brightness-110 focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sendingTo !== null && sendingTo === address.trim() ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : <Send size={16} aria-hidden="true" />}
          </button>
        </form>
      </div>
    </div>
  );
}
