import type { CallSignal } from "./types";

type Listener = (signal: CallSignal) => void;

const listeners = new Set<Listener>();

/**
 * Call signals come in on the one realtime connection, which lives above the call itself. The
 * realtime layer publishes here and the call provider listens, so neither has to know about the other.
 */
export const callSignals = {
  emit(signal: CallSignal): void {
    for (const listener of [...listeners]) listener(signal);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
