import { useCallback, useState } from "react";
import { classifyAuthError } from "../../utils/authErrors";
import type { Feedback } from "./SettingsParts";

/** Runs an async settings action and tracks its loading and success/error feedback. */
export function useSave(successMessage: string, errorFallback = "Couldn't save your changes. Try again.") {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const run = useCallback(
    async (action: () => Promise<void>): Promise<boolean> => {
      setLoading(true);
      setFeedback(null);
      try {
        await action();
        setFeedback({ kind: "success", message: successMessage });
        return true;
      } catch (err) {
        setFeedback({ kind: "error", message: classifyAuthError(err, errorFallback).message });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [successMessage, errorFallback],
  );

  const fail = useCallback((message: string) => setFeedback({ kind: "error", message }), []);

  return { run, loading, feedback, fail };
}
