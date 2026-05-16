/**
 * StorageTab — server-side file manager. Lists, uploads, previews, and
 * deletes files in storage subdirectories. Cleans up orphaned files
 * (uploaded but no longer referenced).
 */
import React, { useEffect, useState } from "react";
import { getAuthTokenFromCookies } from "../../../services/user";
import {
  convertToFullStorageUrl,
  createApiClient,
} from "../../../services/apiClient";
import {
  listStorageFiles,
  deleteStorageFile,
  cleanupOrphanedFiles,
} from "../../../services/storage";
import { renderFileTypeIcon } from "../../../utils/fileTypeMeta";
import type { ShowToast } from "../../Toast";
import type { StorageFile } from "../types";

export function StorageTab({
  showToast,
  fileViewerModal,
  setFileViewerModal
}: {
  showToast: ShowToast;
  fileViewerModal: { isOpen: boolean; file: StorageFile | null };
  setFileViewerModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; file: StorageFile | null }>>;
}) {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [browseDirectory, setBrowseDirectory] = useState('all');
  const [uploadDirectory, setUploadDirectory] = useState('uploads');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmFile, setDeleteConfirmFile] = useState<StorageFile | null>(null);
  const [isCleaningOrphaned, setIsCleaningOrphaned] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const directories = [
    { value: 'all', label: 'All' },
    { value: 'uploads', label: 'Uploads' },
    { value: 'avatars', label: 'Avatars' },
    { value: 'banners', label: 'Banners' },
    { value: 'attachments', label: 'Attachments' },
    { value: 'images', label: 'Images' },
    { value: 'videos', label: 'Videos' },
    { value: 'audio', label: 'Audio' },
    { value: 'documents', label: 'Documents' },
    { value: 'stickers', label: 'Stickers' },
    { value: 'gifs', label: 'GIFs' },
    { value: 'files', label: 'Files' },
  ];

  const uploadDirectories = directories.filter(d => d.value !== 'all');

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const loadFiles = async () => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) {
      setError('Authentication token not found');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await listStorageFiles(browseDirectory, authToken);
      if (response.success && response.data) {
        setFiles((response.data as any).files || []);
      } else {
        setError(response.error || 'Failed to load files');
        setFiles([]);
      }
    } catch {
      setError('Network error occurred');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFiles(); }, [browseDirectory]);

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const authToken = getAuthTokenFromCookies();
    if (!authToken) {
      showToast({ message: 'Authentication token not found.', tone: 'error', category: 'system' });
      return;
    }
    setIsUploading(true);
    try {
      const results = await Promise.allSettled(
        Array.from(fileList).map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('directory', uploadDirectory);
          const apiClient = createApiClient();
          const response = await apiClient.post(
            `/api/v1/storage/upload?auth_token=${encodeURIComponent(authToken)}`,
            formData,
          );
          if (!response.success) throw new Error(response.error || `Upload failed for "${file.name}"`);
        })
      );
      const failed = results.filter(r => r.status === 'rejected');
      const succeeded = results.length - failed.length;
      if (failed.length > 0) {
        showToast({
          message: `${succeeded} uploaded, ${failed.length} failed.`,
          tone: succeeded > 0 ? 'warning' : 'error',
          category: 'system',
          dedupeKey: 'storage:upload:partial-failure',
        });
      } else {
        showToast({ message: `${succeeded} file${succeeded === 1 ? '' : 's'} uploaded.`, tone: 'success', category: 'system' });
      }
      await loadFiles();
    } catch (err) {
      showToast({ message: err instanceof Error ? err.message : 'Upload failed.', tone: 'error', category: 'system' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (file: StorageFile) => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) return;
    try {
      const response = await deleteStorageFile(file.url, authToken);
      if (response.success) {
        setFiles(prev => prev.filter(f => f.id !== file.id));
        showToast({ message: `"${file.filename}" deleted.`, tone: 'success', category: 'destructive' });
        setDeleteConfirmFile(null);
      } else {
        showToast({ message: `Failed to delete: ${response.error || 'Unknown error'}`, tone: 'error', category: 'system' });
      }
    } catch {
      showToast({ message: 'Network error while deleting file.', tone: 'error', category: 'system' });
    }
  };

  const handleCleanupOrphanedFiles = async () => {
    const authToken = getAuthTokenFromCookies();
    if (!authToken) return;
    setIsCleaningOrphaned(true);
    try {
      const response = await cleanupOrphanedFiles(browseDirectory === 'all' ? '' : browseDirectory, authToken);
      if (response.success) {
        showToast({
          message: `Cleaned up ${(response.data as any)?.deleted_count ?? 0} orphaned files.`,
          tone: 'success',
          category: 'destructive',
        });
        await loadFiles();
      } else {
        showToast({ message: `Cleanup failed: ${response.error || 'Unknown error'}`, tone: 'error', category: 'system' });
      }
    } catch {
      showToast({ message: 'Network error during cleanup.', tone: 'error', category: 'system' });
    } finally {
      setIsCleaningOrphaned(false);
    }
  };

  const handleCopyUrl = (file: StorageFile) => {
    const fullUrl = convertToFullStorageUrl(file.url);
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const filteredFiles = files.filter(file =>
    file.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (file.type || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const imageCount = files.filter(f => f.type?.startsWith('image/')).length;
  const orphanedCount = files.filter(f => f.is_orphaned).length;

  return (
    <div className="space-y-4">
      {/* Header + Stats */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text)]">Storage</h2>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Manage files stored on this instance</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCleanupOrphanedFiles}
              disabled={isCleaningOrphaned || orphanedCount === 0}
              title={orphanedCount === 0 ? 'No orphaned files' : `Clean ${orphanedCount} orphaned file${orphanedCount === 1 ? '' : 's'}`}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-warning) 15%, transparent)', color: 'var(--color-warning)', border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)' }}
            >
              {isCleaningOrphaned ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              {isCleaningOrphaned ? 'Cleaning…' : 'Clean Orphaned'}
            </button>
            <button
              onClick={() => setShowUpload(v => !v)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)]"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 divide-x divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {[
            { label: 'Files', value: files.length.toLocaleString(), icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', color: 'var(--color-primary)' },
            { label: 'Total size', value: formatFileSize(totalSize), icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', color: 'var(--color-success)' },
            { label: 'Images', value: imageCount.toLocaleString(), icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'var(--color-info)' },
            { label: 'Orphaned', value: orphanedCount.toLocaleString(), icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z', color: orphanedCount > 0 ? 'var(--color-error)' : 'var(--color-text-muted)' },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-3 px-6 py-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${stat.color} 12%, transparent)` }}>
                <svg className="w-4 h-4" fill="none" stroke={stat.color} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={stat.icon} />
                </svg>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-secondary)]">{stat.label}</div>
                <div className="text-lg font-semibold text-[var(--color-text)] leading-tight">{stat.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload panel (collapsible) */}
      {showUpload && (
        <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--color-text)]">Upload files</h3>
            <button onClick={() => setShowUpload(false)} className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="flex-1">
              <input
                type="file"
                multiple
                onChange={(e) => { handleFileUpload(e.target.files); e.target.value = ''; }}
                accept="image/*,video/*,audio/*,application/pdf,text/plain,application/zip"
                className="hidden"
                id="storage-file-upload"
              />
              <label
                htmlFor="storage-file-upload"
                className="flex flex-col items-center justify-center w-full border-2 border-dashed border-[var(--color-border)] rounded-lg p-8 cursor-pointer transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-secondary)]/30"
                style={{ pointerEvents: isUploading ? 'none' : 'auto', opacity: isUploading ? 0.6 : 1 }}
              >
                {isUploading ? (
                  <svg className="w-8 h-8 animate-spin text-[var(--color-primary)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-[var(--color-text-secondary)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                )}
                <span className="text-sm font-medium text-[var(--color-text)]">{isUploading ? 'Uploading…' : 'Click to select files'}</span>
                <span className="text-xs text-[var(--color-text-secondary)] mt-1">Images, video, audio, PDF, ZIP · multiple supported</span>
              </label>
            </div>

            <div className="sm:w-48 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Upload to</label>
                <select
                  value={uploadDirectory}
                  onChange={(e) => setUploadDirectory(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                >
                  {uploadDirectories.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File browser */}
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
        {/* Controls */}
        <div className="px-5 pt-4 pb-3 border-b border-[var(--color-border)] space-y-3">
          {/* Directory tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-0.5">
            {directories.map(dir => (
              <button
                key={dir.value}
                onClick={() => setBrowseDirectory(dir.value)}
                className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors"
                style={
                  browseDirectory === dir.value
                    ? { backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)' }
                    : { backgroundColor: 'var(--color-surface-secondary)', color: 'var(--color-text-secondary)' }
                }
              >
                {dir.label}
                {dir.value !== 'all' && files.filter(f => f.subdirectory === dir.value).length > 0 && (
                  <span className="ml-1 opacity-60">{files.filter(f => f.subdirectory === dir.value).length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or type…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] pl-9 pr-4 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>

        {/* File list */}
        <div className="divide-y divide-[var(--color-border)]">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-tertiary)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-[var(--color-surface-tertiary)] rounded w-48" />
                    <div className="h-3 bg-[var(--color-surface-tertiary)] rounded w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <svg className="w-10 h-10 mx-auto mb-3 text-[var(--color-error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-[var(--color-error)] mb-3">{error}</p>
              <button onClick={loadFiles} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]">Retry</button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-14 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center">
                <svg className="w-6 h-6 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                {searchTerm ? 'No files match your search' : `No files in ${browseDirectory === 'all' ? 'storage' : browseDirectory}`}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {searchTerm ? 'Try different keywords' : 'Upload files to get started'}
              </p>
            </div>
          ) : (
            filteredFiles.map((file) => (
              <div key={file.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-surface-secondary)]/50 transition-colors group">
                <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-lg bg-[var(--color-surface-secondary)] text-base">
                  {renderFileTypeIcon({ filename: file.filename, mimeType: file.type || '', size: 'md' })}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--color-text)]">{file.filename}</span>
                    {file.is_orphaned && (
                      <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 15%, transparent)', color: 'var(--color-error)' }}>
                        orphaned
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--color-text-muted)]">
                    <span>{formatFileSize(file.size)}</span>
                    <span>·</span>
                    <span className="truncate max-w-[140px]" title={file.type}>{file.type || '—'}</span>
                    <span>·</span>
                    <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>
                    {file.subdirectory && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{file.subdirectory}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleCopyUrl(file)}
                    className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tertiary)] transition-colors"
                    title="Copy URL"
                  >
                    {copiedId === file.id ? (
                      <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => !file.is_orphaned && setFileViewerModal({ isOpen: true, file })}
                    style={{ display: file.is_orphaned ? 'none' : undefined }}
                    className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-tertiary)] transition-colors"
                    title="Preview"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleteConfirmFile(file)}
                    className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-tertiary)] transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {filteredFiles.length > 0 && (
          <div className="px-5 py-2.5 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
            {filteredFiles.length} file{filteredFiles.length === 1 ? '' : 's'}{searchTerm ? ' matching' : ''}
            {' · '}{formatFileSize(filteredFiles.reduce((s, f) => s + f.size, 0))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_srgb,var(--color-shadow-lg)_50%,transparent)] p-4">
          <div className="mx-auto w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[var(--color-text)]">Delete file</h3>
                <button onClick={() => setDeleteConfirmFile(null)} className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors rounded-md">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-lg bg-[var(--color-surface-tertiary)] text-base">
                  {renderFileTypeIcon({ filename: deleteConfirmFile.filename, mimeType: deleteConfirmFile.type || '', size: 'md' })}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">{deleteConfirmFile.filename}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{formatFileSize(deleteConfirmFile.size)} · {deleteConfirmFile.type}</p>
                </div>
              </div>

              <div className="mb-5 rounded-lg p-3.5" style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--color-error) 25%, transparent)' }}>
                <p className="text-xs text-[var(--color-text)]">
                  <span className="font-medium text-[var(--color-error)]">Permanent action. </span>
                  This file will be removed from storage and cannot be recovered.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteConfirmFile(null)} className="px-4 py-2 text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-hover)] rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteFile(deleteConfirmFile)}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                  style={{ backgroundColor: 'var(--color-error)', color: 'var(--color-on-error)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete file
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}