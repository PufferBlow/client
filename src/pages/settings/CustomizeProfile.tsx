import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { ProfileCard } from "../../components/profile/ProfileCard";
import { FeedbackLine } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { Button } from "../../components/ui/Button";
import { updateAppearance, updateProfileText } from "../../features/users/api";
import { userKeys } from "../../features/users/hooks";
import {
  BANNER_CHOICES,
  CARD_THEMES,
  DEFAULT_SETTINGS,
  FRAMES,
  LIMITS,
  MOTIONS,
  NAME_FONTS,
  lookOf,
  randomSettings,
  settingsOf,
  settingsPatch,
  type ProfileSettings,
  type SectionName,
} from "../../features/users/look";
import type { UserProfile } from "../../features/users/types";
import { bannerCss, EXPRESSIONS, fishUrl, TONES, TONE_HEX } from "../../lib/identity";

/** Sections the client can fill in today. (The others need data about games that no instance sends yet.) */
const SECTIONS: ReadonlyArray<{ id: SectionName; label: string }> = [
  { id: "badges", label: "Badges" },
  { id: "accounts", label: "Home instance" },
];

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2.5">
      <span className="pb-section-label text-text-tertiary">{label}</span>
      {children}
    </div>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`pb-label-button inline-flex h-8 items-center gap-1.5 rounded-sm border-0 px-3 text-[11.5px] transition-colors duration-(--motion-fast) ${
        selected ? "bg-text text-on-primary" : "bg-surface-tertiary text-text-body hover:bg-active"
      }`}
    >
      {children}
    </button>
  );
}

function Swatches({ label, value, onChange }: { label: string; value: string | null; onChange: (tone: (typeof TONES)[number]) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {TONES.map((tone) => (
        <button
          key={tone}
          type="button"
          aria-label={`${label}: ${tone}`}
          aria-pressed={value === tone}
          title={tone}
          onClick={() => onChange(tone)}
          className="size-[30px] cursor-pointer rounded-full border-0 transition-shadow aria-pressed:shadow-[0_0_0_3px_var(--color-surface-secondary),0_0_0_5px_var(--color-text)]"
          style={{ background: TONE_HEX[tone] }}
        />
      ))}
    </div>
  );
}

const inputClass =
  "h-10 min-w-0 rounded-md border-0 bg-surface-tertiary px-3 text-[14.5px] text-text outline-none placeholder:text-text-muted focus:shadow-[0_0_0_2px_var(--color-surface-secondary),0_0_0_4px_var(--color-text)]";

/**
 * Your card, your colours: every setting is a choice from a short list, with the card beside it
 * updating as you choose. Nothing is saved until "Save profile".
 */
export function CustomizeProfile({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const saved = useMemo(() => settingsOf(profile), [profile]);
  const [draft, setDraft] = useState<ProfileSettings>(saved);
  const [pronouns, setPronouns] = useState(profile.pronouns ?? "");
  const [customStatus, setCustomStatus] = useState(profile.custom_status ?? "");
  const { run, loading, feedback } = useSave("Profile saved.");

  const set = <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const patch = settingsPatch(saved, draft);
  const textChanged = pronouns.trim() !== (profile.pronouns ?? "") || customStatus.trim() !== (profile.custom_status ?? "");
  const changed = Object.keys(patch).length > 0 || textChanged;

  // The preview wears what is being chosen. An uploaded picture is left alone.
  const preview = { ...profile, pronouns: pronouns.trim() || null, custom_status: customStatus.trim() || null };
  const look = lookOf(preview, draft);
  const avatarSrc = profile.avatar_kind === "image" ? undefined : fishUrl(look.expression, look.tone);

  const save = async () => {
    const ok = await run(async () => {
      if (textChanged) {
        await updateProfileText({
          ...(pronouns.trim() !== (profile.pronouns ?? "") ? { pronouns: pronouns.trim() } : {}),
          ...(customStatus.trim() !== (profile.custom_status ?? "") ? { custom_status: customStatus.trim() } : {}),
        });
      }
      if (Object.keys(patch).length > 0) await updateAppearance({ profileSettings: patch });
    });
    if (ok) await Promise.all([queryClient.invalidateQueries({ queryKey: userKeys.profile }), queryClient.invalidateQueries({ queryKey: userKeys.list })]);
  };

  const reset = () => {
    setDraft({ ...DEFAULT_SETTINGS, sections: { ...DEFAULT_SETTINGS.sections } });
    setPronouns("");
    setCustomStatus("");
  };

  const showSecondColour = draft.card_theme === "duo" || draft.banner_pattern === "duo";

  return (
    <section aria-label="Customize your profile" className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-6 rounded-lg bg-surface-secondary p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h2 className="pb-title m-0 text-[22px]">Your card</h2>
            <p className="pb-meta m-0 mt-1 text-[13px]">The one place you get to paint. Everyone sees it, on any instance.</p>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={() => setDraft((d) => randomSettings(d))}>
              <Flame size={13} aria-hidden="true" />
              Surprise me
            </Button>
            <Button size="sm" variant="secondary" onClick={reset}>
              Reset
            </Button>
          </div>
        </div>

        <Group label="Identity">
          <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-2">
            <input aria-label="Custom status" className={inputClass} value={customStatus} maxLength={LIMITS.custom_status} placeholder="Custom status" onChange={(e) => setCustomStatus(e.target.value)} />
            <input aria-label="Pronouns" className={inputClass} value={pronouns} maxLength={LIMITS.pronouns} placeholder="Pronouns" onChange={(e) => setPronouns(e.target.value)} />
          </div>
        </Group>

        {profile.avatar_kind !== "image" && (
          <Group label="Face">
            <div className="flex flex-wrap gap-2">
              {EXPRESSIONS.map((expression) => (
                <button
                  key={expression}
                  type="button"
                  aria-label={`Face: ${expression}`}
                  aria-pressed={look.expression === expression}
                  title={expression}
                  onClick={() => set("expression", expression)}
                  className="cursor-pointer rounded-full border-0 bg-transparent p-0 aria-pressed:shadow-[0_0_0_3px_var(--color-surface-secondary),0_0_0_5px_var(--color-text)]"
                >
                  <img src={fishUrl(expression, look.tone)} alt="" width={40} height={40} className="block size-10" />
                </button>
              ))}
            </div>
          </Group>
        )}

        <Group label="Frame">
          <div className="flex flex-wrap gap-1.5">
            {FRAMES.map((f) => (
              <Chip key={f.id} selected={draft.frame === f.id} onClick={() => set("frame", f.id)}>
                {f.label}
              </Chip>
            ))}
          </div>
        </Group>

        <div className="grid gap-6 sm:grid-cols-2">
          <Group label="Colour">
            <Swatches label="Colour" value={look.tone} onChange={(tone) => set("tone", tone)} />
          </Group>
          {showSecondColour && (
            <Group label="Second colour">
              <Swatches label="Second colour" value={look.tone2} onChange={(tone) => set("tone2", tone)} />
            </Group>
          )}
        </div>

        <Group label="Card theme">
          <div className="flex flex-wrap gap-1.5">
            {CARD_THEMES.map((t) => (
              <Chip key={t.id} selected={draft.card_theme === t.id} onClick={() => set("card_theme", t.id)}>
                {t.label}
              </Chip>
            ))}
          </div>
        </Group>

        {profile.banner_kind !== "image" && (
          <Group label="Banner">
            <div className="grid grid-cols-3 gap-2">
              {BANNER_CHOICES.map((b) => {
                const selected = look.bannerPattern === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    aria-label={`Banner: ${b.label}`}
                    aria-pressed={selected}
                    onClick={() => set("banner_pattern", b.id)}
                    className="relative flex h-14 cursor-pointer items-end overflow-hidden rounded-md border-0 p-1.5 text-left aria-pressed:shadow-[0_0_0_2px_var(--color-surface-secondary),0_0_0_4px_var(--color-text)]"
                    style={{ background: b.id === "duo" ? `linear-gradient(120deg, ${look.hex} 0%, ${look.hex2} 100%)` : bannerCss(look.hex, b.id, b.id === "crowd" ? undefined : "16% 130%") }}
                  >
                    <span className="rounded-[5px] bg-black/60 px-1.5 py-[3px] font-heading text-[10px] font-bold uppercase leading-none tracking-[0.1em] text-text">{b.label}</span>
                  </button>
                );
              })}
            </div>
          </Group>
        )}

        <Group label="Name style">
          <div className="flex flex-wrap gap-1.5">
            {NAME_FONTS.map((f) => (
              <Chip key={f.id} selected={draft.name_font === f.id} onClick={() => set("name_font", f.id)}>
                {f.label}
              </Chip>
            ))}
          </div>
        </Group>

        <Group label="Sections">
          <div className="flex flex-wrap gap-1.5">
            {SECTIONS.map((s) => (
              <Chip key={s.id} selected={draft.sections[s.id]} onClick={() => set("sections", { ...draft.sections, [s.id]: !draft.sections[s.id] })}>
                {draft.sections[s.id] ? "✓ " : ""}
                {s.label}
              </Chip>
            ))}
          </div>
        </Group>

        <Group label="Motion">
          <div className="flex flex-wrap gap-1.5">
            {MOTIONS.map((m) => (
              <Chip key={m.id} selected={draft.motion === m.id} onClick={() => set("motion", m.id)}>
                {m.label}
              </Chip>
            ))}
          </div>
        </Group>

        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={save} loading={loading} disabled={!changed}>
            Save profile
          </Button>
          <FeedbackLine feedback={feedback} />
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:sticky lg:top-4">
        <div className="grid place-items-center rounded-lg bg-background p-5">
          <ProfileCard profile={preview} draft={draft} avatarSrc={avatarSrc} />
        </div>
        <p className="pb-meta m-0 px-1 text-[12.5px]">
          The colour is mixed into a dark card, so the text stays readable whatever you pick. Face, frame and name style follow you into lists and chat; the theme, banner and sections stay on the card.
        </p>
      </div>
    </section>
  );
}
