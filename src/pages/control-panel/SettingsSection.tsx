import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Panel } from "../../components/control-panel/Panel";
import { ExtensionList } from "../../components/settings/ExtensionList";
import { PictureUploader } from "../../components/settings/PictureUploader";
import { Group, Swatches } from "../../components/settings/Pickers";
import { FeedbackLine } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { Button, ErrorState, Input, LoadingState, SpaceIcon } from "@pufferblow/spines";
import { useServerSettingsAdmin } from "../../features/admin/hooks";
import type { ServerSettingsChange } from "../../features/admin/api";
import { uploadPicture, type PictureKind } from "../../features/pictures/upload";
import { serverKeys, useServerInfo } from "../../features/server/hooks";
import { serverIdentityId, serverPictures } from "../../features/server/look";
import type { JoinMode, ServerInfo } from "../../features/server/types";
import { ICON_STYLE_CHOICES, SERVER_BANNER_CHOICES, serverLookOf, type ServerLookChoice } from "../../lib/serverLook";
import { classifyAuthError } from "../../utils/authErrors";

const NAME_MAX = 64;
const DESCRIPTION_MAX = 500;
const WELCOME_MAX = 500;
/** The panel's own surface, for the ring around a picked colour. */
const GROUND = "var(--color-background-secondary)";

const textarea =
  "block w-full resize-none rounded-md border-0 bg-surface-secondary px-3.5 py-3 text-[14.5px] leading-normal text-text outline-none placeholder:text-text-muted focus:shadow-[0_0_0_2px_var(--color-background-secondary),0_0_0_4px_var(--color-text)]";

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

// ---- the server as members will see it

interface Draft {
  name: string;
  description: string;
  welcome: string;
  look: ServerLookChoice;
}

/** The server's card with the choices applied as they are made: the same banner and icon the sidebar and the hub draw. */
function Preview({ info, draft }: { info: ServerInfo; draft: Draft }) {
  const id = serverIdentityId(info);
  const look = serverLookOf(id, draft.look);
  const pictures = serverPictures(info);
  const name = draft.name.trim() || info.server_name;
  return (
    <article aria-label="Preview of the server" className="w-full overflow-hidden rounded-2xl bg-[#1f1f1f] shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
      <div className="h-[104px]" style={{ background: pictures.banner ? `url("${pictures.banner}") center / cover` : look.banner("80% 70%") }} />
      <div className="flex flex-col gap-2.5 px-4 pb-4">
        <div className="-mt-9 w-fit rounded-[24px] bg-[#1f1f1f] p-1">
          <SpaceIcon id={id} name={name} src={pictures.avatar} look={{ iconStyle: look.iconStyle, tone: look.tone }} size={72} radius={20} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="m-0 break-words font-display text-[22px] font-normal leading-[1.1] [overflow-wrap:anywhere]">{name}</h3>
          <span className="text-[13px] text-text-tertiary">{id}</span>
        </div>
        <p className="m-0 whitespace-pre-wrap break-words text-[13.5px] leading-normal text-text-body [overflow-wrap:anywhere]">{draft.description.trim() || "No description yet."}</p>
        {info.members_count != null && (
          <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <Users size={13} aria-hidden="true" />
            {info.members_count} {info.members_count === 1 ? "member" : "members"}
          </span>
        )}
        {draft.welcome.trim() && (
          <div className="rounded-xl bg-black/35 p-3">
            <span className="pb-section-label mb-1.5 block">Welcome message</span>
            <p className="m-0 whitespace-pre-wrap break-words text-[13.5px] leading-normal text-text-body [overflow-wrap:anywhere]">{draft.welcome.trim()}</p>
          </div>
        )}
      </div>
    </article>
  );
}

const JOIN_CHOICES: { value: JoinMode; label: string; hint: string }[] = [
  { value: "open", label: "Open", hint: "Anyone can join." },
  { value: "invite", label: "Invite only", hint: "People need an invitation code." },
  { value: "request", label: "Request to join", hint: "People ask, and you or a moderator approve. A valid code skips the wait." },
];

function GeneralPanel({ info, draft, onDraft }: { info: ServerInfo; draft: Draft; onDraft: (change: Partial<Draft>) => void }) {
  const admin = useServerSettingsAdmin();
  const { run, loading, feedback } = useSave("Saved.");
  const [joinMode, setJoinMode] = useState<JoinMode>(info.join_mode ?? "open");

  const change: ServerSettingsChange = {
    ...(draft.name.trim() !== info.server_name ? { server_name: draft.name.trim() } : {}),
    ...(draft.description.trim() !== (info.server_description ?? "") ? { server_description: draft.description.trim() } : {}),
    ...(draft.welcome.trim() !== (info.welcome_message ?? "") ? { welcome_message: draft.welcome.trim() } : {}),
    ...(joinMode !== (info.join_mode ?? "open") ? { join_mode: joinMode } : {}),
  };
  const changed = Object.keys(change).length > 0 && draft.name.trim().length > 0;

  return (
    <Panel title="General" description="What members see when they find the server and when they join.">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => admin.update.mutateAsync(change).then(() => undefined));
        }}
      >
        <Field label="Server name">
          <Input aria-label="Server name" value={draft.name} maxLength={NAME_MAX} onChange={(e) => onDraft({ name: e.target.value })} />
        </Field>
        <Field label="Description" hint={`${draft.description.length}/${DESCRIPTION_MAX}`}>
          <textarea aria-label="Description" value={draft.description} maxLength={DESCRIPTION_MAX} rows={3} onChange={(e) => onDraft({ description: e.target.value })} className={textarea} />
        </Field>
        <Field label="Welcome message" hint={`Shown to people who join. ${draft.welcome.length}/${WELCOME_MAX}`}>
          <textarea aria-label="Welcome message" value={draft.welcome} maxLength={WELCOME_MAX} rows={3} onChange={(e) => onDraft({ welcome: e.target.value })} className={textarea} />
        </Field>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-[13px] text-text-secondary">Who can join</legend>
          {JOIN_CHOICES.map(({ value, label, hint }) => (
            <label
              key={value}
              className={["flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3", joinMode === value ? "border-primary/60 bg-primary/10" : "border-border hover:border-border-secondary"].join(" ")}
            >
              <input type="radio" name="join-mode" value={value} checked={joinMode === value} onChange={() => setJoinMode(value)} className="mt-1 accent-primary" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-[13px] text-text-tertiary">{hint}</span>
              </span>
            </label>
          ))}
          <p className="m-0 text-[12.5px] text-text-muted">This covers signing up here and joining with an account from another server. Codes and requests are under Community.</p>
        </fieldset>
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

// ---- how the server looks

/** True when two looks choose the same things (null and missing are the same: nothing chosen). */
const sameLook = (a: ServerLookChoice, b: ServerLookChoice) =>
  (["icon_style", "tone", "tone2", "banner_pattern"] as const).every((key) => (a[key] ?? null) === (b[key] ?? null));

function AppearancePanel({ info, draft, onDraft }: { info: ServerInfo; draft: Draft; onDraft: (change: Partial<Draft>) => void }) {
  const admin = useServerSettingsAdmin();
  const { run, loading, feedback } = useSave("Look saved.");
  const saved = (info.look ?? {}) as ServerLookChoice;
  const id = serverIdentityId(info);
  const look = serverLookOf(id, draft.look);
  const picture = serverPictures(info);
  const set = (change: ServerLookChoice) => onDraft({ look: { ...draft.look, ...change } });
  const changed = !sameLook(draft.look, saved);
  const nothingChosen = Object.values(draft.look).every((v) => v == null);
  const queryClient = useQueryClient();
  // A picture is a file, so it goes up on its own and the server's card follows at once.
  const sendPicture = (kind: PictureKind) => async (file: File, onProgress: (loaded: number, total: number) => void) => {
    const url = await uploadPicture("server", kind, file, onProgress);
    if (url) {
      const fields = kind === "avatar" ? { avatar_url: url, avatar_kind: "image" } : { banner_url: url, banner_kind: "image" };
      queryClient.setQueryData<ServerInfo>(serverKeys.info, (old) => (old ? { ...old, ...fields } : old));
    }
  };
  const revertPicture = (kind: PictureKind) => () =>
    admin.appearance.mutateAsync(kind === "avatar" ? { avatar_kind: "identicon" } : { banner_kind: "default" }).then(() => undefined);

  return (
    <Panel title="Look" description="The icon and banner of the server, drawn the same way in the sidebar, the hub and the invitation. Every choice is from a short list.">
      <div className="flex flex-col gap-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <PictureUploader
            label="Icon"
            kind="avatar"
            current={picture.avatar}
            custom={picture.avatar !== null}
            upload={sendPicture("avatar")}
            revert={revertPicture("avatar")}
            maxMb={info.max_image_size}
            hint="It replaces the icon style below in the rail and the sidebar."
          />
          <PictureUploader
            label="Banner"
            kind="banner"
            current={picture.banner}
            custom={picture.banner !== null}
            upload={sendPicture("banner")}
            revert={revertPicture("banner")}
            maxMb={info.max_image_size}
            hint="It replaces the pattern below behind the server name."
          />
        </div>
        <p className="m-0 text-[13px] text-text-tertiary">Your own pictures can move: an animated GIF or WebP plays as it is. The choices below are used wherever there is no picture.</p>

        <Group label="Icon style">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ICON_STYLE_CHOICES.map((choice) => {
              const selected = look.iconStyle === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  aria-label={`Icon style: ${choice.label}`}
                  aria-pressed={selected}
                  onClick={() => set({ icon_style: choice.id })}
                  className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-0 bg-surface-secondary p-3 transition-colors hover:bg-surface-tertiary aria-pressed:bg-surface-tertiary aria-pressed:shadow-[0_0_0_2px_var(--color-text)]"
                >
                  <SpaceIcon id={id} name={draft.name.trim() || info.server_name} look={{ iconStyle: choice.id, tone: look.tone }} size={52} radius={16} />
                  <span className="font-heading text-[11px] font-semibold uppercase tracking-[0.1em] text-text-body">{choice.label}</span>
                </button>
              );
            })}
          </div>
        </Group>

        <div className="grid gap-6 sm:grid-cols-2">
          <Group label="Colour">
            <Swatches label="Colour" value={look.tone} ground={GROUND} onChange={(tone) => set({ tone })} />
          </Group>
          {look.bannerPattern === "duo" && (
            <Group label="Second colour">
              <Swatches label="Second colour" value={look.tone2} ground={GROUND} onChange={(tone2) => set({ tone2 })} />
            </Group>
          )}
        </div>

        <Group label="Banner">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {SERVER_BANNER_CHOICES.map((choice) => {
              const preview = serverLookOf(id, { ...draft.look, banner_pattern: choice.id });
              return (
                <button
                  key={choice.id}
                  type="button"
                  aria-label={`Banner: ${choice.label}`}
                  aria-pressed={look.bannerPattern === choice.id}
                  onClick={() => set({ banner_pattern: choice.id })}
                  className="relative flex h-14 cursor-pointer items-end overflow-hidden rounded-md border-0 p-1.5 text-left aria-pressed:shadow-[0_0_0_2px_var(--color-background-secondary),0_0_0_4px_var(--color-text)]"
                  style={{ background: preview.banner(choice.id === "crowd" ? undefined : "16% 130%") }}
                >
                  <span className="rounded-[5px] bg-black/60 px-1.5 py-[3px] font-heading text-[10px] font-bold uppercase leading-none tracking-[0.1em] text-text">{choice.label}</span>
                </button>
              );
            })}
          </div>
        </Group>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            loading={loading}
            disabled={!changed}
            onClick={() =>
              void run(() =>
                admin.appearance
                  .mutateAsync({ look: { icon_style: draft.look.icon_style ?? null, tone: draft.look.tone ?? null, tone2: draft.look.tone2 ?? null, banner_pattern: draft.look.banner_pattern ?? null } })
                  .then(() => undefined),
              )
            }
          >
            Save look
          </Button>
          <Button variant="secondary" disabled={nothingChosen} onClick={() => onDraft({ look: {} })}>
            Use the default
          </Button>
          <FeedbackLine feedback={feedback} />
        </div>
        <p className="m-0 text-xs text-text-muted">The default is what the server&rsquo;s address gives it, the same on every client.</p>
      </div>
    </Panel>
  );
}

// ---- limits and file types

const LIMITS: ReadonlyArray<{ key: "max_message_length" | "max_image_size" | "max_video_size" | "max_sticker_size" | "max_gif_size"; label: string; unit: string }> = [
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

type FileTypeKey = "allowed_image_types" | "allowed_video_types" | "allowed_file_types" | "allowed_sticker_types" | "allowed_gif_types";

const FILE_TYPES: ReadonlyArray<{ key: FileTypeKey; label: string; hint: string; common: readonly string[] }> = [
  { key: "allowed_image_types", label: "Images", hint: "Pictures in chat, and the icons and banners people upload.", common: ["png", "jpg", "jpeg", "gif", "webp", "avif"] },
  { key: "allowed_video_types", label: "Videos", hint: "Clips people attach to a message.", common: ["mp4", "webm", "mov"] },
  { key: "allowed_file_types", label: "Documents and other files", hint: "Everything else people may attach.", common: ["pdf", "txt", "zip", "docx", "csv"] },
  { key: "allowed_sticker_types", label: "Stickers", hint: "Stickers and custom emoji. Animated ones need gif or webp.", common: ["png", "gif", "webp"] },
  { key: "allowed_gif_types", label: "GIFs", hint: "Animated pictures sent from the GIF tab.", common: ["gif", "webp"] },
];

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function FileTypesPanel({ info }: { info: ServerInfo }) {
  const admin = useServerSettingsAdmin();
  const { run, loading, feedback } = useSave("File types saved.");
  const initial = (key: FileTypeKey): string[] => [...(info[key] ?? [])];
  const [values, setValues] = useState<Record<FileTypeKey, string[]>>(() => Object.fromEntries(FILE_TYPES.map((t) => [t.key, initial(t.key)])) as Record<FileTypeKey, string[]>);

  const change: Partial<Record<FileTypeKey, string[]>> = {};
  for (const { key } of FILE_TYPES) if (!sameList(values[key], initial(key))) change[key] = values[key];
  const changed = Object.keys(change).length > 0;

  return (
    <Panel title="File types" description="Which kinds of file people may upload. Add a type with Enter or a comma, or take one of the common ones.">
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => admin.update.mutateAsync(change as ServerSettingsChange).then(() => undefined));
        }}
      >
        {FILE_TYPES.map(({ key, label, hint, common }) => (
          <ExtensionList key={key} label={label} hint={hint} suggestions={common} value={values[key]} onChange={(list) => setValues((v) => ({ ...v, [key]: list }))} />
        ))}
        <div className="flex items-center gap-4">
          <Button type="submit" loading={loading} disabled={!changed}>
            Save file types
          </Button>
          <FeedbackLine feedback={feedback} />
        </div>
      </form>
    </Panel>
  );
}

// ---- the screen

function Editor({ info }: { info: ServerInfo }) {
  const [draft, setDraft] = useState<Draft>(() => ({
    name: info.server_name,
    description: info.server_description ?? "",
    welcome: info.welcome_message ?? "",
    look: { ...((info.look ?? {}) as ServerLookChoice) },
  }));
  const update = (change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change }));

  return (
    <div className="grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-4">
        <GeneralPanel info={info} draft={draft} onDraft={update} />
        <AppearancePanel info={info} draft={draft} onDraft={update} />
        <LimitsPanel info={info} />
        <FileTypesPanel info={info} />
      </div>
      <div className="flex flex-col gap-3 lg:sticky lg:top-0">
        <div className="rounded-lg bg-background-secondary p-4">
          <Preview info={info} draft={draft} />
        </div>
        <p className="pb-meta m-0 px-1 text-[12.5px]">Members see this card, updating as you choose. It is saved with the Save buttons on the left.</p>
      </div>
    </div>
  );
}

export function SettingsSection() {
  const { data, isPending, error, refetch } = useServerInfo();
  if (isPending) return <LoadingState message="Loading the settings…" shape="form" />;
  if (error || !data) return <ErrorState title="Couldn't load the settings" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />;
  // Keyed by what the server holds, so what it kept (a trimmed name, a refused value) is shown as it is.
  const held = JSON.stringify([
    data.server_name,
    data.server_description,
    data.welcome_message,
    data.is_private,
    data.look,
    data.max_message_length,
    data.max_image_size,
    data.max_video_size,
    data.max_sticker_size,
    data.max_gif_size,
    data.allowed_image_types,
    data.allowed_video_types,
    data.allowed_file_types,
    data.allowed_sticker_types,
    data.allowed_gif_types,
  ]);
  return <Editor key={held} info={data} />;
}
