import React, { useState, useRef, useEffect, useCallback } from 'react';

interface VideoPlayerProps {
  src: string;
  filename?: string;
  className?: string;
  onError?: () => void;
  autoPlay?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  filename,
  className = '',
  onError,
  autoPlay = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  // Auto-hide controls timer
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const skipTime = (seconds: number) => {
    if (!videoRef.current) return;
    const nextTime = Math.min(
      Math.max(0, videoRef.current.currentTime + seconds),
      duration || videoRef.current.duration || 0,
    );
    videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  }, [isPlaying]);

  const retryPlayback = () => {
    setHasError(false);
    setIsLoading(true);
    setIsBuffering(false);
    setReloadVersion((prev) => prev + 1);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

    const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
    setIsLoading(false);
    setHasError(false);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeRef.current) return;

    const rect = volumeRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newVolume = Math.max(0, Math.min(1, clickX / rect.width));

    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;

    const newMuted = !isMuted;
    setIsMuted(newMuted);
    videoRef.current.muted = newMuted;
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const togglePictureInPicture = async () => {
    const video = videoRef.current as (HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
    }) | null;
    const doc = document as Document & {
      pictureInPictureEnabled?: boolean;
      pictureInPictureElement?: Element | null;
      exitPictureInPicture?: () => Promise<void>;
    };

    if (!video || !doc.pictureInPictureEnabled) {
      return;
    }

    try {
      if (doc.pictureInPictureElement) {
        await doc.exitPictureInPicture?.();
      } else {
        await video.requestPictureInPicture?.();
      }
    } catch {
      // Ignore PiP failures and keep player usable.
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);

    // Clear existing timer
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }

    // Set new timer to hide controls after 3 seconds
    if (isPlaying) {
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying && controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 1000);
    }
  };

  // Fullscreen change handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handlePictureInPictureChange = () => {
      const doc = document as Document & { pictureInPictureElement?: Element | null };
      setIsPictureInPicture(Boolean(doc.pictureInPictureElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('enterpictureinpicture', handlePictureInPictureChange as EventListener);
    document.addEventListener('leavepictureinpicture', handlePictureInPictureChange as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('enterpictureinpicture', handlePictureInPictureChange as EventListener);
      document.removeEventListener('leavepictureinpicture', handlePictureInPictureChange as EventListener);
    };
  }, []);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);
    const handleError = () => {
      setIsLoading(false);
      setHasError(true);
      onError?.();
    };

    const handleRateChange = () => {
      setPlaybackRate(video.playbackRate || 1);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('ratechange', handleRateChange);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('ratechange', handleRateChange);
    };
  }, [onError]);

  useEffect(() => {
    if (!videoRef.current || !autoPlay) {
      return;
    }
    videoRef.current.play().catch(() => undefined);
  }, [autoPlay, src, reloadVersion]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, []);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const pictureInPictureSupported = Boolean(
    typeof document !== 'undefined' &&
      (document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled,
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === ' ' || event.key.toLowerCase() === 'k') {
      event.preventDefault();
      togglePlay();
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      skipTime(10);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      skipTime(-10);
      return;
    }
    if (event.key.toLowerCase() === 'm') {
      event.preventDefault();
      toggleMute();
      return;
    }
    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      toggleFullscreen();
      return;
    }
    if (event.key.toLowerCase() === 'p' && pictureInPictureSupported) {
      event.preventDefault();
      void togglePictureInPicture();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`group relative overflow-hidden rounded-lg bg-[var(--color-surface)] ${className}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={toggleFullscreen}
    >
      {/* Video Element */}
      <video
        key={reloadVersion}
        ref={videoRef}
        src={src}
        className="w-full h-auto max-h-96 object-contain"
        preload="metadata"
        onClick={togglePlay}
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-secondary)]">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--color-primary)]"></div>
        </div>
      )}

      {/* Buffering Indicator */}
      {isBuffering && !isLoading && (
        <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-[var(--color-surface)]/85 px-3 py-1.5 text-xs text-[var(--color-text)]">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-[var(--color-text)]"></div>
          <span>Buffering...</span>
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface)]/85">
          <div className="max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-5 text-center shadow-lg">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Video couldn&apos;t be loaded</h3>
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
              Check that the file is still available and the instance storage route supports streaming this format.
            </p>
            <button
              onClick={retryPlayback}
              className="mt-4 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Play Button Overlay (when paused) */}
      {!isPlaying && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="group/play rounded-full bg-[var(--color-surface)]/70 p-4 transition-all duration-200 hover:bg-[var(--color-surface)]/85"
          >
            <svg className="h-12 w-12 text-[var(--color-text)] transition-transform group-hover/play:scale-110" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-[var(--color-surface)]/90 p-4 backdrop-blur-sm transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress Bar */}
        <div
          ref={progressRef}
          className="mb-3 h-1 w-full cursor-pointer rounded-full bg-[var(--color-border-secondary)] transition-all hover:h-2"
          onClick={handleProgressClick}
        >
          <div
            className="relative h-full rounded-full bg-[var(--color-primary)]"
            style={{ width: `${progressPercentage}%` }}
          >
            <div className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[var(--color-primary)] opacity-0 transition-opacity group-hover:opacity-100"></div>
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between text-[var(--color-text)]">
          {/* Left Controls */}
          <div className="flex items-center space-x-3">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="rounded-full p-2 transition-colors hover:bg-[var(--color-hover)]"
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            {/* Time Display */}
            <div className="text-sm font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            <button
              onClick={() => skipTime(-10)}
              className="rounded-full px-2 py-1 text-xs transition-colors hover:bg-[var(--color-hover)]"
              title="Back 10 seconds"
            >
              -10s
            </button>

            <button
              onClick={() => skipTime(10)}
              className="rounded-full px-2 py-1 text-xs transition-colors hover:bg-[var(--color-hover)]"
              title="Forward 10 seconds"
            >
              +10s
            </button>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-2">
            <span className="hidden rounded-full border border-[var(--color-border-secondary)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)] md:inline-flex">
              {hasError ? "Error" : isBuffering ? "Buffering" : isPlaying ? "Playing" : "Paused"}
            </span>
            {/* Volume Control */}
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className="rounded-full p-2 transition-colors hover:bg-[var(--color-hover)]"
              >
                {isMuted || volume === 0 ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>
              <div
                ref={volumeRef}
                className="h-1 w-16 cursor-pointer rounded-full bg-[var(--color-border-secondary)] transition-all hover:h-2"
                onClick={handleVolumeChange}
              >
                <div
                  className="h-full rounded-full bg-[var(--color-text)]"
                  style={{ width: `${volume * 100}%` }}
                ></div>
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-full px-2 py-1 text-xs transition-colors hover:bg-[var(--color-hover)]">
              <span className="text-[var(--color-text-secondary)]">Speed</span>
              <select
                value={playbackRate}
                onChange={(event) => {
                  const nextRate = Number(event.target.value);
                  setPlaybackRate(nextRate);
                  if (videoRef.current) {
                    videoRef.current.playbackRate = nextRate;
                  }
                }}
                className="rounded border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-2 py-1 text-[var(--color-text)]"
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}x
                  </option>
                ))}
              </select>
            </label>

            {pictureInPictureSupported && (
              <button
                onClick={() => void togglePictureInPicture()}
                className="rounded-full p-2 transition-colors hover:bg-[var(--color-hover)]"
                title={isPictureInPicture ? 'Exit picture-in-picture' : 'Picture-in-picture'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isPictureInPicture ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16v12H4V6zm8 4h5v4h-5v-4z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16v12H4V6zm9 3h4v3h-4V9z" />
                  )}
                </svg>
              </button>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="rounded-full p-2 transition-colors hover:bg-[var(--color-hover)]"
            >
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 3l-7 7m0 0l7 7m-7-7v12M3 21l7-7m0 0l-7-7m7 7H3" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Filename Overlay */}
      {filename && (
        <div className="absolute left-0 right-0 top-0 bg-[var(--color-surface)]/85 p-3">
          <p className="truncate text-sm font-medium text-[var(--color-text)]" title={filename}>
            {filename}
          </p>
        </div>
      )}
    </div>
  );
};
