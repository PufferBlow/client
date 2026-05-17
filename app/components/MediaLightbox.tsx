import React, { useEffect, useMemo, useRef, useState } from "react";

import type { MessageAttachment } from "../models/Message";
import { createFullUrl } from "../services/user";
import { VideoPlayer } from "./VideoPlayer";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "heic"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "avi", "mkv", "m4v", "ogv"];

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

const formatFileSize = (size: number | null): string | null => {
  if (!size || size <= 0) {
    return null;
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
};

const getMediaLabel = (attachment: MessageAttachment): string => {
  if (isVideoAttachment(attachment)) {
    return "Video";
  }

  const extension = extractExtension(attachment.filename || attachment.url);
  if (attachment.type === "image/gif" || extension === "gif") {
    return "GIF";
  }

  if (isImageAttachment(attachment)) {
    return "Image";
  }

  return "Attachment";
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
  const mediaLabel = getMediaLabel(attachment);
  const readableSize = formatFileSize(attachment.size);
  const readableType =
    attachment.type && attachment.type !== "application/octet-stream"
      ? attachment.type
      : null;

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
    // Minimal lightbox: flat dark scrim, simple top bar, image fills
    // the remaining space. No decorative gradients, grids, or pill
    // badges -- everything informational is collapsed into one line
    // (filename + size + type). Action buttons match the rest of the
    // app's icon-button style (primary-color download to match the
    // file-attachment download button; subtle ghost for close + zoom).
    <div className="fixed inset-0 z-[80] overflow-hidden bg-black/95 text-white">
      {/* Full-bleed click-out-to-close backdrop. Sits below the content
          layer (z-0) so the toolbar / image / nav arrows above receive
          their own clicks normally. */}
      <button
        type="button"
        aria-label="Close media preview"
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-full flex-col">
        {/* Top toolbar: filename + size on the left, zoom (images only)
            + download + close on the right. One row, no badges, no
            keyboard hints. The bar is transparent so the image reads
            edge-to-edge; only the buttons have their own backgrounds. */}
        <div className="flex flex-shrink-0 items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white/90" title={attachment.filename || undefined}>
              {attachment.filename || "Media attachment"}
            </div>
            <div className="mt-0.5 text-xs text-white/45">
              <span className="uppercase tracking-wide">{mediaLabel}</span>
              {readableSize && <span> · {readableSize}</span>}
              {readableType && <span className="font-mono"> · {readableType}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {image && (
              <div className="flex items-center rounded-md bg-white/10 text-white">
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-l-md text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                  title="Zoom out (-)"
                  aria-label="Zoom out"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={resetImageView}
                  className="px-3 text-xs font-medium tabular-nums text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                  title="Reset zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-r-md text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                  title="Zoom in (+)"
                  aria-label="Zoom in"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                  </svg>
                </button>
              </div>
            )}

            {/* Primary-color download icon button -- same visual as the
                download button on file/audio attachment bubbles. */}
            <a
              href={resolvedUrl}
              download={attachment.filename || undefined}
              className="pb-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-primary)] text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
              title="Download"
              aria-label="Download"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="pb-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white/85 transition-colors hover:bg-white/16 hover:text-white"
              title="Close (Esc)"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Image / video viewport. Fills all remaining vertical space.
            No decorative chrome -- just the content and its navigation. */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
          {canGoPrevious && (
            <button
              type="button"
              onClick={() => onChangeIndex(currentIndex - 1)}
              className="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/85 transition-colors hover:bg-white/16 hover:text-white md:flex"
              aria-label="Previous media"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {canGoNext && (
            <button
              type="button"
              onClick={() => onChangeIndex(currentIndex + 1)}
              className="absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/85 transition-colors hover:bg-white/16 hover:text-white md:flex"
              aria-label="Next media"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => setIsDragging(false)}
                onDoubleClick={() => (zoom > 1 ? resetImageView() : setZoom(2))}
              />
            </div>
          ) : video ? (
            <div className="flex h-full w-full items-center justify-center">
              <VideoPlayer
                src={resolvedUrl}
                filename={attachment.filename}
                className="max-h-full w-full max-w-6xl"
                autoPlay
              />
            </div>
          ) : (
            <div className="flex max-w-md flex-col items-center px-8 py-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-white/10">
                <svg className="h-7 w-7 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 11h10M7 15h6M6 3h9l5 5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
                </svg>
              </div>
              <p className="text-base font-medium text-white/90">Preview unavailable</p>
              <p className="mt-1 text-sm text-white/55">
                This attachment type doesn't support fullscreen preview. Use the download button to save it.
              </p>
            </div>
          )}

          {/* Mobile-only inline nav. The desktop side arrows are
              positioned absolutely above; below the `md` breakpoint
              we collapse to a compact prev/index/next pill at the
              bottom of the viewport. */}
          {(canGoPrevious || canGoNext) && (
            <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/10 px-1.5 py-1 text-xs text-white/85 md:hidden">
              {canGoPrevious && (
                <button
                  type="button"
                  onClick={() => onChangeIndex(currentIndex - 1)}
                  className="rounded-full px-3 py-1 transition-colors hover:bg-white/15"
                  aria-label="Previous media"
                >
                  Prev
                </button>
              )}
              <span className="px-2 tabular-nums">
                {currentIndex + 1}/{attachments.length}
              </span>
              {canGoNext && (
                <button
                  type="button"
                  onClick={() => onChangeIndex(currentIndex + 1)}
                  className="rounded-full px-3 py-1 transition-colors hover:bg-white/15"
                  aria-label="Next media"
                >
                  Next
                </button>
              )}
            </div>
          )}
        </div>

        {/* Compact thumbnail strip. No "Filmstrip" / "Browse attachments"
            captions -- the strip itself is the affordance. Smaller
            tiles (14x20 vs 16x24) so it doesn't dominate the bottom. */}
        {mediaAttachments.length > 1 && (
          <div className="flex flex-shrink-0 justify-center gap-2 overflow-x-auto px-4 pb-4">
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
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-md transition-all ${
                    isActive
                      ? "ring-2 ring-[var(--color-primary)]"
                      : "opacity-55 hover:opacity-100"
                  }`}
                  title={item.filename || `Attachment ${index + 1}`}
                  aria-label={`Open attachment ${index + 1}`}
                  aria-current={isActive ? "true" : undefined}
                >
                  {itemIsImage ? (
                    <img
                      src={itemUrl}
                      alt=""
                      aria-hidden="true"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : itemIsVideo ? (
                    <>
                      <video src={itemUrl} muted preload="metadata" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/10 px-1 text-center text-[10px] text-white/60">
                      File
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MediaLightbox;
