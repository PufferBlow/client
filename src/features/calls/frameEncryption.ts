import { createFrameCipher, type FrameCipher, type FrameKeys } from "./crypto/frames";

/** What the voice transport needs from frame encryption; the real one below, fakes in tests. */
export interface FrameEncryption {
  /** Seal what this sender sends. Must be called before media flows. */
  protectSender(sender: RTCRtpSender): void;
  /** Open what this receiver receives. */
  protectReceiver(receiver: RTCRtpReceiver): void;
  /** Keys arrive after the connection starts (the other side's public key is needed); until then frames are dropped. */
  setKeys(keys: FrameKeys): void;
  /** Extra `RTCPeerConnection` configuration the browser needs for this. */
  readonly configuration: Record<string, unknown>;
  dispose(): void;
}

interface ScriptTransformCtor {
  new (worker: Worker, options: { operation: "seal" | "open" }): unknown;
}

type EncodedStreams = { readable: ReadableStream; writable: WritableStream };
type WithStreams = { createEncodedStreams?: () => EncodedStreams; transform?: unknown };

/** Whether this browser can encrypt encoded frames at all. A call that needs it must not run without. */
export function canEncryptFrames(): boolean {
  const g = globalThis as unknown as { RTCRtpScriptTransform?: unknown; RTCRtpSender?: { prototype: WithStreams } };
  return typeof g.RTCRtpScriptTransform === "function" || typeof g.RTCRtpSender?.prototype?.createEncodedStreams === "function";
}

/**
 * Frame encryption through `RTCRtpScriptTransform` and a worker where the browser has it, otherwise
 * through the older `createEncodedStreams` on the page itself.
 */
export function browserFrameEncryption(): FrameEncryption {
  const Script = (globalThis as unknown as { RTCRtpScriptTransform?: ScriptTransformCtor }).RTCRtpScriptTransform;
  if (Script) {
    const worker = new Worker(new URL("./callFrameWorker.ts", import.meta.url), { type: "module" });
    return {
      protectSender: (sender) => void ((sender as unknown as WithStreams).transform = new Script(worker, { operation: "seal" })),
      protectReceiver: (receiver) => void ((receiver as unknown as WithStreams).transform = new Script(worker, { operation: "open" })),
      setKeys: (keys) => worker.postMessage({ type: "keys", keys }),
      configuration: {},
      dispose: () => worker.terminate(),
    };
  }

  const cipher: FrameCipher = createFrameCipher();
  const pipe = (streams: EncodedStreams | undefined, transform: TransformStream) => void streams?.readable.pipeThrough(transform).pipeTo(streams.writable).catch(() => undefined);
  return {
    protectSender: (sender) => pipe((sender as unknown as WithStreams).createEncodedStreams?.(), cipher.seal() as TransformStream),
    protectReceiver: (receiver) => pipe((receiver as unknown as WithStreams).createEncodedStreams?.(), cipher.open() as TransformStream),
    setKeys: (keys) => cipher.setKeys(keys),
    configuration: { encodedInsertableStreams: true },
    dispose: () => undefined,
  };
}
