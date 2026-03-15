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
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/[0.93] backdrop-blur-sm">
      {/* Backdrop — clicking the dark area closes */}
      <button
        type="button"
        aria-label="Close media preview"
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* Top bar */}
      <div className="relative z-10 flex flex-shrink-0 items-center justify-between gap-4 px-5 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white/90">
            {attachment.filename || "Media attachment"}
          </div>
          {attachments.length > 1 && (
            <div className="text-xs text-white/40">
              {currentIndex + 1} / {attachments.length}
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5">
          {image && (
            <>
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="Zoom out (−)"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={resetImageView}
                className="min-w-[2.75rem] rounded-lg px-2 py-1 text-center text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="Zoom in (+)"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </button>
              <div className="mx-1.5 h-4 w-px bg-white/20" />
            </>
          )}

          <a
            href={resolvedUrl}
            download={attachment.filename || undefined}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            title="Download"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            title="Close (Esc)"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Media area */}
      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {canGoPrevious && (
          <button
            type="button"
            onClick={() => onChangeIndex(currentIndex - 1)}
            className="absolute left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-all hover:bg-black/70 hover:text-white"
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
            className="absolute right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-all hover:bg-black/70 hover:text-white"
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
          <div className="flex h-full w-full items-center justify-center px-4">
            <VideoPlayer
              src={resolvedUrl}
              filename={attachment.filename}
              className="max-h-full w-full max-w-5xl"
              autoPlay
            />
          </div>
        ) : (
          <p className="text-sm text-white/40">
            This attachment type does not support preview.
          </p>
        )}
      </div>

      {/* Thumbnail strip */}
      {mediaAttachments.length > 1 && (
        <div className="relative z-10 flex flex-shrink-0 justify-center gap-2 overflow-x-auto px-4 py-3">
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
                className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-lg transition-all ${
                  isActive
                    ? "opacity-100 ring-2 ring-white/70"
                    : "opacity-40 hover:opacity-70"
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
                    <video src={itemUrl} muted preload="metadata" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white/10 px-2 text-center text-[10px] text-white/60">
                    {item.filename || "File"}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MediaLightbox;
