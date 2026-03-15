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
    <div className="fixed inset-0 z-[80] overflow-hidden bg-[#07090d] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(119,198,255,0.18),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(255,163,92,0.14),transparent_32%),linear-gradient(180deg,rgba(7,9,13,0.92),rgba(3,5,9,0.98))]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:32px_32px]" />
      </div>

      <button
        type="button"
        aria-label="Close media preview"
        className="absolute inset-0"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-full flex-col p-3 md:p-5">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 md:gap-4">
          <div className="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,23,31,0.92),rgba(8,11,17,0.84))] px-4 py-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl md:flex-row md:items-start md:justify-between md:px-5">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/68">
                  {mediaLabel}
                </span>
                {attachments.length > 1 && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/52">
                    {currentIndex + 1} of {attachments.length}
                  </span>
                )}
                {readableSize && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
                    {readableSize}
                  </span>
                )}
              </div>

              <h2 className="truncate text-base font-semibold tracking-[0.01em] text-white/92 md:text-lg">
                {attachment.filename || "Media attachment"}
              </h2>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/48">
                <span>Esc to close</span>
                {attachments.length > 1 && <span>Arrow keys to browse</span>}
                {image && <span>Double click or +/- to zoom</span>}
                {readableType && <span className="font-mono uppercase tracking-[0.08em]">{readableType}</span>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              {image && (
                <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-black/20 p-1">
                  <button
                    type="button"
                    onClick={() => setZoom((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white/64 transition-colors hover:bg-white/10 hover:text-white"
                    title="Zoom out (-)"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={resetImageView}
                    className="min-w-[4.25rem] rounded-xl px-3 py-2 text-center text-xs font-semibold tracking-[0.12em] text-white/72 transition-colors hover:bg-white/10 hover:text-white"
                    title="Reset zoom"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white/64 transition-colors hover:bg-white/10 hover:text-white"
                    title="Zoom in (+)"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                    </svg>
                  </button>
                </div>
              )}

              <a
                href={resolvedUrl}
                download={attachment.filename || undefined}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 text-sm font-medium text-white/84 transition-colors hover:bg-white/14 hover:text-white"
                title="Download"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">Download</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-4 text-sm font-medium text-white/84 transition-colors hover:bg-white/14 hover:text-white"
                title="Close (Esc)"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto mt-3 flex min-h-0 w-full max-w-[1440px] flex-1 items-center justify-center md:mt-4">
          {canGoPrevious && (
            <button
              type="button"
              onClick={() => onChangeIndex(currentIndex - 1)}
              className="absolute left-2 top-1/2 z-20 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,32,0.92),rgba(8,11,17,0.88))] text-white/78 shadow-[0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all hover:border-white/20 hover:text-white md:flex"
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
              className="absolute right-2 top-1/2 z-20 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,32,0.92),rgba(8,11,17,0.88))] text-white/78 shadow-[0_16px_48px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all hover:border-white/20 hover:text-white md:flex"
              aria-label="Next media"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <div className="relative flex h-full w-full min-h-0 items-center justify-center overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(11,15,22,0.94),rgba(7,10,15,0.98))] shadow-[0_30px_100px_rgba(0,0,0,0.5)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(119,198,255,0.12),transparent_28%),radial-gradient(circle_at_bottom,rgba(255,163,92,0.08),transparent_24%)]" />
            <div className="relative flex h-full w-full min-h-0 items-center justify-center overflow-hidden p-3 md:p-6">
              {image ? (
                <div
                  className="flex h-full w-full items-center justify-center overflow-hidden rounded-[24px] border border-white/6 bg-[rgba(255,255,255,0.02)]"
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
                <div className="flex h-full w-full items-center justify-center rounded-[24px] border border-white/6 bg-[rgba(255,255,255,0.02)] p-1 md:p-3">
                  <VideoPlayer
                    src={resolvedUrl}
                    filename={attachment.filename}
                    className="max-h-full w-full max-w-6xl"
                    autoPlay
                  />
                </div>
              ) : (
                <div className="mx-auto flex max-w-md flex-col items-center rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,20,28,0.94),rgba(8,11,17,0.9))] px-8 py-10 text-center shadow-[0_18px_48px_rgba(0,0,0,0.38)]">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/8">
                    <svg className="h-8 w-8 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 11h10M7 15h6M6 3h9l5 5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-white/88">Preview unavailable</p>
                  <p className="mt-2 text-sm text-white/52">
                    This attachment type does not support fullscreen preview, but you can still download it.
                  </p>
                </div>
              )}
            </div>

            {(canGoPrevious || canGoNext) && (
              <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[rgba(9,12,18,0.72)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55 backdrop-blur-xl md:hidden">
                {canGoPrevious && (
                  <button
                    type="button"
                    onClick={() => onChangeIndex(currentIndex - 1)}
                    className="rounded-full px-2 py-1 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Previous media"
                  >
                    Prev
                  </button>
                )}
                <span>
                  {currentIndex + 1}/{attachments.length}
                </span>
                {canGoNext && (
                  <button
                    type="button"
                    onClick={() => onChangeIndex(currentIndex + 1)}
                    className="rounded-full px-2 py-1 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Next media"
                  >
                    Next
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {mediaAttachments.length > 1 && (
          <div className="relative z-10 mx-auto mt-3 w-full max-w-[1440px] md:mt-4">
            <div className="flex items-center justify-between gap-3 rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,16,23,0.86),rgba(7,10,15,0.8))] px-3 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.32)] backdrop-blur-xl">
              <div className="hidden min-w-0 flex-1 text-xs uppercase tracking-[0.22em] text-white/42 md:block">
                Filmstrip
              </div>
              <div className="flex flex-1 justify-start gap-2 overflow-x-auto md:justify-center">
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
                      className={`group relative h-16 w-24 shrink-0 overflow-hidden rounded-2xl border transition-all ${
                        isActive
                          ? "border-white/40 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
                          : "border-white/10 opacity-55 hover:border-white/20 hover:opacity-100"
                      }`}
                      title={item.filename || `Attachment ${index + 1}`}
                    >
                      {itemIsImage ? (
                        <img
                          src={itemUrl}
                          alt={item.filename || `Attachment ${index + 1}`}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : itemIsVideo ? (
                        <>
                          <video src={itemUrl} muted preload="metadata" className="h-full w-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/8 px-2 text-center text-[10px] text-white/62">
                          {item.filename || "File"}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/45 to-transparent" />
                    </button>
                  );
                })}
              </div>
              <div className="hidden min-w-0 flex-1 justify-end text-right text-xs uppercase tracking-[0.22em] text-white/38 md:flex">
                Browse attachments
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MediaLightbox;
