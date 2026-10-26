import { Download } from "lucide-react";
import { useUpdates } from "./hooks";

/** Shown in the title bar only once a new version has finished downloading: one press restarts into it. */
export function UpdateButton() {
  const { state, install } = useUpdates();
  if (state?.status !== "ready") return null;
  return (
    <button
      type="button"
      onClick={() => void install()}
      title={`Pufferblow ${state.version} is ready. Restart to update.`}
      className="mr-2 flex h-6 items-center gap-1.5 self-center rounded-pill bg-primary px-3 text-[12px] font-semibold text-on-primary hover:opacity-90"
    >
      <Download size={13} aria-hidden="true" />
      Update ready · Restart
    </button>
  );
}
