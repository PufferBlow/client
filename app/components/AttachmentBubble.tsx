import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, Volume1, VolumeX } from 'lucide-react';
import type { MessageAttachment } from '../models/Message';
import { VideoPlayer } from './VideoPlayer';
import { MediaLightbox } from './MediaLightbox';
import { downloadFileViaBlob } from '../utils/downloadFile';
import { renderFileTypeIcon } from '../utils/fileTypeMeta';
import { createFullUrl } from '../services/user';

interface AttachmentBubbleProps extends MessageAttachment {
  onClick?: () => void;
  className?: string;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'ogv'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'];

// ── Attachment volume preference ─────────────────────────────────────
//
// Shared between every audio attachment player in the message stream
// AND the Settings page's "Audio Attachment Volume" slider. Persisted
// in the same localStorage blob as the rest of the audio settings
// (`pufferblow-audio-settings`) and broadcast via the existing
// `pufferblow:audio-settings-changed` CustomEvent so adjusting volume
// in one player updates every other player in real time.
//
// Default 100 means "play attachments at full system volume." 0 mutes.

const AUDIO_SETTINGS_STORAGE_KEY = "pufferblow-audio-settings";
const AUDIO_SETTINGS_CHANGED_EVENT = "pufferblow:audio-settings-changed";
const DEFAULT_ATTACHMENT_VOLUME = 100;

function readAttachmentVolume(): number {
  if (typeof window === "undefined") return DEFAULT_ATTACHMENT_VOLUME;
  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_ATTACHMENT_VOLUME;
    const parsed = JSON.parse(raw);
    const v = Number(parsed.attachmentVolume);
    if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
  } catch {
    // Bad JSON / serialisation drift -- fall back to default.
  }
  return DEFAULT_ATTACHMENT_VOLUME;
}

function writeAttachmentVolume(value: number): void {
  if (typeof window === "undefined") return;
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  try {
    const raw = window.localStorage.getItem(AUDIO_SETTINGS_STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    existing.attachmentVolume = clamped;
    window.localStorage.setItem(AUDIO_SETTINGS_STORAGE_KEY, JSON.stringify(existing));
    // Fire the same event the Settings page hook uses, so every other
    // audio player on screen (and the live VoiceTransport) picks up
    // the change immediately.
    window.dispatchEvent(new CustomEvent(AUDIO_SETTINGS_CHANGED_EVENT));
  } catch {
    // localStorage can throw under quota / private-mode conditions --
    // best-effort, the next save attempt may succeed.
  }
}

const buildFallbackWaveform = (seed: string, barCount = 44): number[] => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  const values: number[] = [];
  let state = Math.abs(hash) || 1;
  for (let i = 0; i < barCount; i++) {
    state = (1103515245 * state + 12345) % 0x7fffffff;
    const normalized = state / 0x7fffffff;
    values.push(Math.max(0.14, normalized * 0.92));
  }
  return values;
};

const formatAudioTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
};


export const AttachmentBubble: React.FC<AttachmentBubbleProps> = ({
  url,
  filename,
  type,
  size,
  onClick,
  className = ''
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [waveformBars, setWaveformBars] = useState<number[]>(
    () => buildFallbackWaveform(`${filename || ''}-${url}`),
  );
  const [isGifHovered, setIsGifHovered] = useState(false);
  const [gifAutoPlayDone, setGifAutoPlayDone] = useState(false);
  const [gifCanvasReady, setGifCanvasReady] = useState(false);
  // Volume preference (0..100) shared via localStorage with the Settings
  // page and every other audio player. The popover state controls the
  // small slider drawer next to the download button.
  const [attachmentVolume, setAttachmentVolume] = useState<number>(() => readAttachmentVolume());
  const [volumePopoverOpen, setVolumePopoverOpen] = useState(false);
  const volumePopoverRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gifCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gifHiddenImgRef = useRef<HTMLImageElement | null>(null);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const extractExtension = (value: string): string => {
    const stripped = value.split('?')[0]?.split('#')[0] || '';
    const tail = stripped.split('/').pop() || stripped;
    return tail.includes('.') ? (tail.split('.').pop()?.toLowerCase() || '') : '';
  };

  const inferAttachmentType = (
    rawType: string | undefined,
    rawFilename: string | undefined,
    rawUrl: string,
  ): string => {
    const cleanedType = (rawType || '').trim().toLowerCase();
    if (
      cleanedType &&
      cleanedType !== 'application/octet-stream' &&
      cleanedType !== 'binary/octet-stream'
    ) {
      return cleanedType;
    }

    const ext = extractExtension(rawFilename || '') || extractExtension(rawUrl);
    if (IMAGE_EXTENSIONS.includes(ext)) {
      return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    }
    if (VIDEO_EXTENSIONS.includes(ext)) {
      return `video/${ext === 'mov' ? 'quicktime' : ext}`;
    }
    if (AUDIO_EXTENSIONS.includes(ext)) {
      if (ext === 'mp3') return 'audio/mpeg';
      if (ext === 'm4a') return 'audio/mp4';
      return `audio/${ext}`;
    }
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'doc') return 'application/msword';
    if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ext === 'txt' || ext === 'md') return 'text/plain';
    return cleanedType || 'application/octet-stream';
  };

  const resolveAttachmentUrl = (rawUrl: string): string => {
    if (!rawUrl) return rawUrl;
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
      return rawUrl;
    }
    return createFullUrl(rawUrl) || rawUrl;
  };

  const resolvedUrl = useMemo(() => resolveAttachmentUrl(url), [url]);
  const inferredType = useMemo(
    () => inferAttachmentType(type, filename, resolvedUrl),
    [type, filename, resolvedUrl],
  );
  const resolvedExtension = useMemo(
    () => extractExtension(filename || '') || extractExtension(resolvedUrl),
    [filename, resolvedUrl],
  );
  const resolvedType = inferredType;
  const isImageAttachment = resolvedType.startsWith('image/') || IMAGE_EXTENSIONS.includes(resolvedExtension);
  const isVideoAttachment = resolvedType.startsWith('video/') || VIDEO_EXTENSIONS.includes(resolvedExtension);
  const isAudioAttachment = resolvedType.startsWith('audio/') || AUDIO_EXTENSIONS.includes(resolvedExtension);
  const isGif = resolvedExtension === 'gif' || resolvedType === 'image/gif';

  // Capture first GIF frame onto canvas for static preview
  const captureGifFrame = useCallback(() => {
    const img = gifHiddenImgRef.current;
    const canvas = gifCanvasRef.current;
    if (!img || !canvas || !isGif) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    ctx.drawImage(img, 0, 0);
    setGifCanvasReady(true);
  }, [isGif]);

  // Auto-play GIF once on mount, then show static frame
  useEffect(() => {
    if (!isGif) return;
    const timer = setTimeout(() => {
      setGifAutoPlayDone(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isGif]);

  useEffect(() => {
    if (!isAudioAttachment || !resolvedUrl) {
      return;
    }

    let isCancelled = false;
    let audioContext: AudioContext | null = null;

    const buildWaveform = async () => {
      try {
        setWaveformBars(buildFallbackWaveform(`${filename || ''}-${resolvedUrl}`));
        const response = await fetch(resolvedUrl);
        if (!response.ok) {
          return;
        }

        const rawBuffer = await response.arrayBuffer();
        const AudioContextClass =
          window.AudioContext ||
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) {
          return;
        }

        audioContext = new AudioContextClass();
        const decodedAudio = await audioContext.decodeAudioData(rawBuffer.slice(0));
        const channelData = decodedAudio.getChannelData(0);
        const barsCount = 44;
        const stride = Math.max(1, Math.floor(channelData.length / barsCount));
        const amplitudes: number[] = [];

        for (let i = 0; i < barsCount; i++) {
          const start = i * stride;
          const end = Math.min(channelData.length, start + stride);
          let sum = 0;
          for (let j = start; j < end; j++) {
            sum += Math.abs(channelData[j]);
          }
          const mean = end > start ? sum / (end - start) : 0;
          amplitudes.push(mean);
        }

        const peak = Math.max(...amplitudes, 0.0001);
        const normalized = amplitudes.map((value) => Math.max(0.14, value / peak));
        if (!isCancelled) {
          setWaveformBars(normalized);
        }
      } catch {
        if (!isCancelled) {
          setWaveformBars(buildFallbackWaveform(`${filename || ''}-${resolvedUrl}`));
        }
      } finally {
        if (audioContext) {
          audioContext.close().catch(() => undefined);
        }
      }
    };

    buildWaveform();
    return () => {
      isCancelled = true;
      if (audioContext) {
        audioContext.close().catch(() => undefined);
      }
    };
  }, [isAudioAttachment, resolvedUrl, filename]);

  const audioProgress = audioDuration > 0 ? Math.min(1, audioCurrentTime / audioDuration) : 0;

  // Apply the volume preference to the underlying <audio> element.
  // Runs on mount, on every volume change, and on every audio element
  // remount (the audio ref's identity changes if the variant re-renders).
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = Math.min(1, Math.max(0, attachmentVolume / 100));
  }, [attachmentVolume]);

  // Cross-instance sync: when another player (or the Settings page)
  // adjusts the attachment volume, picks up the change. Listening on
  // window because the event is broadcast at that scope.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSettingsChange = () => {
      const next = readAttachmentVolume();
      setAttachmentVolume((prev) => (prev === next ? prev : next));
    };
    window.addEventListener(AUDIO_SETTINGS_CHANGED_EVENT, onSettingsChange);
    return () => window.removeEventListener(AUDIO_SETTINGS_CHANGED_EVENT, onSettingsChange);
  }, []);

  // Close the volume popover on outside-click and Escape. Bound only
  // while open so it doesn't burn cycles on every player.
  useEffect(() => {
    if (!volumePopoverOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (volumePopoverRef.current && !volumePopoverRef.current.contains(e.target as Node)) {
        setVolumePopoverOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVolumePopoverOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [volumePopoverOpen]);

  const handleVolumeSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    setAttachmentVolume(next);
    writeAttachmentVolume(next);
  };

  // Speaker icon glyph picked by current level. Standard three-state
  // (muted / low / high) so the button visually mirrors what playback
  // is doing without needing to open the popover.
  const VolumeIcon =
    attachmentVolume <= 0 ? VolumeX : attachmentVolume < 50 ? Volume1 : Volume2;

  const handleDownload = async (
    event?: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (isDownloading) {
      return;
    }
    setIsDownloading(true);
    try {
      await downloadFileViaBlob({
        url: resolvedUrl,
        filename,
        mimeType: resolvedType,
        includeAuthRefresh: true,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleAudioPlayback = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch {
      setAudioError(true);
    }
  };

  /**
   * Click-AND-drag seek. The previous implementation was a single click
   * handler -- you could jump but you couldn't scrub. This now:
   *
   *   1. Applies the initial position on pointerdown.
   *   2. Attaches window-level mousemove/mouseup listeners so dragging
   *      past the waveform's edges still seeks correctly (the rect is
   *      captured once, so values clamp to [0, 1] at the boundaries).
   *   3. Cleans the listeners up on mouseup.
   *
   * Window-level listeners are intentional: dragging outside the
   * waveform container shouldn't lose the gesture. The classic
   * audio-scrubbing pattern.
   */
  const handleSeekPointerDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audioDuration) return;
    const rect = event.currentTarget.getBoundingClientRect();

    const applyAt = (clientX: number) => {
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      audio.currentTime = ratio * audioDuration;
      setAudioCurrentTime(audio.currentTime);
    };

    applyAt(event.clientX);

    const onMove = (ev: MouseEvent) => applyAt(ev.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Image/Video attachment (large bubble style)
  if ((isImageAttachment || isVideoAttachment) && !imageError) {
    const isImage = isImageAttachment;
    const isVideo = isVideoAttachment;

    if (isImage) {
      const showAnimated = isGif && (isGifHovered || !gifAutoPlayDone);

      return (
        <div
          className={`relative group cursor-pointer overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] transition-all duration-200 hover:border-[var(--color-border-secondary)] ${className}`}
          onClick={onClick}
          onMouseEnter={() => isGif && setIsGifHovered(true)}
          onMouseLeave={() => isGif && setIsGifHovered(false)}
        >
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="pb-focus-ring absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-primary)] text-[var(--color-on-primary)] opacity-0 transition-opacity duration-200 hover:bg-[var(--color-primary-hover)] group-hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-70"
            title={`Download ${filename || 'image'}`}
            aria-label={`Download ${filename || 'image'}`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>

          {/* Loading skeleton */}
          {imageLoading && (
            <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-[var(--color-surface-tertiary)]">
              <div className="text-center">
                <div className="mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-4 border-[var(--color-border-secondary)] border-t-[var(--color-primary)]"></div>
                <p className="text-sm text-[var(--color-text-secondary)]">Loading preview...</p>
              </div>
            </div>
          )}

          {isGif ? (
            <>
              {/* Hidden img used only to capture first GIF frame onto canvas */}
              <img
                ref={gifHiddenImgRef}
                src={resolvedUrl}
                alt=""
                aria-hidden="true"
                style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
                crossOrigin="anonymous"
                onLoad={() => {
                  setImageLoading(false);
                  captureGifFrame();
                }}
                onError={() => { setImageLoading(false); setImageError(true); }}
              />
              {/* Sizing rules for the GIF (and same for the static image
                  branch below):
                    - `max-w-full` caps width to the message container,
                      so a 4K-resolution GIF doesn't break the layout
                    - `max-h-96` (24rem / 384px) caps height
                    - `h-auto` + no `w-full` means a small GIF (e.g.
                      120x80) renders at its intrinsic size instead of
                      being stretched to fill the column
                    - `object-contain` keeps the aspect ratio when the
                      caps DO clip a large GIF down
                  Together these are also enough to neutralise
                  dimension-spoofing attempts -- a GIF declaring
                  absurd intrinsic dimensions just clips to the caps
                  rather than blowing up the layout. */}
              {/* Canvas: static first frame (always in DOM so ref works, hidden when animating) */}
              <canvas
                ref={gifCanvasRef}
                className="h-auto max-h-96 max-w-full object-contain"
                style={{ display: gifCanvasReady && !showAnimated ? 'block' : 'none' }}
              />
              {/* Animated GIF: shown when hovered or auto-playing */}
              <img
                src={resolvedUrl}
                alt={filename || 'Attachment'}
                className={`h-auto max-h-96 max-w-full object-contain transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                style={{ display: gifCanvasReady && !showAnimated ? 'none' : 'block' }}
                loading="lazy"
              />
            </>
          ) : (
            <img
              src={resolvedUrl}
              alt={filename || 'Attachment'}
              className={`h-auto max-h-96 max-w-full object-contain transition-opacity duration-300 ${
                imageLoading ? 'opacity-0' : 'opacity-100'
              }`}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
              loading="lazy"
            />
          )}

          {/* GIF badge shown when paused */}
          {isGif && gifAutoPlayDone && !isGifHovered && (
            <div className="pointer-events-none absolute bottom-2 left-2 z-10">
              <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">GIF</span>
            </div>
          )}

        </div>
      );
    }

    if (isVideo) {
      // Note: no `onClick={onClick}` on the wrapper, unlike the image
      // branch. Images open the MediaLightbox when clicked; videos
      // shouldn't, because clicking a video naturally means "play it"
      // and routing to a fullscreen overlay just gets in the way. The
      // VideoPlayer's own video element handles play/pause on click,
      // and the fullscreen button inside the player handles fullscreen.
      return (
        <div className={`group relative ${className}`}>
          <VideoPlayer
            src={resolvedUrl}
            filename={filename}
            onError={() => setImageError(true)}
          />
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="pb-focus-ring absolute right-2 top-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-primary)] text-[var(--color-on-primary)] opacity-0 transition-opacity duration-200 hover:bg-[var(--color-primary-hover)] group-hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-70"
            title={`Download ${filename || 'video'}`}
            aria-label={`Download ${filename || 'video'}`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
      );
    }
  }

  // Audio attachment (inline player + waveform). Same `max-w-md` cap as
  // the file variant so audio bubbles don't stretch across the entire
  // message column.
  if (isAudioAttachment && !audioError) {
    return (
      <div
        className={`max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-3 ${className}`}
      >
        <audio
          ref={audioRef}
          src={resolvedUrl}
          preload="metadata"
          onLoadedMetadata={(event) => {
            setAudioDuration(event.currentTarget.duration || 0);
          }}
          onTimeUpdate={(event) => {
            setAudioCurrentTime(event.currentTarget.currentTime || 0);
          }}
          onPlay={() => setAudioPlaying(true)}
          onPause={() => setAudioPlaying(false)}
          onEnded={() => {
            setAudioPlaying(false);
            setAudioCurrentTime(0);
          }}
          onError={() => setAudioError(true)}
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleAudioPlayback}
            className="pb-focus-ring inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
            title={audioPlaying ? 'Pause audio' : 'Play audio'}
            aria-label={audioPlaying ? 'Pause audio' : 'Play audio'}
          >
            {audioPlaying ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 6h3v12H8zM13 6h3v12h-3z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <div
            className="pb-audio-waveform flex-1 cursor-pointer select-none rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-2 py-2"
            onMouseDown={handleSeekPointerDown}
            role="slider"
            aria-label="Audio timeline"
            aria-valuemin={0}
            aria-valuemax={Math.max(audioDuration, 1)}
            aria-valuenow={audioCurrentTime}
          >
            <div className="flex h-8 items-end gap-[2px]">
              {waveformBars.map((bar, index) => {
                const threshold = (index + 1) / waveformBars.length;
                const isActive = threshold <= audioProgress;
                const barHeight = Math.max(4, Math.round(6 + bar * 24));
                // Active bars get the brand-accent color directly via
                // inline style so the played portion of the timeline is
                // clearly distinguishable from the upcoming portion.
                // Previously both states were variations of "text color
                // with different opacity", and the play-animation pulse
                // washed inactive bars up to near-active brightness --
                // which made it look like the entire track was played.
                //
                // The playing pulse is now ONLY applied to inactive
                // bars: played bars stay solid in primary color, upcoming
                // bars subtly pulse to show audio is live. Clean
                // progress signal + visual life, no contradiction.
                return (
                  <span
                    key={`${index}-${barHeight}`}
                    className={`pb-audio-bar ${isActive ? 'pb-audio-bar-active' : ''} ${audioPlaying && !isActive ? 'pb-audio-bar-playing' : ''}`}
                    style={{
                      height: `${barHeight}px`,
                      animationDelay: `${(index % 12) * 42}ms`,
                      backgroundColor: isActive ? 'var(--color-primary)' : undefined,
                      opacity: isActive ? 1 : undefined,
                    }}
                  />
                );
              })}
            </div>
          </div>

          <div className="min-w-[70px] text-right text-xs tabular-nums text-[var(--color-text-secondary)]">
            {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration)}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-[var(--color-text)]" title={filename}>
              {filename || 'Audio attachment'}
            </div>
            {typeof size === 'number' && (
              <div className="text-xs text-[var(--color-text-muted)]">
                {formatFileSize(size)}
              </div>
            )}
          </div>

          {/* Action cluster: volume button + download button, sitting
              next to each other so all controls feel like one group.
              The volume popover anchors above the volume button via
              `bottom-full` so it doesn't get clipped at the bubble's
              top edge. */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={volumePopoverRef}>
              <button
                type="button"
                onClick={() => setVolumePopoverOpen((prev) => !prev)}
                className="pb-focus-ring inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
                title={`Volume: ${attachmentVolume}%`}
                aria-label={`Volume: ${attachmentVolume}%`}
                aria-haspopup="true"
                aria-expanded={volumePopoverOpen}
              >
                <VolumeIcon className="h-4 w-4" aria-hidden="true" />
              </button>
              {volumePopoverOpen && (
                <div
                  role="dialog"
                  aria-label="Volume control"
                  className="absolute bottom-full right-0 z-20 mb-2 flex w-72 items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-lg"
                >
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={attachmentVolume}
                    onChange={handleVolumeSliderChange}
                    className="h-1 flex-1 cursor-pointer accent-[var(--color-primary)]"
                    aria-label="Volume"
                    autoFocus
                  />
                  <span className="min-w-[2.5rem] text-right text-xs tabular-nums text-[var(--color-text-secondary)]">
                    {attachmentVolume}%
                  </span>
                </div>
              )}
            </div>

            {/* Icon-only download. Matches the file-bubble button style
                exactly -- same primary-color treatment, since download is
                the only secondary action on an audio attachment (the
                play button is the primary action and lives on the left). */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="pb-focus-ring inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)] text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-70"
              title={`Download ${filename || 'audio'}`}
              aria-label={`Download ${filename || 'audio'}`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // File attachment (compact bubble style with prominent download button).
  // `max-w-md` (28rem / 448px) caps the bubble so it doesn't stretch across
  // the full message column the way it used to -- a file row only needs to
  // fit "icon + filename + size + download," not a paragraph's worth of
  // width. The audio + media variants are still free to grow wider since
  // their content benefits from it (waveform, image previews).
  return (
    <div
      className={`flex max-w-md items-center space-x-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4 transition-colors hover:bg-[var(--color-hover)] ${className}`}
    >
      {/* File Icon */}
      <div className="flex-shrink-0">
        {renderFileTypeIcon({ filename, mimeType: resolvedType, size: 'lg' })}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-medium text-[var(--color-text)]" title={filename}>
          {filename || 'Attachment'}
        </div>
        {typeof size === 'number' && (
          <div className="text-xs text-[var(--color-text-muted)]">
            {formatFileSize(size)}
          </div>
        )}
      </div>

      {/* Download Button -- icon-only square. Same h-8 w-8 footprint as
          the floating download buttons on image / video bubbles, but
          with the primary-color treatment kept because this is the
          file's primary (and only) CTA. */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="pb-focus-ring inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)] text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-70"
        title={`Download ${filename || 'file'}`}
        aria-label={`Download ${filename || 'file'}`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </button>
    </div>
  );
};

interface AttachmentGridProps {
  attachments: MessageAttachment[];
  className?: string;
}

const isMediaAttachment = (attachment: MessageAttachment): boolean => {
  const ext = attachment.filename
    ? (attachment.filename.split('?')[0]?.split('.').pop()?.toLowerCase() || '')
    : (attachment.url?.split('?')[0]?.split('/').pop()?.split('.').pop()?.toLowerCase() || '');
  const type = (attachment.type || '').toLowerCase();
  return (
    type.startsWith('image/') ||
    type.startsWith('video/') ||
    IMAGE_EXTENSIONS.includes(ext) ||
    VIDEO_EXTENSIONS.includes(ext)
  );
};

export const AttachmentGrid: React.FC<AttachmentGridProps> = ({
  attachments,
  className = ''
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (!attachments || attachments.length === 0) return null;

  // Split into media (image/video) vs non-media (documents, audio, files)
  const mediaAttachments = attachments.filter(isMediaAttachment);
  const otherAttachments = attachments.filter((a) => !isMediaAttachment(a));

  const getMediaGridClasses = (count: number) => {
    if (count === 1) return 'grid-cols-1 max-w-md';
    if (count === 2) return 'grid-cols-2 gap-2 max-w-lg';
    if (count === 3) return 'grid-cols-2 gap-2 max-w-lg';
    return 'grid-cols-2 gap-2 max-w-2xl';
  };

  const getMediaItemClasses = (index: number, total: number) => {
    if (total === 3 && index === 0) return 'col-span-2';
    return '';
  };

  // Build a lookup from original attachment to lightbox index (media only)
  const mediaLightboxIndices = new Map(mediaAttachments.map((a, i) => [a, i]));

  return (
    <div className={`mt-3 flex flex-col gap-2 ${className}`}>
      {/* Media grid */}
      {mediaAttachments.length > 0 && (
        <div className={`grid ${getMediaGridClasses(mediaAttachments.length)}`}>
          {mediaAttachments.map((attachment, index) => (
            <AttachmentBubble
              key={`media-${index}`}
              {...attachment}
              onClick={() => setLightboxIndex(index)}
              className={getMediaItemClasses(index, mediaAttachments.length)}
            />
          ))}
        </div>
      )}

      {/* Non-media list (documents, audio, files) */}
      {otherAttachments.map((attachment, index) => (
        <AttachmentBubble
          key={`other-${index}`}
          {...attachment}
          onClick={() => setLightboxIndex(mediaLightboxIndices.get(attachment) ?? null)}
        />
      ))}

      {lightboxIndex !== null && (
        <MediaLightbox
          attachments={mediaAttachments}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
        />
      )}
    </div>
  );
};
