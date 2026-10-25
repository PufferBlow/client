import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Panel } from "../../components/control-panel/Panel";
import { Button } from "@pufferblow/spines";
import { useCategories, useCategoryAdmin, type Category } from "../../features/channels/categories";
import type { Channel } from "../../features/channels/types";
import { classifyAuthError } from "../../utils/authErrors";

const iconButton = "inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent text-text-tertiary hover:bg-surface-tertiary hover:text-text disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-text-tertiary";

/**
 * Categories group channels in the sidebar. Add, rename, reorder and delete them here; which channel
 * sits in which is set on the channel itself. Deleting one keeps its channels, uncategorised.
 */
export function CategoriesPanel({ channels }: { channels: readonly Channel[] }) {
  const { data: categories = [] } = useCategories();
  const { create, rename, remove, reorder } = useCategoryAdmin();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const error = create.error ?? rename.error ?? remove.error ?? reorder.error;
  const inside = (c: Category) => channels.filter((ch) => ch.category_id === c.category_id).length;

  const add = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(trimmed, { onSuccess: () => setName("") });
  };

  const move = (index: number, by: -1 | 1) => {
    const ids = categories.map((c) => c.category_id);
    const to = index + by;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to]!, ids[index]!];
    reorder.mutate(ids);
  };

  return (
    <Panel
      title="Categories"
      description="Group channels in the sidebar. Put a channel in one when you edit it."
      action={
        <form onSubmit={add} className="flex items-center gap-2" aria-label="New category">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            placeholder="New category"
            aria-label="Category name"
            className="h-9 w-44 rounded-md border-0 bg-surface-secondary px-3 text-sm text-text outline-none placeholder:text-text-muted focus:shadow-[0_0_0_2px_var(--color-background-secondary),0_0_0_4px_var(--color-text)]"
          />
          <Button type="submit" size="sm" loading={create.isPending} disabled={!name.trim()}>
            <Plus size={15} aria-hidden="true" />
            Add
          </Button>
        </form>
      }
    >
      {error ? (
        <p role="alert" className="pb-error mb-3 mt-0">
          {classifyAuthError(error, "Couldn't change the categories.").message}
        </p>
      ) : null}
      {categories.length === 0 ? (
        <p className="pb-meta m-0 text-[13px]">No categories yet. Channels show in plain Channels and Voice groups until you add some.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {categories.map((category, index) => {
            const isEditing = editing?.id === category.category_id;
            const count = inside(category);
            return (
              <li key={category.category_id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-secondary">
                {isEditing ? (
                  <form
                    className="flex flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const next = editing.name.trim();
                      if (!next || next === category.name) return setEditing(null);
                      rename.mutate({ id: category.category_id, name: next }, { onSuccess: () => setEditing(null) });
                    }}
                  >
                    <input
                      autoFocus
                      value={editing.name}
                      onChange={(e) => setEditing({ id: category.category_id, name: e.target.value })}
                      maxLength={64}
                      aria-label={`New name for ${category.name}`}
                      className="h-8 min-w-0 flex-1 rounded-md border-0 bg-surface px-2.5 text-sm text-text outline-none focus:shadow-[0_0_0_2px_var(--color-surface-secondary),0_0_0_4px_var(--color-text)]"
                    />
                    <button type="submit" className={iconButton} aria-label="Save name" disabled={rename.isPending}>
                      <Check size={15} aria-hidden="true" />
                    </button>
                    <button type="button" className={iconButton} aria-label="Cancel rename" onClick={() => setEditing(null)}>
                      <X size={15} aria-hidden="true" />
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{category.name}</span>
                    <span className="pb-meta text-xs">
                      {count} {count === 1 ? "channel" : "channels"}
                    </span>
                    <button type="button" className={iconButton} aria-label={`Move ${category.name} up`} disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)}>
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                    <button type="button" className={iconButton} aria-label={`Move ${category.name} down`} disabled={index === categories.length - 1 || reorder.isPending} onClick={() => move(index, 1)}>
                      <ArrowDown size={15} aria-hidden="true" />
                    </button>
                    <button type="button" className={iconButton} aria-label={`Rename ${category.name}`} onClick={() => setEditing({ id: category.category_id, name: category.name })}>
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                    {confirming === category.category_id ? (
                      <span className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="danger"
                          loading={remove.isPending}
                          onClick={() => remove.mutate(category.category_id, { onSettled: () => setConfirming(null) })}
                          aria-label={`Confirm deleting ${category.name}`}
                        >
                          Delete
                        </Button>
                        <button type="button" className={iconButton} aria-label="Keep it" onClick={() => setConfirming(null)}>
                          <X size={15} aria-hidden="true" />
                        </button>
                      </span>
                    ) : (
                      <button type="button" className={`${iconButton} hover:text-error-text`} aria-label={`Delete ${category.name}`} title={count > 0 ? "Its channels stay, uncategorised" : undefined} onClick={() => setConfirming(category.category_id)}>
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
