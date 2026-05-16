import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, MonitorUp, MonitorOff, PhoneOff, Volume2, VolumeX } from 'lucide-react';
import type { VoiceSessionActions } from './VoiceChannel';
import type { VoiceParticipant } from '../services/voiceTransport';
import { VoiceParticipantContextMenu } from './VoiceParticipantContextMenu';

/**
 * Resolved banner descriptor for a participant tile. Mirrors the shape
 * returned by `resolveBanner` in services/user.ts so DashboardPage can
 * forward that helper's output directly, but kept as a local type so
 * this component doesn't import from the services layer.
 */
export type ResolvedParticipantBanner =
  | { kind: 'image'; url: string }
  | { kind: 'color'; color: string };

interface VoiceCallUIProps {
  channelName: string;
  session: VoiceSessionActions;
  currentUserId?: string;
  currentUsername?: string;
  /**
   * Resolver that maps a participant's `user_id` (plus their currently
   * known username, if any) to a fully-qualified avatar URL.
   *
   * The transport's `VoiceParticipant` only carries `{ user_id, username,
   * is_muted, ... }` — there's no avatar field on the wire, since the SFU
   * doesn't store user profile data. So the consumer (DashboardPage,
   * which already has the hydrated users list) supplies a lookup that
   * resolves through its own user cache and falls back to an identicon
   * if the participant isn't in the local cache yet (e.g. federated
   * peer that hasn't been hydrated).
   *
   * Optional so the component is still renderable in isolation
   * (storybook, tests) — when omitted, ParticipantCard renders the
   * letter-on-color fallback as before.
   */
  resolveAvatarUrl?: (userId: string, username?: string) => string | undefined;
  /**
   * Banner resolver. Returns either an image URL (renders as background-
   * image) or a solid color (renders as background-color), or `undefined`
   * if the consumer can't resolve anything for this user — in which case
   * the card falls back to a hash-derived color so each tile still has
   * its own identity. Mirrors the avatar resolver pattern: the consumer
   * owns the user cache and the lookup logic, this component just paints.
   */
  resolveBanner?: (userId: string, username?: string) => ResolvedParticipantBanner | undefined;
  /**
   * Fires when a participant tile is left-clicked. Used by the dashboard
   * to open that user's profile card (the same flow as clicking a member
   * in the right-side members list or a sender in the messages stream).
   * Right-click is unaffected and continues to open the participant
   * context menu.
   */
  onParticipantClick?: (userId: string, username: string, event: React.MouseEvent) => void;
}

interface ParticipantCardProps {
  participant: VoiceParticipant;
  isSelf: boolean;
  session: VoiceSessionActions;
  avatarUrl?: string;
  banner?: ResolvedParticipantBanner;
  /**
   * Fires on right-click. The parent (VoiceCallUI) owns the menu state
   * so only one menu can be open across all tiles. The card just reports
   * the position + which participant was clicked.
   */
  onContextMenu?: (event: React.MouseEvent, participant: VoiceParticipant, isSelf: boolean) => void;
  /**
   * Fires on left-click. Used to open the user's profile tooltip card.
   * Optional -- if omitted, the tile has no left-click behavior.
   */
  onClick?: (event: React.MouseEvent, participant: VoiceParticipant) => void;
}

/**
 * Deterministic background color per user_id. Used when no banner image
 * and no resolver-supplied color is available, so each tile still has
 * its own identity instead of every fallback looking identical. The
 * cheap djb2-style hash keeps the same user pinned to the same color
 * across reconnects.
 */
const colorFromUserId = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  // Mid-saturation, mid-low lightness keeps the avatar (light/colored)
  // readable on top and keeps the username pill's dark backdrop visible.
  return `hsl(${hue}, 45%, 32%)`;
};

/**
 * Renders a single MediaStream into a `<video>` element. Used for both
 * the local self-preview (muted so the user doesn't hear their own
 * shared audio twice) and remote peers. The video element's srcObject
 * is bound via ref so React's diffing doesn't try to serialize the
 * MediaStream into the DOM — that would crash on Object→String.
 */
interface ScreenShareTileProps {
  stream: MediaStream;
  label: string;
  isLocal?: boolean;
}

const ScreenShareTile: React.FC<ScreenShareTileProps> = ({ stream, label, isLocal = false }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    // play() can reject if the tab is backgrounded — swallow the
    // promise rejection; the browser will resume on focus.
    void video.play().catch(() => undefined);
    return () => {
      // Release the binding on unmount so the GC can reclaim the
      // stream wrapper. We don't stop tracks here — the transport
      // owns track lifecycle.
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-black p-1 max-w-[280px]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-auto rounded-md aspect-video object-contain bg-black"
      />
      <div className="flex items-center gap-1 px-1 pb-0.5">
        <MonitorUp className="w-3 h-3 text-[var(--color-info)]" />
        <span className="text-[10px] text-[var(--color-text-muted)] truncate">{label}</span>
        {isLocal && <span className="text-[10px] text-[var(--color-text-muted)]">(you)</span>}
      </div>
    </div>
  );
};

const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  isSelf,
  session,
  avatarUrl,
  banner,
  onContextMenu,
  onClick,
}) => {
  const displayName = participant.username || `User ${participant.user_id.slice(-4)}`;
  // When an avatar URL is supplied we render <img>. If that image 404s
  // (deleted upload, stale URL, network blip) we want to gracefully
  // collapse back to the letter-on-color fallback for that one card
  // rather than showing a broken-image icon. The `imgFailed` flag is
  // local to the card so other participants aren't affected.
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);
  const [bannerImgFailed, setBannerImgFailed] = useState(false);
  const showAvatarImage = !!avatarUrl && !avatarImgFailed;

  // Banner resolution order:
  //   1. Resolver-supplied image -> render as <img> (so we get onError
  //      to fall back) absolutely positioned to fill the tile.
  //   2. Resolver-supplied solid color -> background-color.
  //   3. Nothing -> deterministic hash-derived color so each tile still
  //      has its own visual identity even when no banner is set.
  // The fallback color also kicks in when a resolver image 404s.
  const fallbackColor = colorFromUserId(participant.user_id);
  const showBannerImage = banner?.kind === 'image' && !bannerImgFailed;
  const tileBackgroundColor =
    banner?.kind === 'color' ? banner.color : fallbackColor;

  // ── Animated-banner hover-to-play ──────────────────────────────────
  //
  // GIFs and other animated formats (animated WebP/AVIF/APNG) play
  // unconditionally inside an <img> element -- the browser doesn't
  // expose pause controls. To get "play on hover only" we render the
  // first frame as a static snapshot at rest and swap in the live URL
  // when the tile is hovered.
  //
  // How the snapshot is made: on the live <img>'s first load, we draw
  // it into a hidden <canvas>, which only captures one frame, then
  // export to a data URL. That data URL becomes the rest-state src.
  //
  // Why only specific extensions trigger the dance: non-animated
  // formats (jpg, png, static webp) gain nothing from the snapshot
  // pathway, and the canvas dance has real costs (decode + dataURL
  // export) for every tile mount. Cap it at formats that *could* be
  // animated. Static webp/avif still get snapshotted -- harmless, just
  // a few hundred KB of base64 -- but those are inherently rare for
  // user banners.
  //
  // CORS caveat: drawImage() on a cross-origin image taints the
  // canvas, so toDataURL() throws SecurityError. We swallow it; in
  // that case the banner just animates as before. This matters when
  // banners are served from a federated instance that doesn't send
  // Access-Control-Allow-Origin.
  const [isHovered, setIsHovered] = useState(false);
  const [frozenBannerSrc, setFrozenBannerSrc] = useState<string | null>(null);
  const couldBeAnimated =
    banner?.kind === 'image' && /\.(gif|webp|apng|avif)(\?|#|$)/i.test(banner.url);

  const handleBannerLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!couldBeAnimated || frozenBannerSrc) return;
    const img = e.currentTarget;
    try {
      // Downscale large banners so the base64 data URL doesn't blow up
      // in memory. 600px wide is plenty for a 16:10 tile that maxes
      // out around ~480px in practice.
      const maxW = 600;
      const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
      const w = Math.max(1, Math.round((img.naturalWidth || maxW) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || maxW) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      setFrozenBannerSrc(canvas.toDataURL('image/png'));
    } catch {
      // CORS taint or unexpected canvas failure -- leave the banner
      // animating. Better than a blank tile.
    }
  };

  // Effective src: hovered always shows the original (animated) URL;
  // not hovered shows the frozen snapshot once captured, falling back
  // to the live URL until the first onLoad fires.
  const effectiveBannerSrc =
    banner?.kind === 'image'
      ? !couldBeAnimated || isHovered
        ? banner.url
        : frozenBannerSrc ?? banner.url
      : undefined;

  return (
    <div
      className={`group relative overflow-hidden rounded-xl aspect-[16/10] transition-all ${
        onClick ? 'cursor-pointer' : 'cursor-context-menu'
      } ${
        participant.is_speaking
          ? 'ring-2 ring-[var(--color-success)] shadow-[0_0_0_2px_rgba(0,200,100,0.25)]'
          : 'ring-1 ring-[var(--color-border)]/60'
      }`}
      style={{ backgroundColor: tileBackgroundColor }}
      // Left-click → parent opens the user's profile card (same flow as
      // clicking a member in the right-side members list).
      onClick={(e) => onClick?.(e, participant)}
      // Right-click → parent opens the participant context menu. The
      // browser's default menu would only offer "save image" etc., none
      // of which are relevant here, so we preventDefault unconditionally.
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, participant, isSelf);
      }}
      // Hover toggles the animated-banner playback: at rest we show a
      // frozen first-frame snapshot, on hover we swap to the live URL
      // so the GIF / animated WebP plays. See `effectiveBannerSrc`.
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Banner image layer: absolutely positioned full-bleed below the
          content. Falls back to the tile's background color (set above)
          if there's no image or the image fails to load. */}
      {showBannerImage && banner?.kind === 'image' && (
        <img
          src={effectiveBannerSrc ?? banner.url}
          alt=""
          aria-hidden="true"
          onError={() => setBannerImgFailed(true)}
          onLoad={handleBannerLoad}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* Subtle dark overlay so the avatar + username pill stay legible
          regardless of how light/busy the banner image is. Kept very
          gentle (~25% black) so brand-colored banners still read as
          themselves. */}
      <div className="absolute inset-0 bg-black/25" aria-hidden="true" />

      {/* Centered avatar. Uses an absolute layer so the tile aspect ratio
          drives sizing and the avatar always sits dead-center regardless
          of banner content. */}
      <div className="absolute inset-0 flex items-center justify-center">
        {showAvatarImage ? (
          <img
            src={avatarUrl}
            alt={displayName}
            onError={() => setAvatarImgFailed(true)}
            className={`h-20 w-20 rounded-full object-cover shadow-lg transition-opacity ${
              participant.is_muted && !isSelf ? 'opacity-70' : ''
            }`}
          />
        ) : (
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold text-white shadow-lg"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Speaking pulse: a soft green ring that animates around the
            avatar while the participant is speaking. Implemented as an
            absolutely positioned sibling so it doesn't affect the
            avatar's intrinsic size or alignment. */}
        {participant.is_speaking && (
          <span
            className="pointer-events-none absolute h-24 w-24 animate-pulse rounded-full ring-4 ring-[var(--color-success)] ring-offset-2 ring-offset-transparent"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Username pill: bottom-left. Dark semi-transparent backdrop so
          the name stays readable on any banner color. */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 max-w-[calc(100%-1rem)]">
        <div className="flex items-center gap-1.5 rounded-md bg-black/55 backdrop-blur-sm px-2 py-1">
          <span className="truncate text-xs font-medium text-white">
            {displayName}
            {isSelf && <span className="ml-1 text-white/60">(you)</span>}
          </span>
          {/* Inline mute/deafen indicators next to the name, like Discord. */}
          {participant.is_muted && (
            <MicOff className="h-3 w-3 flex-shrink-0 text-[var(--color-error)]" aria-label="muted" />
          )}
          {participant.is_deafened && (
            <VolumeX className="h-3 w-3 flex-shrink-0 text-[var(--color-error)]" aria-label="deafened" />
          )}
        </div>
      </div>

      {/* The per-peer volume slider used to live here as a hover-reveal.
          It now lives in the right-click context menu (see
          VoiceParticipantContextMenu) so the tile stays clean and the
          interaction model matches the rest of the app (right-click for
          per-entity actions). */}
    </div>
  );
};

export const VoiceCallUI: React.FC<VoiceCallUIProps> = ({
  channelName,
  session,
  currentUserId,
  currentUsername,
  resolveAvatarUrl,
  resolveBanner,
  onParticipantClick,
}) => {
  const {
    participants,
    isMuted,
    isDeafened,
    toggleMute,
    toggleDeafen,
    leave,
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
    remoteScreenShares,
    localScreenStream,
  } = session;

  // Build a username lookup for labeling remote screen-share tiles.
  // participants comes from the transport's participant_joined stream
  // so usernames may be empty for very fresh joins — fall back to a
  // truncated user_id which is still better than "unknown".
  const usernameForUser = (userId: string): string => {
    const found = participants.find((p) => p.user_id === userId);
    return found?.username || `User ${userId.slice(-4)}`;
  };

  const hasAnyShares = isScreenSharing || remoteScreenShares.size > 0;

  // Right-click context menu state for per-participant actions (volume,
  // copy id, future moderation). Lives at this level so only one menu
  // can be open across all tiles -- right-clicking another tile while
  // the menu is open simply repositions it to that participant.
  const [participantMenu, setParticipantMenu] = useState<{
    userId: string;
    username?: string;
    isSelf: boolean;
    x: number;
    y: number;
  } | null>(null);

  // Include self as a participant card if not already in list
  const allParticipants: VoiceParticipant[] = React.useMemo(() => {
    if (currentUserId && !participants.some((p) => p.user_id === currentUserId)) {
      return [
        {
          user_id: currentUserId,
          username: currentUsername,
          is_muted: isMuted,
          is_deafened: isDeafened,
          is_speaking: false,
        },
        ...participants,
      ];
    }
    return participants;
  }, [participants, currentUserId, currentUsername, isMuted, isDeafened]);

  return (
    // Full-panel layout: a vertical flex column whose middle section
    // (participant grid + screen-share tiles) takes the remaining
    // height. The header and control bar are flex-shrink-0 so the grid
    // is what stretches as the window resizes.
    <div className="flex h-full flex-col bg-[var(--color-surface)]/50">
      {/* Call header */}
      <div className="flex flex-shrink-0 items-center gap-2 px-4 py-2 border-b border-[var(--color-border)]/50">
        <Volume2 className="w-4 h-4 text-[var(--color-success)]" />
        <span className="font-semibold text-[var(--color-text)] text-sm">{channelName}</span>
        <span className="text-xs text-[var(--color-text-muted)]">
          · {allParticipants.length} in voice
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-[var(--color-success)] font-medium">● Connected</span>
        </div>
      </div>

      {/* Screen-share tile row. Rendered above the participant grid so
          the active sharer's content is the visual focus; participants
          collapse to small avatars below. */}
      {hasAnyShares && (
        <div className="flex flex-shrink-0 flex-wrap gap-2 px-4 py-3 border-b border-[var(--color-border)]/50">
          {localScreenStream && currentUserId && (
            <ScreenShareTile
              key={`local:${currentUserId}`}
              stream={localScreenStream}
              label={currentUsername || 'You'}
              isLocal
            />
          )}
          {Array.from(remoteScreenShares.entries()).map(([userId, stream]) => (
            <ScreenShareTile
              key={`remote:${userId}`}
              stream={stream}
              label={usernameForUser(userId)}
            />
          ))}
        </div>
      )}

      {/* Participant grid: the flex-1 / overflow-auto here is what makes
          the tile grid expand to fill the panel and scroll on overflow
          while the header and control bar stay pinned. */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {allParticipants.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-[var(--color-text-muted)]">
            <Volume2 className="w-4 h-4 opacity-40" />
            <span className="text-xs">You joined the voice channel. Waiting for others...</span>
          </div>
        ) : (
          // Discord-style responsive tile grid. Tiles maintain a 16:10
          // aspect ratio (set in ParticipantCard itself), so the grid
          // just controls how many tiles per row at each breakpoint.
          // The participant grid grows with the panel width:
          //   - phones / narrow:         2 columns
          //   - tablets, narrow desktop: 3 columns
          //   - wide desktop:            4 columns
          // Note: this is a JS comment (not a {/* JSX comment */}) because
          // we're at the top of a parenthesized JSX expression -- there
          // the `{` of a JSX comment is parsed as an object literal opener,
          // not a JSX expression slot, which breaks the surrounding tree.
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {allParticipants.map((p) => (
              <ParticipantCard
                key={p.user_id}
                participant={p}
                isSelf={p.user_id === currentUserId}
                session={session}
                avatarUrl={resolveAvatarUrl?.(p.user_id, p.username)}
                banner={resolveBanner?.(p.user_id, p.username)}
                onContextMenu={(e, participant, isSelf) => {
                  setParticipantMenu({
                    userId: participant.user_id,
                    username: participant.username,
                    isSelf,
                    x: e.clientX,
                    y: e.clientY,
                  });
                }}
                onClick={
                  onParticipantClick
                    ? (e, participant) =>
                        onParticipantClick(
                          participant.user_id,
                          participant.username || `User ${participant.user_id.slice(-4)}`,
                          e,
                        )
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Control bar. Centered horizontally so the mute / share / deafen
          / leave cluster sits in the middle of the panel regardless of
          window width -- gives a focal, Discord-like footer rather than
          a left-anchored toolbar. */}
      <div className="flex flex-shrink-0 items-center justify-center gap-2 px-4 py-2 border-t border-[var(--color-border)]/50">
        <button
          onClick={() => void toggleMute()}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-[20px] text-xs font-medium transition-colors border border-[var(--color-border)] ${
            isMuted
              ? 'bg-[var(--color-error)] text-[var(--color-on-error)] hover:bg-[var(--color-error)]/90'
              : 'bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-hover)]'
          }`}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          {isMuted ? 'Unmute' : 'Mute'}
        </button>

        <button
          onClick={() => {
            if (isScreenSharing) {
              void stopScreenShare();
            } else {
              // Swallow NotAllowed/Abort silently — that's "user cancelled
              // the picker," which isn't an error worth flashing.
              void startScreenShare().catch((error) => {
                const name = error instanceof DOMException ? error.name : '';
                if (name !== 'NotAllowedError' && name !== 'AbortError') {
                  console.warn('Screen share failed:', error);
                }
              });
            }
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-[20px] text-xs font-medium transition-colors border border-[var(--color-border)] ${
            isScreenSharing
              ? 'bg-[var(--color-info)] text-[var(--color-on-info)] hover:bg-[var(--color-info)]/90'
              : 'bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-hover)]'
          }`}
          title={isScreenSharing ? 'Stop screen sharing' : 'Share your screen'}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-3.5 h-3.5" />
          ) : (
            <MonitorUp className="w-3.5 h-3.5" />
          )}
          {isScreenSharing ? 'Stop sharing' : 'Share screen'}
        </button>

        <button
          onClick={() => void toggleDeafen()}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-[20px] text-xs font-medium transition-colors border border-[var(--color-border)] ${
            isDeafened
              ? 'bg-[var(--color-error)] text-[var(--color-on-error)] hover:bg-[var(--color-error)]/90'
              : 'bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-hover)]'
          }`}
        >
          <VolumeX className="w-3.5 h-3.5" />
          {isDeafened ? 'Undeafen' : 'Deafen'}
        </button>

        <button
          onClick={() => void leave()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[20px] text-xs font-medium bg-[var(--color-error)]/85 text-[var(--color-on-error)] hover:bg-[var(--color-error)] transition-colors border border-[var(--color-border)]"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          Leave
        </button>
      </div>

      {/* Right-click menu for per-participant actions. Driven by tile
          context-menu events above; reads the current volume from the
          session on every open so it reflects any cross-tab or transport-
          side adjustments. Writes go directly through session.setUserVolume
          so the menu doesn't need to track volume state itself. */}
      <VoiceParticipantContextMenu
        isOpen={participantMenu !== null}
        position={{ x: participantMenu?.x ?? 0, y: participantMenu?.y ?? 0 }}
        userId={participantMenu?.userId ?? ''}
        username={participantMenu?.username}
        isSelf={participantMenu?.isSelf ?? false}
        initialVolume={
          participantMenu && !participantMenu.isSelf
            ? session.getUserVolume(participantMenu.userId)
            : undefined
        }
        onVolumeChange={(v) => {
          if (participantMenu) {
            session.setUserVolume(participantMenu.userId, v);
          }
        }}
        onClose={() => setParticipantMenu(null)}
      />
    </div>
  );
};

export default VoiceCallUI;
