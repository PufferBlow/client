import { useId, useState, type FormEvent, type RefObject } from "react";
import { Button } from "../ui/Button";
import { FloatingPanel } from "../ui/FloatingPanel";
import { Input } from "../ui/Input";
import { MAX_DESCRIPTION } from "../../lib/files";

const MAX_NAME = 150;

export interface AttachmentDetails {
  name: string;
  description: string;
}

export interface AttachmentEditorProps {
  /** The button the panel hangs from. */
  anchor: RefObject<HTMLElement | null>;
  /** What the file is called when it was picked, restored when the name is left empty. */
  originalName: string;
  /** Only pictures and video are described; for any other file the panel is just its name. */
  describable: boolean;
  value: AttachmentDetails;
  onSave: (next: AttachmentDetails) => void;
  onClose: () => void;
}

/** The small form behind an attachment's edit button: the name it is sent under and what it shows. */
export function AttachmentEditor({ anchor, originalName, describable, value, onSave, onClose }: AttachmentEditorProps) {
  const [name, setName] = useState(value.name);
  const [description, setDescription] = useState(value.description);
  const nameId = useId();
  const descriptionId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation(); // React bubbles through the portal, and the composer around it is a form too
    onSave({ name: name.trim() || originalName, description: describable ? description.trim() : "" });
    onClose();
  };

  return (
    <FloatingPanel anchor={anchor} onClose={onClose} label={describable ? "Edit attachment" : "Rename attachment"} className="w-[300px] max-w-[calc(100vw-16px)]">
      <form onSubmit={submit} className="flex flex-col gap-3 p-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="pb-label text-[11px] text-text-tertiary">
            File name
          </label>
          <Input id={nameId} autoFocus value={name} maxLength={MAX_NAME} onChange={(e) => setName(e.target.value)} className="h-9 text-[13.5px]" />
        </div>
        {describable && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={descriptionId} className="pb-label text-[11px] text-text-tertiary">
            Description
          </label>
          <textarea
            id={descriptionId}
            value={description}
            maxLength={MAX_DESCRIPTION}
            rows={3}
            placeholder="Say what the file shows, for people who can't see it"
            onChange={(e) => setDescription(e.target.value)}
            className="w-full resize-none rounded-md border-0 bg-surface-secondary px-3 py-2 text-[13.5px] text-text placeholder:text-text-muted focus:outline-none focus:shadow-[0_0_0_2px_var(--color-surface-tertiary),0_0_0_4px_var(--color-text)]"
          />
          <span className="pb-meta self-end text-[11px]">
            {description.length}/{MAX_DESCRIPTION}
          </span>
        </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm">
            Save
          </Button>
        </div>
      </form>
    </FloatingPanel>
  );
}
