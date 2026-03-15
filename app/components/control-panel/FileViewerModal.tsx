import { useEffect, useState } from "react";
import { Button } from "../Button";
import { Modal } from "../ui/Modal";
import { logger } from "../../utils/logger";
import type { StorageFile } from "./types";

type FileViewerModalProps = {
  isOpen: boolean;
  file: StorageFile | null;
  onClose: () => void;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) {
    return "0 Bytes";
  }

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, index)).toFixed(2))} ${sizes[index]}`;
};

export function FileViewerModal({ isOpen, file, onClose }: FileViewerModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !file) {
      return;
    }

    const loadFileContent = async () => {
      setLoading(true);
      setContent(null);

      try {
        const fileType = file.type || "";
        if (fileType.startsWith("text/") || fileType === "application/json") {
          const response = await fetch(file.url);
          if (response.ok) {
            const text = await response.text();
            setContent(text);
            logger.ui.info("File content loaded successfully", { filename: file.filename });
          }
        }
      } catch {
        setContent("Error loading file content");
      } finally {
        setLoading(false);
      }
    };

    void loadFileContent();
  }, [file, isOpen]);

  if (!isOpen || !file) {
    return null;
  }

  const fileType = file.type || "";

  const renderFileContent = () => {
    if (fileType.startsWith("image/")) {
      return (
        <div className="flex justify-center">
          <img
            src={file.url}
            alt={file.filename}
            className="max-h-96 max-w-full rounded-lg border border-[var(--color-border)] object-contain"
          />
        </div>
      );
    }

    if (fileType.startsWith("video/")) {
      return (
        <div className="flex justify-center">
          <video
            src={file.url}
            controls
            className="max-h-96 max-w-full rounded-lg border border-[var(--color-border)]"
            preload="metadata"
          />
        </div>
      );
    }

    if (fileType.startsWith("audio/")) {
      return (
        <div className="flex justify-center">
          <audio src={file.url} controls className="w-full max-w-md" />
        </div>
      );
    }

    if (fileType === "application/pdf") {
      return (
        <div className="flex justify-center">
          <iframe
            src={file.url}
            className="h-96 w-full rounded-lg border border-[var(--color-border)]"
            title={file.filename}
          />
        </div>
      );
    }

    if (content) {
      return (
        <div className="max-h-96 overflow-auto rounded-lg bg-[var(--color-surface-tertiary)] p-4">
          <pre className="whitespace-pre-wrap break-words font-mono text-sm text-[var(--color-text)]">
            {content}
          </pre>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center text-[var(--color-text-secondary)]">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            <p>Loading file content...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-center">
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-2 rounded-lg bg-[var(--color-primary)] px-6 py-3 text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span>Download File</span>
        </a>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={file.filename}
      description={`${formatFileSize(file.size)} | ${file.type} | Uploaded ${new Date(file.uploaded_at).toLocaleDateString()} by ${file.uploader}`}
      widthClassName="max-w-4xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <a href={file.url} target="_blank" rel="noopener noreferrer">
            <Button>Download</Button>
          </a>
        </div>
      }
    >
      <div className="max-h-[65vh] overflow-y-auto">{renderFileContent()}</div>
    </Modal>
  );
}
