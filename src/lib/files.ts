/**
 * Attachment helpers. A spoilered attachment is marked the way Discord marks it, with a
 * `SPOILER_` file name prefix, so it needs nothing from the server and survives federation.
 */

import { createLogger } from "./logger";

const log = createLogger("files");

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

/**
 * How a message's image and video attachments are laid out as a gallery: the number of tiles per
 * row, top to bottom. It follows Discord's grid, so the short row goes on top (3 → 1 + 2, 5 → 2 + 3,
 * 7 → 1 + 3 + 3) and every other row holds up to three.
 */
export function galleryRows(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [1];
  if (count === 3) return [1, 2];
  if (count === 4) return [2, 2];
  const rows: number[] = [];
  let left = count;
  if (left % 3 === 1) {
    rows.push(1);
    left -= 1;
  } else if (left % 3 === 2) {
    rows.push(2);
    left -= 2;
  }
  while (left > 0) {
    rows.push(3);
    left -= 3;
  }
  return rows;
}

/** Downloads a file from `url` as the given name. A cross-origin link ignores `download`, so the bytes are fetched first. */
export async function downloadFile(url: string, filename: string): Promise<void> {
  log.debug(`downloading ${filename}`, { url });
  const response = await fetch(url);
  if (!response.ok) {
    log.warn(`download of ${filename} failed with ${response.status}`, { url });
    throw new Error(`Download failed (${response.status}).`);
  }
  const blob = await response.blob();
  log.info(`downloaded ${filename} (${formatBytes(blob.size)})`);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
