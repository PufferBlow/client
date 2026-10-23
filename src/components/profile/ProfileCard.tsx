import { useState } from "react";
import { Copy, Fingerprint, Globe, Home, MessageCircle, MoreHorizontal, Pencil, Shield } from "lucide-react";
import { ContextMenu, type MenuEntry } from "../ui/ContextMenu";
import { copyToClipboard } from "../../lib/clipboard";
import { PRESENCE } from "../../features/members/presence";
import { lookOf, type Look, type ProfileSettings } from "../../features/users/look";
import type { UserProfile } from "../../features/users/types";
import { defaultAvatarUrl } from "../../lib/identity";
import { resolveAssetUrl } from "../../services/authed";

type CardProfile = Pick<
  UserProfile,
  | "user_id"
  | "username"
  | "origin_server"
  | "about"
  | "status"
  | "pronouns"
  | "custom_status"
  | "avatar_url"
  | "banner_url"
  | "avatar_kind"
  | "banner_kind"
  | "accent_color"
  | "profile_settings"
  | "roles_ids"
  | "created_at"
>;

export interface ProfileCardProps {
  profile: CardProfile;
  /** Settings to draw instead of the saved ones (the editor's live preview). */
  draft?: ProfileSettings;
  /** A picture to draw instead of the saved avatar (the editor's preview); already resolved. */
  avatarSrc?: string;
  /** The large card of the editor, or the compact one that pops up from a name. */
  size?: "large" | "compact";
  onMessage?: () => void;
  onEdit?: () => void;
}

const SPINE_PATH = "M-5.5 0Q-2 -8 0 -13Q2 -8 5.5 0Z";
const SPINE_ANGLES = Array.from({ length: 14 }, (_, i) => (i * 360) / 14);

/** The spines or bubbles that sit around an avatar. */
function FrameDecoration({ frame }: { frame: ProfileSettings["frame"] }) {
  if (frame === "spines") {
    return (
      <svg aria-hidden="true" viewBox="-60 -60 120 120" className="pointer-events-none absolute -inset-3.5 overflow-visible" style={{ width: "calc(100% + 28px)", height: "calc(100% + 28px)" }} fill="currentColor">
        {SPINE_ANGLES.map((angle) => (
          <path key={angle} d={SPINE_PATH} transform={`rotate(${angle.toFixed(1)}) translate(0 -47)`} />
        ))}
      </svg>
    );
  }
  if (frame === "bubbles") {
    return (
      <>
        <span aria-hidden="true" className="absolute -right-2.5 -top-1 size-[18px] rounded-full shadow-[inset_0_0_0_2.5px_currentColor]" />
        <span aria-hidden="true" className="absolute -right-5 top-[18px] size-2.5 rounded-full shadow-[inset_0_0_0_2px_currentColor]" />
        <span aria-hidden="true" className="absolute -top-[22px] -right-1.5 size-3 rounded-full shadow-[inset_0_0_0_2px_currentColor]" />
      </>
    );
  }
  return null;
}

function bannerBackground(profile: CardProfile, look: Look): string {
  if (profile.banner_kind === "image" && profile.banner_url) return `url("${resolveAssetUrl(profile.banner_url) ?? ""}") center / cover`;
  if (profile.banner_kind === "solid") return profile.accent_color ?? look.hex;
  return look.banner;
}

const sectionBox = "flex flex-col gap-1.5 rounded-lg bg-black/35 p-3";
const sectionLabel = "text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-text-tertiary font-heading";

/**
 * A person's card: banner, cut-out avatar with its frame, name in the font they chose, handle with
 * instance, status, about and the sections they turned on. Only the colour is theirs to choose; the
 * text is always the client's.
 */
export function ProfileCard({ profile, draft, avatarSrc, size = "large", onMessage, onEdit }: ProfileCardProps) {
  const look = lookOf(profile, draft);
  const large = size === "large";
  const avatarSize = large ? 96 : 80;
  const image = avatarSrc ?? resolveAssetUrl(profile.avatar_url) ?? defaultAvatarUrl(look.handle);
  // The Design Language sets a card's name at 22px; the editor's large card keeps the font's own size.
  const nameFont = large ? look.nameStyle.font : look.nameStyle.font.replace(/\d+px/, "22px");
  const presence = PRESENCE[profile.status] ?? PRESENCE.offline;
  const roles = profile.roles_ids ?? [];
  const isOwner = roles.includes("owner");
  const isAdmin = roles.includes("admin");
  const { sections } = look.settings;
  const showBadges = sections.badges && (isOwner || isAdmin);
  const memberSince = profile.created_at ? new Date(profile.created_at) : null;

  return (
    <article
      aria-label={`${profile.username}'s profile`}
      className={`overflow-hidden rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.5)] ${large ? "w-[340px] max-w-full" : "w-[280px]"}`}
      style={{ background: look.cardBackground }}
    >
      <div className="relative" style={{ height: large ? 120 : 96, background: bannerBackground(profile, look) }} />
      <div className="flex flex-col gap-2.5 px-4 pb-4">
        <div className="flex items-end justify-between gap-2.5" style={{ marginTop: -avatarSize / 2 }}>
          <div className="group/avatar relative shrink-0" style={{ width: avatarSize, height: avatarSize, color: look.hex }}>
            <FrameDecoration frame={look.settings.frame} />
            <div className="relative grid place-items-center rounded-full" style={{ width: avatarSize, height: avatarSize, background: look.cardTop, boxShadow: look.ring }}>
              <img
                src={image}
                alt=""
                draggable={false}
                className={`block rounded-full object-cover transition-transform duration-(--motion-puff) ease-(--motion-ease-puff) motion-reduce:transform-none ${
                  look.puffsOnHover ? "group-hover/avatar:scale-110" : ""
                }`}
                style={{ width: avatarSize - 12, height: avatarSize - 12 }}
              />
            </div>
            {presence.dot !== "none" && (
              <span
                aria-label={presence.label}
                className="absolute right-1 bottom-1 size-4 rounded-full"
                style={{
                  background: presence.dot === "hollow" ? look.cardTop : presence.color,
                  boxShadow: `${presence.dot === "hollow" ? `inset 0 0 0 2.5px ${presence.color}, ` : ""}0 0 0 4px ${look.cardTop}`,
                }}
              />
            )}
          </div>
          {large && profile.custom_status && (
            <div className="relative mr-auto mt-14 min-w-0 max-w-[190px] self-start rounded-[14px] bg-[#161616] px-3 py-2 text-[13px] leading-snug text-text-body shadow-[0_6px_18px_rgba(0,0,0,0.35)] [overflow-wrap:anywhere]">
              <span aria-hidden="true" className="absolute -left-[7px] bottom-1 size-2.5 rounded-full bg-[#161616]" />
              <span aria-hidden="true" className="absolute -left-3.5 -bottom-[3px] size-[5px] rounded-full bg-[#161616]" />
              {profile.custom_status}
            </div>
          )}
          {showBadges && (
            <div className="mb-1.5 flex gap-1 rounded-md bg-black/35 p-[5px]">
              {isOwner && (
                <span title="Instance owner" className="grid size-6 place-items-center rounded-[7px] bg-text text-on-primary">
                  <Shield size={13} aria-hidden="true" />
                </span>
              )}
              {isAdmin && !isOwner && (
                <span title="Admin" className="grid size-6 place-items-center rounded-[7px] bg-text-tertiary text-on-primary">
                  <Shield size={13} aria-hidden="true" />
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2
              className="m-0 break-words text-text"
              style={{ font: nameFont, letterSpacing: look.nameStyle.letterSpacing, textTransform: look.nameStyle.textTransform, overflowWrap: "anywhere" }}
            >
              {profile.username}
            </h2>
            {profile.pronouns && <span className="text-[12.5px] text-text-tertiary">{profile.pronouns}</span>}
          </div>
          <span className="text-[13px] text-text-tertiary">
            {profile.username}@{profile.origin_server}
          </span>
        </div>

        {!large && profile.custom_status && (
          <span className="inline-flex max-w-full items-center gap-1.5 self-start rounded-pill bg-text/10 px-2.5 py-1 text-[12.5px] font-semibold text-text-body">
            <img src={image} alt="" width={14} height={14} className="size-3.5 shrink-0 rounded-full" />
            <span className="min-w-0 break-words">{profile.custom_status}</span>
          </span>
        )}

        <div aria-hidden="true" className="h-px bg-text/10" />

        <div className={sectionBox}>
          <span className={sectionLabel}>About me</span>
          <span className="whitespace-pre-wrap break-words text-[13.5px] leading-normal text-text-body">{profile.about?.trim() || "Nothing here yet."}</span>
          {memberSince && !Number.isNaN(memberSince.getTime()) && (
            <span className="pb-meta mt-1 text-[11.5px]">Member since {memberSince.toLocaleDateString([], { month: "long", year: "numeric" })}</span>
          )}
        </div>

        {sections.accounts && (
          <div className={sectionBox}>
            <span className={sectionLabel}>Also on</span>
            <div className="flex items-center gap-2 text-[13px]">
              <Home size={13} aria-hidden="true" className="text-text-tertiary" />
              <span className="text-text">{profile.origin_server}</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-text-muted">
                <Globe size={11} aria-hidden="true" />
                home
              </span>
            </div>
          </div>
        )}

        {(onMessage || onEdit) && (
          <div className="flex gap-2">
            {onMessage && (
              <button
                type="button"
                onClick={onMessage}
                className="pb-label-button flex h-[34px] flex-1 items-center justify-center gap-2 rounded-[9px] border-0 text-[12px] text-on-primary transition-transform active:scale-[0.97]"
                style={{ background: look.buttonColour }}
              >
                <MessageCircle size={14} aria-hidden="true" />
                Message
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="pb-label-button flex h-[34px] flex-1 items-center justify-center gap-2 rounded-[9px] border-0 text-[12px] text-on-primary transition-transform active:scale-[0.97]"
                style={{ background: look.buttonColour }}
              >
                <Pencil size={14} aria-hidden="true" />
                Edit profile
              </button>
            )}
            <MoreActions profile={profile} />
          </div>
        )}
      </div>
    </article>
  );
}

/** The card's "more" button: what can be done with this person's handle and ID without leaving the card. */
function MoreActions({ profile }: { profile: CardProfile }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const handle = `${profile.username}@${profile.origin_server}`;
  const entries: MenuEntry[] = [
    { kind: "item", id: "copy-handle", label: "Copy handle", icon: <Copy size={15} />, onSelect: () => void copyToClipboard(handle) },
    ...(profile.user_id ? [{ kind: "item" as const, id: "copy-id", label: "Copy user ID", icon: <Fingerprint size={15} />, onSelect: () => void copyToClipboard(profile.user_id) }] : []),
  ];
  return (
    <>
      <button
        type="button"
        aria-label="More"
        aria-haspopup="menu"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setAt({ x: rect.left, y: rect.bottom + 4 });
        }}
        className="grid size-[34px] shrink-0 place-items-center rounded-[9px] border-0 bg-surface-tertiary text-text-body transition-colors hover:text-text"
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {at && <ContextMenu x={at.x} y={at.y} entries={entries} label={`Actions for ${profile.username}`} onClose={() => setAt(null)} />}
    </>
  );
}
