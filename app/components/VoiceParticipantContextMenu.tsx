/**
 * VoiceParticipantContextMenu — right-click menu for a voice-channel
 * participant tile (or sidebar row). Holds per-peer actions:
 *
 *   - Volume slider (only for non-self; you can't lower your own volume)
 *   - Copy User ID (always useful in admin / debugging flows)
 *
 * Why not reuse `ContextMenu` from ui/ContextMenu.tsx?
 *   That component renders each item as a single <button> with an icon
 *   and a label. A volume slider needs a drag input and a value display,
 *   which doesn't fit the item shape. So this is its own positioned
 *   surface that mirrors the same interaction model (backdrop click +
 *   Escape + viewport clamping) and reuses the shared `pb-menu` styling
 *   so it looks visually consistent with the rest of the app's menus.
 *
 * Mounting: render inside the component that owns the participant row;
 * keep `isOpen` / `position` state at that level so multiple tiles
 * don't fight over a single menu instance.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, VolumeX, Copy } from "lucide-react";

interface VoiceParticipantContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  userId: string;
  username?: string;
  /**
   * `true` if this menu is being opened on the local user's own tile.
   * Hides the volume slider (no point letting users lower their own
   * playback volume — that doesn't make sense for self) while still
   * allowing the other items.
   */
  isSelf: boolean;
  /**
   * Current playback volume for this peer, 0..1. Required when isSelf
   * is false. Ignored when isSelf is true.
   */
  initialVolume?: number;
  /**
   * Fires on every slider tick. The consumer pushes the new value
   * through to the transport (`transport.setUserVolume(...)`) and is
   * also responsible for persisting it across menu close/reopen, since
   * this menu unmounts its slider state when closed.
   */
  onVolumeChange?: (v: number) => void;
  onClose: () => void;
}

export function VoiceParticipantContextMenu({
  isOpen,
  position,
  userId,
  username,
  isSelf,
  initialVolume,
  onVolumeChange,
  onClose,
}: VoiceParticipantContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  // Local mirror of the slider so dragging stays responsive even if the
  // parent's transport.getUserVolume() is throttled or async.
  const [volume, setVolume] = useState(() => initialVolume ?? 1);

  // Resync when the menu re-opens against a different participant. We
  // don't sync continuously while open -- that would fight the user's
  // drag.
  useEffect(() => {
    if (isOpen) setVolume(initialVolume ?? 1);
  }, [isOpen, initialVolume, userId]);

  useEffect(() => {
    if (!isOpen) return;
    const onOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onOutsideClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isOpen, onClose]);

  // Viewport clamping so right-click near the right/bottom edge doesn't
  // open a menu that overflows off-screen.
  const safePosition = useMemo(() => {
    const gap = 8;
    const width = 240;
    const maxHeight = 200;
    const x = Math.min(Math.max(gap, position.x), window.innerWidth - width - gap);
    const y = Math.min(Math.max(gap, position.y), window.innerHeight - maxHeight - gap);
    return { x, y };
  }, [position]);

  if (!isOpen) return null;

  const displayName = username || `User ${userId.slice(-4)}`;
  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    onVolumeChange?.(v);
  };

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(userId);
    } catch {
      // Clipboard write can fail in non-secure contexts; silent is fine
      // here because the menu closes immediately afterward and the user
      // has nothing to act on.
    }
    onClose();
  };

  return (
    <>
      {/* Backdrop for click-out-to-close. Transparent; doesn't dim. */}
      <button
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-label="Close menu backdrop"
      />
      <div
        ref={menuRef}
        className="pb-menu fixed z-50 rounded-xl py-2"
        style={{ left: safePosition.x, top: safePosition.y, minWidth: 240 }}
      >
        {/* Header: who you're acting on. Kept compact so the menu
            doesn't feel like a profile card. */}
        <div className="px-3 pb-2 border-b border-[var(--color-border)]/60">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Voice participant
          </div>
          <div className="text-sm font-medium text-[var(--color-text)] truncate">
            {displayName}
            {isSelf && <span className="ml-1 text-[var(--color-text-muted)] font-normal">(you)</span>}
          </div>
        </div>

        {/* Volume slider section: hidden for self. The numeric percentage
            on the right gives the user a precise readout while dragging. */}
        {!isSelf && (
          <div className="px-3 py-2 border-b border-[var(--color-border)]/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                Volume
              </span>
              <span className="text-xs font-mono text-[var(--color-text-muted)]">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <VolumeX className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-text-muted)]" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={handleVolume}
                className="flex-1 h-1 accent-[var(--color-primary)] cursor-pointer"
                aria-label={`Volume for ${displayName}`}
              />
              <Volume2 className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-text-muted)]" />
            </div>
          </div>
        )}

        {/* Standard items. Currently just Copy User ID -- moderation
            actions (mute, deafen, kick) can be added here later without
            disturbing the slider section above. */}
        <button
          onClick={handleCopyId}
          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-hover)] transition-colors"
        >
          <Copy className="h-4 w-4 flex-shrink-0 text-[var(--color-text-muted)]" />
          <span>Copy User ID</span>
        </button>
      </div>
    </>
  );
}
