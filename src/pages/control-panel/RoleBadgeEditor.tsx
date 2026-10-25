import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Chip, Group } from "../../components/settings/Pickers";
import { FeedbackLine, type Feedback } from "../../components/settings/SettingsParts";
import { BADGE_GLYPHS, BADGE_PALETTE, BADGE_TONES, badgeColour, type BadgePreset, type BadgeTier, canModerate, GLYPH_NAMES, IMAGE_GLYPH, NEW_BADGE, ProgressBar, ROLE_PRESETS, RoleBadge, type RoleBadgeData, RoleTag } from "@pufferblow/spines";
import { uploadBadgeImage } from "../../features/admin/api";
import { classifyAuthError } from "../../utils/authErrors";

const TIER_HELP: Record<"community" | "staff", string> = {
  community: "Rounded square. Works for any role without moderation permissions.",
  staff: "Spined shape. Requires at least one moderation permission on the role.",
};

const SIZES = [64, 32, 20, 16] as const;

export interface RoleBadgeEditorProps {
  roleName: string;
  badge: RoleBadgeData | null;
  onChange: (badge: RoleBadgeData | null) => void;
  /** The privileges ticked on the role, to know whether it may have the staff shape. */
  privileges: ReadonlySet<string>;
  /** Picking a preset also names a role that has no name yet. */
  onPreset?: (preset: BadgePreset) => void;
}

/**
 * A role's badge: a starting point, a tier, a colour and a glyph (or an uploaded picture), with the badge
 * shown at every size it will appear at beside the choices.
 */
export function RoleBadgeEditor({ roleName, badge, onChange, privileges, onPreset }: RoleBadgeEditorProps) {
  const file = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const may = canModerate(privileges);
  const shown = badge ?? NEW_BADGE;
  const set = (change: Partial<RoleBadgeData>) => onChange({ ...shown, ...change, tier: change.tier ?? shown.tier });

  const upload = async (picked: File | undefined) => {
    if (!picked) return;
    setFeedback(null);
    if (!/\.png$/i.test(picked.name) && picked.type !== "image/png") {
      setFeedback({ kind: "error", message: "A badge picture must be a PNG." });
      return;
    }
    if (picked.size > 256 * 1024) {
      setFeedback({ kind: "error", message: "The picture is larger than 256 KB." });
      return;
    }
    setProgress({ loaded: 0, total: picked.size });
    try {
      const url = await uploadBadgeImage(picked, (loaded, total) => setProgress({ loaded, total }));
      onChange({ ...shown, glyph: IMAGE_GLYPH, image_url: url });
    } catch (error) {
      setFeedback({ kind: "error", message: classifyAuthError(error, "Couldn't upload the picture. Try again.").message });
    } finally {
      setProgress(null);
      if (file.current) file.current.value = "";
    }
  };

  const startFrom = (preset: BadgePreset) => {
    onChange({ tier: preset.tier === "staff" && !may ? "community" : preset.tier, tone: preset.tone, glyph: preset.glyph });
    onPreset?.(preset);
  };

  return (
    <div className="flex flex-col gap-5">
      <div role="group" aria-label="Badge" className="flex flex-wrap items-center gap-1.5">
        <Chip selected={badge === null} onClick={() => onChange(null)}>
          No badge
        </Chip>
        <Chip selected={badge !== null} onClick={() => badge === null && onChange(NEW_BADGE)}>
          Has a badge
        </Chip>
        <span className="pb-meta ml-1 text-[12.5px]">A small mark after the name. Roles without one show a dot.</span>
      </div>

      {badge && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex min-w-0 flex-col gap-5">
            <Group label="Start from">
              <div className="flex flex-wrap gap-1.5">
                {ROLE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    aria-label={`Start from ${preset.name}`}
                    onClick={() => startFrom(preset)}
                    className="pb-label-button inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border-0 bg-surface-tertiary pl-1.5 pr-3 text-[11.5px] text-text-body hover:bg-active"
                  >
                    <RoleBadge badge={{ tier: preset.tier, tone: preset.tone, glyph: preset.glyph }} size={20} />
                    {preset.name}
                  </button>
                ))}
              </div>
            </Group>

            <Group label="Tier">
              <div className="flex flex-wrap gap-1.5">
                {(["community", "staff"] as const satisfies readonly BadgeTier[]).map((tier) => (
                  <Chip key={tier} selected={badge.tier === tier} onClick={() => set({ tier })}>
                    {tier === "staff" ? "Staff" : "Community"}
                  </Chip>
                ))}
              </div>
              <span className={`text-[12.5px] ${badge.tier === "staff" && !may ? "text-error-text" : "pb-meta"}`}>
                {badge.tier === "staff" && !may ? "The staff shape needs a moderation permission on this role: tick one below, or choose Community." : TIER_HELP[badge.tier === "staff" ? "staff" : "community"]}
              </span>
            </Group>

            <Group label="Colour">
              <div className="flex flex-wrap gap-2.5">
                {BADGE_TONES.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    aria-label={`Badge colour: ${tone}`}
                    aria-pressed={badge.tone === tone}
                    title={tone}
                    onClick={() => set({ tone })}
                    className="size-[30px] cursor-pointer rounded-full border-0 transition-shadow aria-pressed:shadow-[0_0_0_3px_var(--color-background-secondary),0_0_0_5px_var(--color-text)]"
                    style={{ background: BADGE_PALETTE[tone] }}
                  />
                ))}
              </div>
            </Group>

            <Group label="Glyph">
              <div className="grid grid-cols-[repeat(auto-fill,44px)] gap-1.5">
                {GLYPH_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-label={`Glyph: ${name}`}
                    aria-pressed={badge.glyph === name}
                    title={name}
                    onClick={() => onChange({ tier: badge.tier, tone: badge.tone, glyph: name })}
                    className={`grid size-11 cursor-pointer place-items-center rounded-[10px] border-0 p-0 ${badge.glyph === name ? "bg-text text-on-primary" : "bg-surface-tertiary text-text-body hover:bg-active"}`}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={BADGE_GLYPHS[name]} style={{ fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }} />
                    </svg>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 rounded-[12px] bg-surface-tertiary p-3">
                <button
                  type="button"
                  aria-label="Upload an image"
                  aria-pressed={badge.glyph === IMAGE_GLYPH}
                  disabled={progress !== null}
                  onClick={() => file.current?.click()}
                  className={`grid size-11 shrink-0 cursor-pointer place-items-center rounded-[10px] border-0 p-0 shadow-[inset_0_0_0_1.5px_rgba(242,242,242,0.25)] ${badge.glyph === IMAGE_GLYPH ? "bg-text text-on-primary" : "bg-transparent text-text-tertiary"}`}
                >
                  <Upload size={20} aria-hidden="true" />
                </button>
                <input ref={file} type="file" hidden accept="image/png,.png" aria-label="Badge picture file" onChange={(e) => void upload(e.target.files?.[0])} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[13.5px] font-semibold">Upload an image</span>
                  <span className="pb-meta text-[12px]">A PNG, 128 × 128, under 256 KB. It is cropped to the tier shape, so keep the subject inside the middle 75%.</span>
                  {progress && <ProgressBar loaded={progress.loaded} total={progress.total} label="Uploading the badge picture" />}
                  <FeedbackLine feedback={feedback} />
                </div>
              </div>
            </Group>
          </div>

          <div className="flex flex-col items-center gap-5 rounded-lg bg-background p-5 xl:sticky xl:top-0">
            <div className="flex items-end justify-center gap-5">
              {SIZES.map((size) => (
                <div key={size} className="flex flex-col items-center gap-2">
                  <RoleBadge badge={badge} size={size} />
                  <span className="font-mono text-[11px] text-text-muted">{size}</span>
                </div>
              ))}
            </div>
            <div aria-label="Preview in chat" className="flex w-full items-center gap-2.5 rounded-md bg-surface p-2.5">
              <span className="text-[15px] font-bold text-text">Vexa</span>
              <RoleBadge badge={badge} size={16} />
            </div>
            <RoleTag name={roleName.trim() || "New role"} colour={badgeColour(badge)} badge={badge} />
          </div>
        </div>
      )}
    </div>
  );
}
