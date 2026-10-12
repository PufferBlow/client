import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shuffle } from "lucide-react";
import { FeedbackLine, SettingsCard, TextArea } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { Button } from "../../components/ui/Button";
import { PRESENCE } from "../../features/members/presence";
import { updateAbout, updateAppearance, updateStatus } from "../../features/users/api";
import { userKeys } from "../../features/users/hooks";
import type { PresenceStatus, UserProfile } from "../../features/users/types";

const ABOUT_MAX = 500;

const STATUSES: { id: PresenceStatus; label: string }[] = [
  { id: "online", label: "Online" },
  { id: "idle", label: "Idle" },
  { id: "dnd", label: "Do not disturb" },
  { id: "offline", label: "Invisible" },
];

const ACCENTS = ["#e3ae4f", "#c9a3f0", "#9fd487", "#f0a061", "#8cc9d6", "#ef8a75", "#a9b3e6"];
const HEX = /^#[0-9a-fA-F]{6}$/;

function AboutCard({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const [about, setAbout] = useState(profile.about ?? "");
  const { run, loading, feedback } = useSave("About updated.");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(() => updateAbout(about.trim()));
    if (ok) await queryClient.invalidateQueries({ queryKey: userKeys.profile });
  };

  return (
    <SettingsCard title="About me" description="Shown on your profile to people on any instance.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextArea label="About" value={about} onChange={setAbout} maxLength={ABOUT_MAX} placeholder="Tell people a little about yourself." />
        <div className="flex items-center gap-4">
          <Button type="submit" loading={loading} disabled={about.trim() === (profile.about ?? "")}>
            Save about
          </Button>
          <FeedbackLine feedback={feedback} />
        </div>
      </form>
    </SettingsCard>
  );
}

function StatusCard({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const { run, loading, feedback } = useSave("Status updated.");

  const select = async (status: PresenceStatus) => {
    const ok = await run(() => updateStatus(status));
    if (ok) await queryClient.invalidateQueries({ queryKey: userKeys.profile });
  };

  return (
    <SettingsCard title="Status" description="How you appear to other people.">
      <div role="radiogroup" aria-label="Status" className="grid gap-2 sm:grid-cols-2">
        {STATUSES.map(({ id, label }) => {
          const selected = profile.status === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={loading}
              onClick={() => select(id)}
              className={[
                "flex h-11 items-center gap-2.5 rounded-xl border px-3.5 text-left text-sm transition-colors",
                selected
                  ? "border-primary/60 bg-primary/10 font-semibold text-text"
                  : "border-border-secondary bg-background text-text-tertiary hover:text-text",
              ].join(" ")}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: PRESENCE[id].color }} />
              {label}
            </button>
          );
        })}
      </div>
      <FeedbackLine feedback={feedback} />
    </SettingsCard>
  );
}

function AppearanceCard({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const [custom, setCustom] = useState(profile.accent_color ?? "");
  const accent = useSave("Accent colour updated.");
  const avatar = useSave("Avatar updated.");

  const refresh = () => queryClient.invalidateQueries({ queryKey: userKeys.profile });

  const applyAccent = async (color: string) => {
    if (!HEX.test(color)) {
      accent.fail("Use a hex colour like #e3ae4f.");
      return;
    }
    setCustom(color);
    if (await accent.run(() => updateAppearance({ accentColor: color.toLowerCase() }))) await refresh();
  };

  return (
    <SettingsCard title="Appearance" description="Your accent colour and generated avatar.">
      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] text-text-tertiary">Accent colour</span>
        <div className="flex flex-wrap items-center gap-2.5">
          {ACCENTS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Use accent ${color}`}
              aria-pressed={profile.accent_color?.toLowerCase() === color}
              onClick={() => applyAccent(color)}
              className="h-8 w-8 rounded-full ring-offset-2 ring-offset-surface-secondary transition-shadow aria-pressed:ring-2 aria-pressed:ring-text"
              style={{ background: color }}
            />
          ))}
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onBlur={() => custom && custom.toLowerCase() !== profile.accent_color?.toLowerCase() && applyAccent(custom)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyAccent(custom))}
            placeholder="#RRGGBB"
            aria-label="Custom accent colour"
            spellCheck={false}
            className="h-8 w-28 rounded-lg border border-border-secondary bg-background px-2.5 font-mono text-xs text-text outline-none focus:border-primary/55"
          />
        </div>
        <FeedbackLine feedback={accent.feedback} />
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] text-text-tertiary">Avatar</span>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            loading={avatar.loading}
            onClick={async () => (await avatar.run(() => updateAppearance({ avatarKind: "identicon", shuffleAvatarSeed: true }))) && refresh()}
          >
            <Shuffle size={15} aria-hidden="true" />
            Shuffle generated avatar
          </Button>
          <FeedbackLine feedback={avatar.feedback} />
        </div>
        <p className="m-0 text-xs text-text-muted">Uploading your own image isn't available in this client yet.</p>
      </div>
    </SettingsCard>
  );
}

export function ProfileSection({ profile }: { profile: UserProfile }) {
  return (
    <>
      <AboutCard profile={profile} />
      <StatusCard profile={profile} />
      <AppearanceCard profile={profile} />
    </>
  );
}
