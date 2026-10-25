import { useRef, useState, type DragEvent } from "react";
import { ImagePlus } from "lucide-react";
import { checkPicture, mayAnimate, PICTURE_ACCEPT, type PictureKind } from "../../features/pictures/upload";
import { classifyAuthError } from "../../utils/authErrors";
import { Button, ProgressBar } from "@pufferblow/spines";
import { FeedbackLine, type Feedback } from "./SettingsParts";

export interface PictureUploaderProps {
  label: string;
  kind: PictureKind;
  /** The uploaded picture's address, when there is one to show. */
  current?: string | null;
  /** Whether the picture is the one being shown (an upload), as opposed to the default art. */
  custom: boolean;
  /** Sends the file; `onProgress` gets the bytes sent so far and the total. Resolves once the change is in place. */
  upload: (file: File, onProgress: (loaded: number, total: number) => void) => Promise<void>;
  /** Goes back to the default art. Left out when there is nothing to go back to. */
  revert?: () => Promise<void>;
  /** The size the instance allows, in MB, when it says. */
  maxMb?: number | null;
  /** A line under the buttons about where the picture shows. */
  hint?: string;
}

/**
 * Choosing a picture: a tile showing what is there now (animated ones move), a button or a dropped file
 * to replace it, a progress bar while it goes up, and a way back to the default art.
 */
export function PictureUploader({ label, kind, current, custom, upload, revert, maxMb, hint }: PictureUploaderProps) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [reverting, setReverting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [dragging, setDragging] = useState(false);
  const busy = progress !== null || reverting;
  const wide = kind === "banner";

  const send = async (file: File | undefined) => {
    if (!file || busy) return;
    const problem = checkPicture(file, maxMb);
    if (problem) {
      setFeedback({ kind: "error", message: problem });
      return;
    }
    setFeedback(null);
    setProgress({ loaded: 0, total: file.size });
    try {
      await upload(file, (loaded, total) => setProgress({ loaded, total }));
      setFeedback({ kind: "success", message: mayAnimate(file) ? `${label} saved. If it is animated, it will move.` : `${label} saved.` });
    } catch (error) {
      setFeedback({ kind: "error", message: classifyAuthError(error, `Couldn't upload the ${label.toLowerCase()}. Try again.`).message });
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  };

  const goBack = async () => {
    if (!revert || busy) return;
    setFeedback(null);
    setReverting(true);
    try {
      await revert();
      setFeedback({ kind: "success", message: "Back to the default." });
    } catch (error) {
      setFeedback({ kind: "error", message: classifyAuthError(error, "Couldn't go back to the default. Try again.").message });
    } finally {
      setReverting(false);
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void send(event.dataTransfer.files[0]);
  };

  return (
    <div role="group" aria-label={`${label} picture`} className="flex flex-col gap-2.5">
      <span className="pb-section-label text-text-tertiary">{label}</span>
      <div className="flex flex-wrap items-center gap-4">
        <div
          data-testid={`${kind}-tile`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`grid shrink-0 place-items-center overflow-hidden bg-surface-tertiary text-text-muted ${wide ? "h-16 w-44 rounded-md" : "size-18 rounded-full"} ${dragging ? "shadow-[0_0_0_2px_var(--color-text)]" : ""}`}
        >
          {custom && current ? (
            <img src={current} alt={`Your ${label.toLowerCase()}`} draggable={false} className="size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-[11px]">
              <ImagePlus size={18} aria-hidden="true" />
              {dragging ? "Drop it" : "Default"}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
              {custom ? "Replace picture" : "Upload picture"}
            </Button>
            {custom && revert && (
              <Button size="sm" variant="secondary" disabled={busy} loading={reverting} onClick={() => void goBack()}>
                Use the default
              </Button>
            )}
            <input ref={input} type="file" hidden accept={PICTURE_ACCEPT} aria-label={`${label} file`} onChange={(e) => void send(e.target.files?.[0])} />
          </div>
          {progress && <ProgressBar loaded={progress.loaded} total={progress.total} label={`Uploading the ${label.toLowerCase()}`} />}
          <p className="pb-meta m-0 text-[12.5px]">
            PNG, JPG, WebP, AVIF or an animated GIF{maxMb ? `, up to ${maxMb} MB` : ""}.{hint ? ` ${hint}` : ""}
          </p>
          <FeedbackLine feedback={feedback} />
        </div>
      </div>
    </div>
  );
}
