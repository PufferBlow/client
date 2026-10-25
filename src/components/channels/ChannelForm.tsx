import { Select } from "../ui/Select";
import { useState, type FormEvent } from "react";
import { Button, Input, Modal } from "@pufferblow/spines";
import type { NewChannel } from "../../features/channels/api";
import { useCategories } from "../../features/channels/categories";
import { TOPIC_MAX } from "../../features/channels/types";
import type { Channel, ChannelType } from "../../features/channels/types";

const TYPES: { value: ChannelType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "voice", label: "Voice" },
  { value: "mixed", label: "Text + voice" },
];

interface Props {
  /** The channel being edited, or `null` to create a new one. */
  channel: Channel | null;
  /** Starting values for a new channel, e.g. when duplicating one. */
  template?: { name: string; type: ChannelType; isPrivate: boolean };
  busy: boolean;
  error?: string;
  onSubmit: (values: NewChannel) => void;
  onClose: () => void;
}

/** Create or edit a channel. Type is only chosen at creation; the server won't change it afterwards. */
export function ChannelForm({ channel, template, busy, error, onSubmit, onClose }: Props) {
  const [name, setName] = useState(channel?.channel_name ?? template?.name ?? "");
  const [type, setType] = useState<ChannelType>(channel?.channel_type ?? template?.type ?? "text");
  const [isPrivate, setIsPrivate] = useState(channel?.is_private ?? template?.isPrivate ?? false);
  const [topic, setTopic] = useState(channel?.topic ?? "");
  const [categoryId, setCategoryId] = useState(channel?.category_id ?? "");
  const [touched, setTouched] = useState(false);
  const { data: categories = [] } = useCategories();

  const trimmed = name.trim();
  const nameError = touched && !trimmed ? "Give the channel a name." : undefined;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!trimmed) return;
    onSubmit({ channel_name: trimmed, channel_type: type, is_private: isPrivate, topic: topic.trim(), category_id: categoryId || null });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={channel ? "Edit channel" : "New channel"}
      description={channel ? "Rename it or change who can see it." : "Add a place for people to talk."}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-text-secondary">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} error={nameError} autoFocus aria-label="Channel name" placeholder="general" />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-[13px] text-text-secondary">
            Topic
            <span className="text-text-muted">
              {topic.length}/{TOPIC_MAX}
            </span>
          </span>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={TOPIC_MAX} aria-label="Channel topic" placeholder="What is this channel for?" />
        </label>

        {categories.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-text-secondary">Category</span>
            <Select
              label="Channel category"
              className="h-11! w-full text-[14.5px]!"
              value={categoryId}
              onChange={setCategoryId}
              options={[{ value: "", label: "No category" }, ...categories.map((c) => ({ value: c.category_id, label: c.name }))]}
            />
          </label>
        )}

        {channel ? (
          <p className="m-0 text-[13px] text-text-tertiary">
            Type: {TYPES.find((t) => t.value === channel.channel_type)?.label}. It can't be changed; delete and recreate the channel to switch.
          </p>
        ) : (
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 p-0 text-[13px] text-text-secondary">Type</legend>
            <div className="flex gap-2">
              {TYPES.map((t) => (
                <label
                  key={t.value}
                  className={[
                    "flex h-10 flex-1 cursor-pointer items-center justify-center rounded-xl border text-sm",
                    type === t.value ? "border-primary/60 bg-primary/10 text-text" : "border-border text-text-secondary hover:border-border-secondary",
                  ].join(" ")}
                >
                  <input type="radio" name="channel-type" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} className="sr-only" />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="mt-0.5 h-4 w-4 accent-primary" />
          <span>
            Private channel
            <span className="block text-[13px] text-text-tertiary">Only people you add can see it.</span>
          </span>
        </label>

        {error && (
          <p role="alert" className="m-0 text-[13px] text-error">
            {error}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            {channel ? "Save changes" : "Create channel"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
