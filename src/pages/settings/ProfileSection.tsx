import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shuffle } from "lucide-react";
import { FeedbackLine, SettingsCard } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { Button } from "../../components/ui/Button";
import { updateAppearance } from "../../features/users/api";
import { userKeys } from "../../features/users/hooks";
import type { UserProfile } from "../../features/users/types";
import { CustomizeProfile } from "./CustomizeProfile";

const ACCENTS = ["#ffffff", "#e3ae4f", "#c9a3f0", "#9fd487", "#f0a061", "#8cc9d6", "#ef8a75", "#a9b3e6"];
const HEX = /^#[0-9a-fA-F]{6}$/;

function AppearanceCard({ profile }: { profile: UserProfile }) {
  const queryClient = useQueryClient();
  const [custom, setCustom] = useState(profile.accent_color ?? "");
  const accent = useSave("Accent colour updated.");
  const avatar = useSave("Avatar updated.");

  const refresh = () => queryClient.invalidateQueries({ queryKey: userKeys.profile });

  const applyAccent = async (color: string) => {
    if (!HEX.test(color)) {
      accent.fail("Use a hex colour like #ffffff.");
      return;
    }
    setCustom(color);
    if (await accent.run(() => updateAppearance({ accentColor: color.toLowerCase() }))) await refresh();
  };

  return (
    <SettingsCard title="Appearance" description="Your accent colour and your default avatar and banner.">
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
            Shuffle default avatar and banner
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
      <CustomizeProfile key={JSON.stringify([profile.profile_settings, profile.pronouns, profile.custom_status, profile.about, profile.status])} profile={profile} />
      <AppearanceCard profile={profile} />
    </>
  );
}
