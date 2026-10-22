/// <reference lib="webworker" />
import { createFrameCipher, type FrameKeys } from "./crypto/frames";

/**
 * Runs inside a worker: the browser hands every encoded audio frame of a call's senders and
 * receivers to `onrtctransform`, and this seals or opens it. One worker per call, so the sender's
 * counter and the receiver's replay window live together.
 */
const cipher = createFrameCipher();

interface TransformEvent extends Event {
  transformer: { readable: ReadableStream; writable: WritableStream; options: { operation: "seal" | "open" } };
}

self.onmessage = (event: MessageEvent<{ type: "keys"; keys: FrameKeys }>) => {
  if (event.data?.type === "keys") cipher.setKeys(event.data.keys);
};

(self as unknown as { onrtctransform: (event: TransformEvent) => void }).onrtctransform = (event) => {
  const { readable, writable, options } = event.transformer;
  void readable.pipeThrough(options.operation === "seal" ? cipher.seal() : cipher.open()).pipeTo(writable);
};
