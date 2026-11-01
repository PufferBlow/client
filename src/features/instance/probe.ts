import { api, ApiError } from "../../services/api";
import { getApiUrl, getStoredInstance } from "../../services/instance";

const PROBE_TIMEOUT_MS = 8_000;

/** True when the instance answers at all; an HTTP error still means it is up (just maybe busy or unwell). */
export async function instanceAnswers(): Promise<boolean> {
  const instance = getStoredInstance();
  if (!instance) return false;
  try {
    await api.get(`${getApiUrl(instance)}/api/v1/system/server-info`, {
      timeout: PROBE_TIMEOUT_MS,
    });
    return true;
  } catch (error) {
    return error instanceof ApiError && error.status !== 0;
  }
}
