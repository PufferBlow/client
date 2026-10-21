import { useMemo } from "react";
import { resolveHandle } from "../../utils/authForm";
import type { InstanceConfig } from "../../services/types";
import { useDebounced, useInstancePreview } from "./preview";

export type HandleProbe = "idle" | "checking" | "found" | "missing";

/**
 * The instance a handle points at, and whether it answered. Waits until typing pauses so a
 * half-typed address is never asked about.
 */
export function useHandleInstance(handle: string) {
  const settled = useDebounced(handle.trim(), 600);
  const instance = useMemo<InstanceConfig | null>(() => {
    if (!settled.includes("@")) return null; // the remembered instance is not "found", it is a default
    const target = resolveHandle(settled);
    return target.ok ? target.instance : null;
  }, [settled]);
  const preview = useInstancePreview(instance);

  let probe: HandleProbe = "idle";
  if (instance) probe = preview.isPending ? "checking" : preview.isSuccess ? "found" : "missing";
  return { instance, preview: preview.data ?? null, probe };
}
