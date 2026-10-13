/**
 * Attachment helpers. A spoilered attachment is marked the way Discord marks it, with a
 * `SPOILER_` file name prefix, so it needs nothing from the server and survives federation.
 */

export const SPOILER_PREFIX = "SPOILER_";

export const isSpoilerName = (name: string) => name.startsWith(SPOILER_PREFIX);

/** The file name without the spoiler marker. */
export const displayName = (name: string) => (isSpoilerName(name) ? name.slice(SPOILER_PREFIX.length) || name : name);

/** The same file, renamed so it is shown as a spoiler. */
export function asSpoiler(file: File): File {
  if (isSpoilerName(file.name)) return file;
  return new File([file], SPOILER_PREFIX + file.name, { type: file.type, lastModified: file.lastModified });
}

export type FileKind = "image" | "video" | "audio" | "file";

export function fileKind(type: string): FileKind {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "file";
}

/** 1536 → "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`;
}
