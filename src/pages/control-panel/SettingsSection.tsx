import { useState, type ReactNode } from "react";
import { Shuffle } from "lucide-react";
import { Switch } from "../../components/auth/AuthFields";
import { Panel } from "../../components/control-panel/Panel";
import { FeedbackLine } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/ErrorState";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import { useServerSettingsAdmin } from "../../features/admin/hooks";
import type { ServerSettingsChange } from "../../features/admin/api";
import { useServerInfo } from "../../features/server/hooks";
import type { ServerInfo } from "../../features/server/types";
import { classifyAuthError } from "../../utils/authErrors";

const NAME_MAX = 64;
const DESCRIPTION_MAX = 500;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-[7px] text-[13px] text-text-tertiary">
      {label}
      {children}
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </label>
  );
}

/** A whole number that may be left empty while typing; empty means "not set". */
const toNumber = (text: string): number | undefined => {
  const n = Number(text.trim());
  return text.trim() !== "" && Number.isInteger(n) && n > 0 ? n : undefined;
};

function GeneralPanel({ info }: { info: ServerInfo }) {
  const admin = useServerSettingsAdmin();
  const { run, loading, feedback } = useSave("Saved.");
  const [name, setName] = useState(info.server_name);
  const [description, setDescription] = useState(info.server_description ?? "");
  const [isPrivate, setPrivate] = useState(info.is_private);

  const change: ServerSettingsChange = {
    ...(name.trim() !== info.server_name ? { server_name: name.trim() } : {}),
    ...(description.trim() !== (info.server_description ?? "") ? { server_description: description.trim() } : {}),
    ...(isPrivate !== info.is_private ? { is_private: isPrivate } : {}),
  };
  const changed = Object.keys(change).length > 0 && name.trim().length > 0;

  return (
    <Panel title="General" description="What members see when they join.">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => admin.update.mutateAsync(change).then(() => undefined));
        }}
      >
        <Field label="Server name">
          <Input aria-label="Server name" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description" hint={`${description.length}/${DESCRIPTION_MAX}`}>
          <textarea
            aria-label="Description"
            value={description}
            maxLength={DESCRIPTION_MAX}
            rows={4}
            onChange={(e) => setDescription(e.target.value)}
            className="block w-full resize-none rounded-md border-0 bg-surface-secondary px-3.5 py-3 text-[14.5px] leading-normal text-text outline-none placeholder:text-text-muted focus:shadow-[0_0_0_2px_var(--color-background-secondary),0_0_0_4px_var(--color-text)]"
          />
        </Field>
        <Switch checked={isPrivate} onChange={setPrivate}>
          Private: people need an invitation to join
        </Switch>
        <div className="flex items-center gap-4">
          <Button type="submit" loading={loading} disabled={!changed}>
            Save
          </Button>
          <FeedbackLine feedback={feedback} />
        </div>
      </form>
    </Panel>
  );
}

const LIMITS: ReadonlyArray<{ key: keyof ServerSettingsChange & keyof ServerInfo; label: string; unit: string; hint?: string }> = [
  { key: "max_message_length", label: "Message length", unit: "characters" },
  { key: "max_image_size", label: "Image size", unit: "MB" },
  { key: "max_video_size", label: "Video size", unit: "MB" },
  { key: "max_sticker_size", label: "Sticker size", unit: "MB" },
  { key: "max_gif_size", label: "GIF size", unit: "MB" },
];

function LimitsPanel({ info }: { info: ServerInfo }) {
  const admin = useServerSettingsAdmin();
  const { run, loading, feedback } = useSave("Limits saved.");
  const initial = (key: (typeof LIMITS)[number]["key"]) => String(info[key] ?? "");
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(LIMITS.map((l) => [l.key, initial(l.key)])));

  const change: Record<string, number> = {};
  let invalid = false;
  for (const { key } of LIMITS) {
    const text = values[key] ?? "";
    if (text === initial(key)) continue;
    const n = toNumber(text);
    if (n === undefined) invalid = true;
    else change[key] = n;
  }
  const changed = Object.keys(change).length > 0 && !invalid;

  return (
    <Panel title="Limits" description="How big a message or an upload may be. Whole numbers; sizes are in megabytes.">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => admin.update.mutateAsync(change as ServerSettingsChange).then(() => undefined));
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {LIMITS.map(({ key, label, unit }) => (
            <Field key={key} label={label} hint={unit}>
              <Input
                aria-label={label}
                inputMode="numeric"
                value={values[key] ?? ""}
                error={toNumber(values[key] ?? "") === undefined && (values[key] ?? "") !== "" ? "Use a whole number above zero." : undefined}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <Button type="submit" loading={loading} disabled={!changed}>
            Save limits
          </Button>
          <FeedbackLine feedback={feedback} />
        </div>
      </form>
    </Panel>
  );
}

function AppearancePanel() {
  const admin = useServerSettingsAdmin();
  const shuffle = useSave("New icon and banner picked.");
  const banner = useSave("Banner updated.");

  return (
    <Panel title="Look" description="The icon and banner people see before you have uploaded your own." grow>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            loading={shuffle.loading}
            onClick={() => void shuffle.run(() => admin.appearance.mutateAsync({ avatar_kind: "identicon", shuffle_avatar_seed: true }).then(() => undefined))}
          >
            <Shuffle size={15} aria-hidden="true" />
            Shuffle icon and banner
          </Button>
          <FeedbackLine feedback={shuffle.feedback} />
        </div>
        <div role="group" aria-label="Banner" className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-text-tertiary">Banner</span>
          <Button size="sm" variant="secondary" loading={banner.loading} onClick={() => void banner.run(() => admin.appearance.mutateAsync({ banner_kind: "default" }).then(() => undefined))}>
            Pattern
          </Button>
          <Button size="sm" variant="secondary" loading={banner.loading} onClick={() => void banner.run(() => admin.appearance.mutateAsync({ banner_kind: "solid" }).then(() => undefined))}>
            Plain colour
          </Button>
          <FeedbackLine feedback={banner.feedback} />
        </div>
        <p className="m-0 text-xs text-text-muted">Uploading your own picture is not available in this client yet.</p>
      </div>
    </Panel>
  );
}

export function SettingsSection() {
  const { data, isPending, error, refetch } = useServerInfo();
  if (isPending) return <LoadingState message="Loading the settings…" />;
  if (error || !data) return <ErrorState title="Couldn't load the settings" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />;
  // Keyed by what the server holds, so a save that the server changed (a trimmed name) is shown as it is.
  const held = JSON.stringify([data.server_name, data.server_description, data.is_private, data.max_message_length, data.max_image_size, data.max_video_size, data.max_sticker_size, data.max_gif_size]);
  return (
    <div key={held} className="flex flex-1 flex-col gap-4">
      <GeneralPanel info={data} />
      <LimitsPanel info={data} />
      <AppearancePanel />
    </div>
  );
}
