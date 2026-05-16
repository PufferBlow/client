/**
 * FilePreviewSidebar — right-side slide-in panel that previews a storage
 * file (image, video, audio, gif, pdf, text, or a download fallback) and
 * shows its provenance: who uploaded it, in which channel, in which
 * message. Replaces the older centered FileViewerModal in the admin
 * Storage tab.
 *
 * Design notes:
 *   - Orphan files (no FileReferences row -> `is_orphaned === true`) are
 *     handled by *not opening* the sidebar at all -- StorageTab hides the
 *     Preview button for those. If this sidebar is ever opened on an
 *     orphan (programmatic call, future entry point), we still degrade
 *     gracefully and just omit the provenance section.
 *   - Slide-in is achieved with a translate-x transition that flips when
 *     `isOpen` toggles. We keep the element mounted while closed but
 *     translated off-screen, so the transition runs in both directions.
 *   - z-index sits above the control panel header (z-50) but below
 *     toasts; matches the existing modal stacking.
 */

import { useEffect, useState } from "react";
import { X, Download, ExternalLink, FileText, Hash, User as UserIcon } from "lucide-react";
import { logger } from "../../utils/logger";
import type { StorageFile } from "./types";

type FilePreviewSidebarProps = {
  isOpen: boolean;
  file: StorageFile | null;
  onClose: () => void;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const formatDateTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export function FilePreviewSidebar({ isOpen, file, onClose }: FilePreviewSidebarProps) {
  // Text/JSON files need an explicit fetch to render their contents.
  // Binary types (image/video/audio/pdf) bind the URL directly to the
  // appropriate element, so we only kick off this fetch for text MIME.
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  useEffect(() => {
    if (!isOpen || !file) {
      setTextContent(null);
      return;
    }
    const t = file.type || "";
    const isText = t.startsWith("text/") || t === "application/json";
    if (!isText) {
      setTextContent(null);
      return;
    }
    let cancelled = false;
    setLoadingText(true);
    setTextContent(null);
    void (async () => {
      try {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (!cancelled) setTextContent(text);
      } catch (err) {
        if (!cancelled) {
          setTextContent(null);
          logger.ui.warn("FilePreviewSidebar: text fetch failed", {
            filename: file.filename,
            error: String(err),
          });
        }
      } finally {
        if (!cancelled) setLoadingText(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, file]);

  // Close on Escape -- standard sidebar behavior. Bound only while open
  // so it doesn't interfere with other keyboard shortcuts.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const renderContent = () => {
    if (!file) return null;
    const t = file.type || "";

    if (t.startsWith("image/")) {
      // image/gif is the same render path -- the <img> element animates
      // GIFs natively, so we don't need a special case.
      return (
        <div className="flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-tertiary)] p-2">
          <img
            src={file.url}
            alt={file.filename}
            className="max-h-[55vh] max-w-full rounded object-contain"
          />
        </div>
      );
    }
    if (t.startsWith("video/")) {
      return (
        <div className="flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-black">
          <video
            src={file.url}
            controls
            preload="metadata"
            className="max-h-[55vh] max-w-full rounded"
          />
        </div>
      );
    }
    if (t.startsWith("audio/")) {
      return (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-tertiary)] p-6">
          <FileText className="h-12 w-12 text-[var(--color-text-muted)]" />
          <audio src={file.url} controls className="w-full" />
        </div>
      );
    }
    if (t === "application/pdf") {
      return (
        <iframe
          src={file.url}
          title={file.filename}
          className="h-[55vh] w-full rounded-lg border border-[var(--color-border)]"
        />
      );
    }
    if (t.startsWith("text/") || t === "application/json") {
      if (loadingText) {
        return (
          <div className="flex items-center justify-center py-12 text-sm text-[var(--color-text-secondary)]">
            <div className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            Loading…
          </div>
        );
      }
      return (
        <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-tertiary)] p-4 font-mono text-xs text-[var(--color-text)]">
          {textContent ?? "(empty)"}
        </pre>
      );
    }

    // Unrenderable type -- show a download CTA and the MIME so the admin
    // knows what they're looking at.
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-tertiary)] p-8 text-center">
        <FileText className="h-12 w-12 text-[var(--color-text-muted)]" />
        <div className="text-sm text-[var(--color-text-secondary)]">
          No inline preview available for <span className="font-mono">{t || "unknown type"}</span>.
        </div>
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
      </div>
    );
  };

  // Provenance row helper -- omits the row entirely when the value is
  // missing, so we don't render empty fields with "—".
  const MetaRow = ({
    icon,
    label,
    value,
    mono = false,
  }: {
    icon: React.ReactNode;
    label: string;
    value: React.ReactNode;
    mono?: boolean;
  }) => (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center text-[var(--color-text-muted)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {label}
        </div>
        <div
          className={`mt-0.5 text-sm text-[var(--color-text)] break-all ${mono ? "font-mono text-xs" : ""}`}
        >
          {value}
        </div>
      </div>
    </div>
  );

  // Friendly label for the reference_type field, which is otherwise a
  // raw enum string like "message_attachment". Falls back to the raw
  // value for any reference type we don't have a label for, so future
  // backend additions still surface something readable.
  const referenceTypeLabel = (t: string | null | undefined): string | null => {
    if (!t) return null;
    switch (t) {
      case "message_attachment":
        return "Message attachment";
      case "user_avatar":
        return "User avatar";
      case "user_banner":
        return "User banner";
      case "server_avatar":
        return "Server icon";
      case "server_banner":
        return "Server banner";
      default:
        return t.replace(/_/g, " ");
    }
  };

  return (
    <>
      {/* Backdrop -- click anywhere outside the panel to dismiss.
          Lower z than the panel itself; transparent click target only. */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* The sidebar itself. Slides in from the right. */}
      <aside
        className={`fixed top-0 right-0 z-50 flex h-screen w-full max-w-[480px] flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="File preview"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-[var(--color-text)]" title={file?.filename}>
              {file?.filename ?? "File preview"}
            </h2>
            {file && (
              <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {formatFileSize(file.size)} · <span className="font-mono">{file.type || "—"}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-md p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-tertiary)] hover:text-[var(--color-text)]"
            title="Close"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {file ? (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Preview render */}
            {renderContent()}

            {/* Provenance / metadata */}
            <div className="mt-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/40 p-2 px-3 divide-y divide-[var(--color-border)]/60">
              {/* Reference type, when known */}
              {referenceTypeLabel(file.reference_type) && (
                <MetaRow
                  icon={<FileText className="h-4 w-4" />}
                  label="Kind"
                  value={referenceTypeLabel(file.reference_type)}
                />
              )}

              {/* Uploader -- prefer the resolved username; fall back to the
                  legacy `uploader` string; if everything is "Unknown" skip. */}
              {(file.uploader_username || (file.uploader && file.uploader !== "Unknown")) && (
                <MetaRow
                  icon={<UserIcon className="h-4 w-4" />}
                  label="Uploaded by"
                  value={
                    <div>
                      <div>{file.uploader_username || file.uploader}</div>
                      {file.uploader_user_id && (
                        <div className="mt-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
                          {file.uploader_user_id}
                        </div>
                      )}
                    </div>
                  }
                />
              )}

              {/* Channel context, only for message attachments */}
              {(file.channel_name || file.channel_id) && (
                <MetaRow
                  icon={<Hash className="h-4 w-4" />}
                  label="Channel"
                  value={
                    <div>
                      <div>#{file.channel_name || "(unknown channel)"}</div>
                      {file.channel_id && (
                        <div className="mt-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
                          {file.channel_id}
                        </div>
                      )}
                    </div>
                  }
                />
              )}

              {/* Message link */}
              {file.message_id && (
                <MetaRow
                  icon={<ExternalLink className="h-4 w-4" />}
                  label="Message"
                  value={<span className="font-mono text-xs">{file.message_id}</span>}
                  mono
                />
              )}

              {/* Always-present rows */}
              <MetaRow
                icon={<FileText className="h-4 w-4" />}
                label="Uploaded"
                value={formatDateTime(file.uploaded_at)}
              />
              {file.subdirectory && (
                <MetaRow
                  icon={<FileText className="h-4 w-4" />}
                  label="Directory"
                  value={<span className="capitalize">{file.subdirectory}</span>}
                />
              )}
              {file.is_orphaned && (
                <MetaRow
                  icon={<FileText className="h-4 w-4 text-[var(--color-error)]" />}
                  label="Status"
                  value={
                    <span className="text-[var(--color-error)]">
                      Orphan — not referenced by any message, user, or server asset.
                    </span>
                  }
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Footer */}
        {file && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-tertiary)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-secondary)]"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
            <button
              onClick={onClose}
              className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
            >
              Close
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
