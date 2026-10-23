import { useSyncExternalStore } from "react";

/** How far along a transfer is: bytes done and bytes in all (0 when the size is not known yet). */
export interface Progress {
  loaded: number;
  total: number;
}

type Listener = () => void;

const uploads = new Map<string, Progress>();
const listeners = new Set<Listener>();

const emit = () => {
  for (const listener of [...listeners]) listener();
};

/** Progress of the files going up with a message that is still sending, by the message's local id. */
export const uploadProgress = {
  set(id: string, progress: Progress): void {
    uploads.set(id, progress);
    emit();
  },
  clear(id: string): void {
    if (uploads.delete(id)) emit();
  },
  get: (id: string): Progress | undefined => uploads.get(id),
};

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The upload progress of a sending message; undefined while nothing has been reported yet. */
export function useUploadProgress(id: string): Progress | undefined {
  return useSyncExternalStore(subscribe, () => uploads.get(id));
}

/**
 * Adds up the progress of several files that go up one by one (or at once): each reports its own
 * bytes, and the total is what the person sees. `sizes` are the files' sizes in order.
 */
export function combinedProgress(sizes: readonly number[], report: (progress: Progress) => void): (index: number) => (loaded: number, total: number) => void {
  const done = sizes.map(() => 0);
  const grand = sizes.reduce((sum, n) => sum + n, 0);
  return (index) => (loaded, total) => {
    // The request body is a little larger than the file (multipart framing): count the file's own share.
    done[index] = total > 0 ? Math.min(sizes[index]!, Math.round((loaded / total) * sizes[index]!)) : 0;
    report({ loaded: done.reduce((sum, n) => sum + n, 0), total: grand });
  };
}
