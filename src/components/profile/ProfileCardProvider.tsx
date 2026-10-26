import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { peerHandle } from "../../features/dms/api";
import { useOpenDirectMessage } from "../../features/dms/hooks";
import { useMyProfile, useUsers } from "../../features/users/hooks";
import { ProfileCard } from "./ProfileCard";
import { ProfileCardContext, type CardAnchor, type ProfileCardControls } from "./profileCardContext";

const CARD_WIDTH = 300;
const MARGIN = 8;

/**
 * Lets any avatar or name open that person's card in a popover. One card at a time; it closes on
 * Escape, on a click elsewhere, and when you go to message them.
 */
export function ProfileCardProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ userId: string; anchor: CardAnchor } | null>(null);
  const open = useCallback((userId: string, anchor: CardAnchor) => setTarget({ userId, anchor }), []);
  const close = useCallback(() => setTarget(null), []);
  const controls = useMemo<ProfileCardControls>(() => ({ open, close }), [open, close]);

  return (
    <ProfileCardContext.Provider value={controls}>
      {children}
      {target && <CardPopover userId={target.userId} anchor={target.anchor} onClose={close} />}
    </ProfileCardContext.Provider>
  );
}

function CardPopover({ userId, anchor, onClose }: { userId: string; anchor: CardAnchor; onClose: () => void }) {
  const navigate = useNavigate();
  const root = useRef<HTMLDivElement>(null);
  const { data: users } = useUsers();
  const { data: me } = useMyProfile();
  const openDm = useOpenDirectMessage();
  const person = users?.find((u) => u.user_id === userId) ?? (me?.user_id === userId ? me : undefined);

  useEffect(() => {
    const dismiss = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, [onClose]);

  if (!person) return null;

  const left = Math.max(MARGIN, Math.min(anchor.x, window.innerWidth - CARD_WIDTH - MARGIN));
  // Opening upward from something (the user card): sit the card's bottom edge on it, however tall the card turns out.
  const place = anchor.bottom !== undefined ? { bottom: Math.max(MARGIN, window.innerHeight - anchor.bottom) } : { top: Math.max(MARGIN, Math.min(anchor.y, window.innerHeight - 460)) };
  const isMe = me?.user_id === person.user_id;

  return createPortal(
    <div ref={root} role="dialog" aria-label={`${person.username}'s profile`} className="fixed z-[70]" style={{ left, ...place, maxHeight: `calc(100vh - ${MARGIN * 2}px)` }}>
      <ProfileCard
        profile={person}
        size="compact"
        onMessage={
          isMe
            ? undefined
            : () => {
                openDm.mutate(peerHandle({ username: person.username, host: person.origin_server }, me?.origin_server), { onSuccess: onClose });
              }
        }
        onEdit={
          isMe
            ? () => {
                onClose();
                navigate("/settings");
              }
            : undefined
        }
      />
    </div>,
    document.body,
  );
}
