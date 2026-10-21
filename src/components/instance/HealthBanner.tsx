import { TriangleAlert } from "lucide-react";
import { usePublicHealth } from "../../features/health/hooks";

/**
 * Sits above the composer when the instance says it is having trouble. It never blocks the composer:
 * messages still send, and the notice only explains why things might be slow or missing.
 */
export function HealthBanner() {
  const { data } = usePublicHealth();
  if (data?.status !== "degraded") return null;
  return (
    <div role="status" className="mx-3.5 mb-2 flex items-center gap-3 rounded-lg bg-warning/10 px-3.5 py-2.5 shadow-[inset_0_0_1px_1px_rgba(230,193,92,0.25)]">
      <TriangleAlert size={16} aria-hidden="true" className="shrink-0 text-warning" />
      <span className="flex-1 text-[13.5px] text-text">This instance is having trouble. Things may be slow, and voice may be choppy.</span>
    </div>
  );
}
