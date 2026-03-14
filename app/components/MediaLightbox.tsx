import React, { useEffect, useMemo, useRef, useState } from "react";

import type { MessageAttachment } from "../models/Message";
import { createFullUrl } from "../services/user";
import { VideoPlayer } from "./VideoPlayer";

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'ogv'];

interface MediaLightboxProps {
  attachments: MessageAttachment[];
  currentIndex: number;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
}

const resolveAttachmentUrl = (rawUrl: string): string => {
  if (!rawUrl) return rawUrl;
  if (
    rawUrl.startsWith("http://") ||
    rawUrl.startsWith("https://") ||
    rawUrl.startsWith("blob:") ||
    rawUrl.startsWith("data:")
  ) {
    return rawUrl;
  }
  return createFullUrl(rawUrl) || rawUrl;
};

const extractExtension = (value: string): string => {
  const stripped = value.split("?")[0]?.split("#")[0] || "";
  const tail = stripped.split("/").pop() || stripped;
  return tail.includes(".") ? tail.split(".").pop()?.toLowerCase() || "" : "";
};

const isImageAttachment = (attachment: MessageAttachment): boolean => {
  const extension = extractExtension(attachment.filename || attachment.url);
  return attachment.type.startsWith("image/") || IMAGE_EXTENSIONS.includes(extension);
};

const isVideoAttachment = (attachment: MessageAttachment): boolean => {
  const extension = extractExtension(attachment.filename || attachment.url);
  return attachment.type.startsWith("video/") || VIDEO_EXTENSIONS.includes(extension);
};

export function MediaLightbox({
  attachments,
  currentIndex,
  onClose,
  onChangeIndex,
}: MediaLightboxProps) {
  const attachment = attachments[currentIndex];
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    if (!attachment) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight" && currentIndex < attachments.length - 1) {
        onChangeIndex(currentIndex + 1);
      } else if (event.key === "ArrowLeft" && currentIndex > 0) {
        onChangeIndex(currentIndex - 1);
      } else if ((event.key === "+" || event.key === "=") && isImageAttachment(attachment)) {
        setZoom((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))));
      } else if (event.key === "-" && isImageAttachment(attachment)) {
        setZoom((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))));
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [attachment, attachments.length, currentIndex, onChangeIndex, onClose]);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
  }, [currentIndex]);

  const resolvedUrl = useMemo(
    () => (attachment ? resolveAttachmentUrl(attachment.url) : ""),
    [attachment],
  );

  if (!attachment) {
    return null;
  }

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < attachments.length - 1;
  const image = isImageAttachment(attachment);
  const video = isVideoAttachment(attachment);
  const mediaAttachments = attachments.filter(
    (item) => isImageAttachment(item) || isVideoAttachment(item),
  );

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!image) {
      return;
    }
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.2 : 0.2;
    setZoom((prev) => Math.max(1, Math.min(4, Number((prev + delta).toFixed(2)))));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!image || zoom <= 1) {
      return;
    }
    setIsDragging(true);
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!isDragging || !image || zoom <= 1) {
      return;
    }
    const deltaX = event.clientX - dragStartRef.current.x;
    const deltaY = event.clientY - dragStartRef.current.y;
    setOffset({
      x: dragStartRef.current.offsetX + deltaX,
      y: dragStartRef.current.offsetY + deltaY,
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!image) {
      return;
    }
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const resetImageView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[color:color-mix(in_srgb,var(--color-background)_78%,black)] backdrop-blur-md">
      <button
        type="button"
        aria-label="Close media preview"
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-full w-full max-w-[96vw] flex-col px-4 py-4 md:px-6">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)] px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--color-text)]">
              {attachment.filename || "Media attachment"}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)]">
              {currentIndex + 1} of {attachments.length}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {image && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))}
                  className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={resetImageView}
                  className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-2 text-xs text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))))}
                  className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                >
                  +
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="relative mt-4 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[color:color-mix(in_srgb,var(--color-surface)_82%,transparent)]">
          {canGoPrevious && (
            <button
              type="button"
              onClick={() => onChangeIndex(currentIndex - 1)}
              className="absolute left-4 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)]/90 text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
              aria-label="Previous media"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {canGoNext && (
            <button
              type="button"
              onClick={() => onChangeIndex(currentIndex + 1)}
              className="absolute right-4 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border-secondary)] bg-[var(--color-surface)]/90 text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
              aria-label="Next media"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {image ? (
            <div
              className="flex h-full w-full items-center justify-center overflow-hidden"
              onWheel={handleWheel}
            >
              <img
                src={resolvedUrl}
                alt={attachment.filename || "Image attachment"}
                className={`max-h-full max-w-full select-none object-contain transition-transform duration-150 ${zoom > 1 ? "cursor-grab" : "cursor-zoom-in"} ${isDragging ? "cursor-grabbing" : ""}`}
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => setIsDragging(false)}
                onDoubleClick={() => {
                  if (zoom > 1) {
                    resetImageView();
                  } else {
                    setZoom(2);
                  }
                }}
              />
            </div>
          ) : video ? (
            <div className="flex h-full w-full items-center justify-center p-4">
              <VideoPlayer
                src={resolvedUrl}
                filename={attachment.filename}
                className="max-h-[82vh] w-full max-w-5xl"
                autoPlay
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--color-text-secondary)]">
              This attachment type does not support expanded preview yet.
            </div>
          )}
        </div>

        {mediaAttachments.length > 1 && (
          <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[color:color-mix(in_srgb,var(--color-surface)_90%,transparent)] p-3">
            <div className="mb-2 text-xs uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
              Media in this message
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {attachments.map((item, index) => {
                const itemUrl = resolveAttachmentUrl(item.url);
                const itemIsImage = isImageAttachment(item);
                const itemIsVideo = isVideoAttachment(item);
                const isActive = index === currentIndex;

                return (
                  <button
                    key={`${item.url}-${index}`}
                    type="button"
                    onClick={() => onChangeIndex(index)}
                    className={`relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border transition-colors ${
                      isActive
                        ? "border-[var(--color-primary)] ring-2 ring-[color:color-mix(in_srgb,var(--color-primary)_35%,transparent)]"
                        : "border-[var(--color-border-secondary)] hover:border-[var(--color-border)]"
                    }`}
                    title={item.filename || `Attachment ${index + 1}`}
                  >
                    {itemIsImage ? (
                      <img
                        src={itemUrl}
                        alt={item.filename || `Attachment ${index + 1}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : itemIsVideo ? (
                      <>
                        <video
                          src={itemUrl}
                          muted
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface)]/30">
                          <div className="rounded-full bg-[var(--color-surface)]/85 p-2 text-[var(--color-text)]">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[var(--color-surface-secondary)] px-2 text-center text-[10px] text-[var(--color-text-secondary)]">
                        {item.filename || "Attachment"}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MediaLightbox;
