import { useRef, useState } from "react";
import { Smile, Sticker } from "lucide-react";
import { Panel, Tag } from "../../components/control-panel/Panel";
import { Chip } from "../../components/settings/Pickers";
import { FeedbackLine, type Feedback } from "../../components/settings/SettingsParts";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Input } from "../../components/ui/Input";
import { LoadingState } from "../../components/ui/LoadingState";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { kindOf, type CatalogItem, type CatalogKind } from "../../features/catalog/api";
import { catalogSrc, useAllCatalog, useCatalogAdmin } from "../../features/catalog/hooks";
import { classifyAuthError } from "../../utils/authErrors";

/** The instance refuses anything larger. */
const MAX_BYTES = 512 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif";
const ALIAS = /^[a-z0-9_]{2,32}$/;

const KINDS: ReadonlyArray<{ id: CatalogKind; label: string; noun: string; icon: typeof Smile; blurb: string }> = [
  { id: "emoji", label: "Custom emoji", noun: "emoji", icon: Smile, blurb: "Small pictures people type as :shortcode: or react with." },
  { id: "sticker", label: "Stickers", noun: "sticker", icon: Sticker, blurb: "Bigger pictures sent as a message of their own." },
];

/** `Party Parrot.gif` becomes `party_parrot`: a name that can be typed. */
const aliasFrom = (filename: string) =>
  filename
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);

const nameFrom = (filename: string) => filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 64);

function AddForm({ kind }: { kind: CatalogKind }) {
  const admin = useCatalogAdmin();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const emoji = kind === "emoji";
  const noun = emoji ? "emoji" : "sticker";

  const choose = (picked: File | undefined) => {
    if (!picked) return;
    setFeedback(null);
    if (!/^image\/(png|jpeg|webp|gif)$/.test(picked.type) && !/\.(png|jpe?g|webp|gif)$/i.test(picked.name)) {
      setFeedback({ kind: "error", message: "Use a PNG, JPG, WebP or GIF." });
      return;
    }
    if (picked.size > MAX_BYTES) {
      setFeedback({ kind: "error", message: `That picture is ${Math.ceil(picked.size / 1024)} KB; the most is ${MAX_BYTES / 1024} KB.` });
      return;
    }
    setFile(picked);
    setName((n) => n || nameFrom(picked.name));
    setAlias((a) => a || (emoji ? aliasFrom(picked.name) : ""));
  };

  const aliasValid = alias === "" ? !emoji : ALIAS.test(alias);
  const ready = file !== null && name.trim() !== "" && aliasValid && progress === null;

  const submit = async () => {
    if (!file || !ready) return;
    setFeedback(null);
    setProgress({ loaded: 0, total: file.size });
    try {
      await admin.upload.mutateAsync({ file, name: name.trim(), alias: alias || undefined, kind, onProgress: (loaded, total) => setProgress({ loaded, total }) });
      setFeedback({ kind: "success", message: `Added the ${noun}.` });
      setFile(null);
      setName("");
      setAlias("");
      if (input.current) input.current.value = "";
    } catch (error) {
      setFeedback({ kind: "error", message: classifyAuthError(error, `Couldn't add the ${noun}. Try again.`).message });
    } finally {
      setProgress(null);
    }
  };

  const preview = file ? URL.createObjectURL(file) : null;

  return (
    <form
      aria-label={`Add ${emoji ? "an emoji" : "a sticker"}`}
      className="flex flex-wrap items-end gap-3 rounded-lg bg-surface-secondary p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <button
        type="button"
        aria-label={`Choose a picture for the ${noun}`}
        onClick={() => input.current?.click()}
        className={`grid shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-surface-tertiary text-[11px] text-text-muted hover:border-solid ${emoji ? "size-14" : "size-20"}`}
      >
        {preview ? <img src={preview} alt="" onLoad={() => URL.revokeObjectURL(preview)} className="size-full object-contain p-1" /> : "Picture"}
      </button>
      <input ref={input} type="file" hidden accept={ACCEPT} aria-label={`${emoji ? "Emoji" : "Sticker"} file`} onChange={(e) => choose(e.target.files?.[0])} />

      <label className="flex min-w-40 flex-1 flex-col gap-[7px] text-[13px] text-text-tertiary">
        Name
        <Input aria-label="Name" value={name} maxLength={64} placeholder={emoji ? "Party parrot" : "Big hello"} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="flex min-w-40 flex-1 flex-col gap-[7px] text-[13px] text-text-tertiary">
        {emoji ? "Shortcode" : "Shortcode (optional)"}
        <Input
          aria-label="Shortcode"
          value={alias}
          maxLength={32}
          spellCheck={false}
          autoCapitalize="off"
          placeholder="party_parrot"
          error={alias !== "" && !ALIAS.test(alias) ? "2 to 32 lowercase letters, digits or underscores." : undefined}
          onChange={(e) => setAlias(e.target.value.toLowerCase())}
        />
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!ready} loading={progress !== null}>
          Add {noun}
        </Button>
      </div>
      {progress && <ProgressBar className="basis-full" loaded={progress.loaded} total={progress.total} label={`Uploading the ${noun}`} />}
      <FeedbackLine feedback={feedback} />
      <p className="pb-meta m-0 basis-full text-[12.5px]">PNG, JPG, WebP or GIF up to {MAX_BYTES / 1024} KB. An animated GIF or WebP plays as it is.</p>
    </form>
  );
}

function ItemCard({ item }: { item: CatalogItem }) {
  const admin = useCatalogAdmin();
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const emoji = kindOf(item) === "emoji";

  const act = async (run: () => Promise<unknown>, fallback: string) => {
    setFeedback(null);
    try {
      await run();
    } catch (error) {
      setFeedback({ kind: "error", message: classifyAuthError(error, fallback).message });
    }
  };

  return (
    <li className={`flex flex-col gap-3 rounded-lg bg-surface-secondary p-3 ${item.is_active ? "" : "opacity-70"}`}>
      <div className="flex items-center gap-3">
        <div className={`grid shrink-0 place-items-center rounded-md bg-surface-tertiary ${emoji ? "size-12" : "size-20"}`}>
          <img src={catalogSrc(item)} alt="" loading="lazy" draggable={false} className="size-full object-contain p-1.5" />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-semibold">{item.display_name}</span>
          <span className="truncate font-mono text-xs text-text-tertiary">{item.alias ? `:${item.alias}:` : "no shortcode"}</span>
          {!item.is_active && <Tag>Hidden</Tag>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" aria-label={`${item.is_active ? "Hide" : "Show"} ${item.display_name}`} onClick={() => void act(() => admin.update.mutateAsync({ id: item.sticker_id, is_active: !item.is_active }), "Couldn't change it.")}>
          {item.is_active ? "Hide" : "Show"}
        </Button>
        {confirming ? (
          <>
            <Button size="sm" variant="danger" aria-label={`Confirm deleting ${item.display_name}`} loading={admin.remove.isPending} onClick={() => void act(() => admin.remove.mutateAsync(item.sticker_id), "Couldn't delete it.")}>
              Delete for good
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" aria-label={`Delete ${item.display_name}`} onClick={() => setConfirming(true)}>
            Delete
          </Button>
        )}
      </div>
      <FeedbackLine feedback={feedback} />
    </li>
  );
}

/** Custom emoji and stickers: add, hide and remove them. Reactions and messages that already use one keep showing it. */
export function EmojiSection() {
  const [kind, setKind] = useState<CatalogKind>("emoji");
  const { data, isPending, error, refetch } = useAllCatalog();
  const current = KINDS.find((k) => k.id === kind)!;

  let body;
  if (isPending) body = <LoadingState message="Loading the catalog…" shape="cards" />;
  else if (error || !data) body = <ErrorState title="Couldn't load the catalog" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />;
  else {
    const items = data.filter((i) => kindOf(i) === kind);
    body =
      items.length === 0 ? (
        <EmptyState title={`No ${kind === "emoji" ? "custom emoji" : "stickers"} yet`} description="Add the first one above." />
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2 p-0">
          {items.map((item) => (
            <ItemCard key={item.sticker_id} item={item} />
          ))}
        </ul>
      );
  }

  return (
    <Panel
      title={current.label}
      description={current.blurb}
      grow
      action={
        <div role="group" aria-label="Kind" className="flex gap-1.5">
          {KINDS.map((k) => (
            <Chip key={k.id} selected={kind === k.id} onClick={() => setKind(k.id)}>
              <k.icon size={13} aria-hidden="true" />
              {k.label}
            </Chip>
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <AddForm key={kind} kind={kind} />
        {body}
      </div>
    </Panel>
  );
}
