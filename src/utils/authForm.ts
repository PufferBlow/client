import { getStoredInstance, resolveInstance } from "../services/instance";
import type { InstanceConfig } from "../services/types";
import { parseHandle } from "./authErrors";

export type HandleTarget =
  | { ok: true; username: string; instance: InstanceConfig }
  | { ok: false; error: string };

const INSTANCE_ERROR =
  "Invalid instance address. Use values like 'localhost:7575', 'https://pufferblow.example' or 'chat.example.com'.";

/**
 * Turn a `username@instance` handle into a username and a resolved instance.
 * Without an `@instance` part, the last instance used on this device is reused.
 */
export function resolveHandle(input: string): HandleTarget {
  const { username, instance: typed } = parseHandle(input);
  if (!username) return { ok: false, error: "Enter your handle, like name@chat.example.com." };

  const source = typed ?? getStoredInstance()?.origin ?? null;
  if (!source) return { ok: false, error: "Add your instance after the name, like name@chat.example.com." };

  try {
    return { ok: true, username, instance: resolveInstance(source) };
  } catch {
    return { ok: false, error: INSTANCE_ERROR };
  }
}
