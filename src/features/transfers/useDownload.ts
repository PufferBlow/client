import { useCallback, useEffect, useRef, useState } from "react";
import { downloadFile } from "../../lib/files";
import type { Progress } from "./store";

export type DownloadState =
  | { status: "idle" }
  | { status: "downloading"; progress: Progress }
  | { status: "done" }
  | { status: "failed"; message: string };

/** One file's download inside the app: start it, watch its progress, cancel it. */
export function useDownload(href: string | undefined, filename: string) {
  const [state, setState] = useState<DownloadState>({ status: "idle" });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(() => {
    if (!href || controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setState({ status: "downloading", progress: { loaded: 0, total: 0 } });
    downloadFile(href, filename, {
      signal: abort.signal,
      onProgress: (loaded, total) => setState({ status: "downloading", progress: { loaded, total } }),
    })
      .then(() => setState({ status: "done" }))
      .catch((error: unknown) => {
        if (abort.signal.aborted) setState({ status: "idle" });
        else setState({ status: "failed", message: error instanceof Error ? error.message : "Couldn't download the file." });
      })
      .finally(() => {
        controller.current = null;
      });
  }, [href, filename]);

  const cancel = useCallback(() => controller.current?.abort(), []);

  return { state, start, cancel };
}
