import React from "react";
import {
  Archive,
  File,
  FileCode,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
} from "lucide-react";

type FileTypeCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "code"
  | "text"
  | "unknown";

type IconSize = "sm" | "md" | "lg";

interface FileTypeMetaInput {
  filename?: string;
  mimeType?: string;
}

interface RenderFileTypeIconInput extends FileTypeMetaInput {
  size?: IconSize;
}

interface FileTypeMeta {
  category: FileTypeCategory;
  extension: string;
  badgeLabel?: string;
  Icon: React.ComponentType<{ className?: string }>;
}

interface FileTypeDescriptor {
  category: FileTypeCategory;
  Icon: React.ComponentType<{ className?: string }>;
  badgeLabel?: string;
}

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "avif",
  "heic",
]);

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "avi", "mkv", "m4v", "ogv"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz"]);

const DESCRIPTORS_BY_EXTENSION: Record<string, FileTypeDescriptor> = {
  pdf: { category: "document", Icon: FileText, badgeLabel: "PDF" },
  doc: { category: "document", Icon: FileText, badgeLabel: "DOC" },
  docx: { category: "document", Icon: FileText, badgeLabel: "DOCX" },
  txt: { category: "text", Icon: FileText, badgeLabel: "TXT" },
  md: { category: "text", Icon: FileText, badgeLabel: "MD" },
  c: { category: "code", Icon: FileCode, badgeLabel: "C" },
  cpp: { category: "code", Icon: FileCode, badgeLabel: "CPP" },
  h: { category: "code", Icon: FileCode, badgeLabel: "H" },
  hpp: { category: "code", Icon: FileCode, badgeLabel: "HPP" },
  py: { category: "code", Icon: FileCode, badgeLabel: "PY" },
  java: { category: "code", Icon: FileCode, badgeLabel: "JAVA" },
  ts: { category: "code", Icon: FileCode, badgeLabel: "TS" },
  tsx: { category: "code", Icon: FileCode, badgeLabel: "TSX" },
  js: { category: "code", Icon: FileCode, badgeLabel: "JS" },
  jsx: { category: "code", Icon: FileCode, badgeLabel: "JSX" },
};

const DESCRIPTORS_BY_MIME: Record<string, FileTypeDescriptor> = {
  "application/pdf": { category: "document", Icon: FileText, badgeLabel: "PDF" },
  "application/msword": { category: "document", Icon: FileText, badgeLabel: "DOC" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    category: "document",
    Icon: FileText,
    badgeLabel: "DOCX",
  },
  "text/x-c": { category: "code", Icon: FileCode, badgeLabel: "C" },
  "text/x-python": { category: "code", Icon: FileCode, badgeLabel: "PY" },
  "text/x-java-source": { category: "code", Icon: FileCode, badgeLabel: "JAVA" },
  "text/javascript": { category: "code", Icon: FileCode, badgeLabel: "JS" },
  "application/javascript": { category: "code", Icon: FileCode, badgeLabel: "JS" },
  "application/typescript": { category: "code", Icon: FileCode, badgeLabel: "TS" },
};

const FALLBACK_DESCRIPTOR: FileTypeDescriptor = {
  category: "unknown",
  Icon: File,
};

const SIZE_CLASS_MAP: Record<
  IconSize,
  { container: string; icon: string; badge: string; badgeOffset: string }
> = {
  sm: {
    container: "h-6 w-6",
    icon: "h-4 w-4",
    badge: "px-1 text-[9px]",
    badgeOffset: "-bottom-1 -right-1",
  },
  md: {
    container: "h-8 w-8",
    icon: "h-5 w-5",
    badge: "px-1 text-[10px]",
    badgeOffset: "-bottom-1.5 -right-1.5",
  },
  lg: {
    container: "h-10 w-10",
    icon: "h-6 w-6",
    badge: "px-1.5 text-[10px]",
    badgeOffset: "-bottom-2 -right-2",
  },
};

const extractExtension = (value?: string): string => {
  if (!value) return "";
  const stripped = value.split("?")[0]?.split("#")[0] || "";
  const tail = stripped.split("/").pop() || stripped;
  if (!tail.includes(".")) return "";
  return (tail.split(".").pop() || "").toLowerCase();
};

const inferDescriptorByMimePrefix = (mimeType: string): FileTypeDescriptor | null => {
  if (mimeType.startsWith("image/")) {
    return { category: "image", Icon: ImageIcon };
  }
  if (mimeType.startsWith("video/")) {
    return { category: "video", Icon: Film };
  }
  if (mimeType.startsWith("audio/")) {
    return { category: "audio", Icon: Music };
  }
  if (
    mimeType.startsWith("text/") ||
    mimeType.includes("json") ||
    mimeType.includes("xml") ||
    mimeType.includes("yaml")
  ) {
    return { category: "text", Icon: FileText };
  }
  if (mimeType.includes("zip") || mimeType.includes("compressed") || mimeType.includes("archive")) {
    return { category: "archive", Icon: Archive };
  }
  return null;
};

const inferDescriptorByExtensionGroup = (extension: string): FileTypeDescriptor | null => {
  if (IMAGE_EXTENSIONS.has(extension)) {
    return { category: "image", Icon: ImageIcon };
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return { category: "video", Icon: Film };
  }
  if (AUDIO_EXTENSIONS.has(extension)) {
    return { category: "audio", Icon: Music };
  }
  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return { category: "archive", Icon: Archive };
  }
  return null;
};

const withFallbackBadge = (descriptor: FileTypeDescriptor, extension: string): FileTypeDescriptor => {
  if (descriptor.badgeLabel || !extension) {
    return descriptor;
  }
  if (descriptor.category === "code" || descriptor.category === "document" || descriptor.category === "text") {
    return {
      ...descriptor,
      badgeLabel: extension.toUpperCase().slice(0, 5),
    };
  }
  return descriptor;
};

export const resolveFileTypeMeta = ({ filename, mimeType }: FileTypeMetaInput): FileTypeMeta => {
  const extension = extractExtension(filename);
  const normalizedMimeType = (mimeType || "").trim().toLowerCase();

  const descriptor =
    (extension ? DESCRIPTORS_BY_EXTENSION[extension] : undefined) ||
    (normalizedMimeType ? DESCRIPTORS_BY_MIME[normalizedMimeType] : undefined) ||
    inferDescriptorByExtensionGroup(extension) ||
    (normalizedMimeType ? inferDescriptorByMimePrefix(normalizedMimeType) : null) ||
    FALLBACK_DESCRIPTOR;

  return {
    category: descriptor.category,
    extension,
    badgeLabel: withFallbackBadge(descriptor, extension).badgeLabel,
    Icon: descriptor.Icon,
  };
};

export const renderFileTypeIcon = ({
  filename,
  mimeType,
  size = "md",
}: RenderFileTypeIconInput): React.ReactElement => {
  const meta = resolveFileTypeMeta({ filename, mimeType });
  const sizeClasses = SIZE_CLASS_MAP[size];
  const Icon = meta.Icon;

  return (
    <span
      className={`relative inline-flex ${sizeClasses.container} items-center justify-center rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]`}
      title={meta.extension ? `.${meta.extension}` : "file"}
      aria-label={meta.extension ? `${meta.extension} file` : "file"}
    >
      <Icon className={sizeClasses.icon} />
      {meta.badgeLabel ? (
        <span
          className={`pointer-events-none absolute ${sizeClasses.badgeOffset} rounded border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] ${sizeClasses.badge} font-semibold uppercase leading-tight text-[var(--color-text)]`}
        >
          {meta.badgeLabel}
        </span>
      ) : null}
    </span>
  );
};

