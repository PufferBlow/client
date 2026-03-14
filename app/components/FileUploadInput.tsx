import React, { useRef, useState } from 'react';
import { useToast } from '../components/Toast';

interface FileUploadInputProps {
  label: string;
  accept?: string;
  maxSize?: number; // in bytes
  onFileSelected: (file: File | null) => void;
  onUrlChange: (url: string) => void;
  placeholder?: string;
  currentFile?: string;
  className?: string;
}

export function FileUploadInput({
  label,
  accept = "image/*",
  maxSize = 5 * 1024 * 1024, // 5MB default
  onFileSelected,
  onUrlChange,
  placeholder = "Enter image URL...",
  currentFile,
  className = ""
}: FileUploadInputProps) {
  const showToast = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [activeTab, setActiveTab] = useState<'file' | 'url'>('file');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > maxSize) {
        showToast(`File size must be less than ${Math.floor(maxSize / (1024 * 1024))}MB`, 'error');
        return;
      }
      onFileSelected(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > maxSize) {
        showToast(`File size must be less than ${Math.floor(maxSize / (1024 * 1024))}MB`, 'error');
        return;
      }
      if (file.type.startsWith('image/')) {
        onFileSelected(file);
      } else {
        showToast('Please select an image file', 'error');
      }
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onUrlChange(urlInput.trim());
      onFileSelected(null); // Clear file selection when URL is used
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
        {label}
      </label>

      {/* Tab selector */}
      <div className="flex space-x-1 bg-[var(--color-surface-secondary)] rounded-lg p-1">
        <button
          type="button"
          onClick={() => setActiveTab('file')}
          className={`flex-1 text-sm font-medium px-3 py-2 rounded-md transition-colors ${
            activeTab === 'file'
              ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`flex-1 text-sm font-medium px-3 py-2 rounded-md transition-colors ${
            activeTab === 'url'
              ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
          }`}
        >
          Use URL
        </button>
      </div>

      {/* File upload tab */}
      {activeTab === 'file' && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
              : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col items-center space-y-2">
            <svg className="w-8 h-8 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div>
              <p className="text-sm text-[var(--color-text)]">
                <span className="font-medium">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                PNG, JPG, GIF up to {Math.floor(maxSize / (1024 * 1024))}MB
              </p>
            </div>
          </div>
        </div>
      )}

      {/* URL input tab */}
      {activeTab === 'url' && (
        <div className="space-y-3">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={placeholder}
            className="block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200"
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            disabled={!urlInput.trim()}
            className="inline-flex justify-center rounded-md border border-transparent bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-on-primary)] shadow-sm transition-colors hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply URL
          </button>
        </div>
      )}

      {/* Current image preview */}
      {currentFile && (
        <div className="flex items-center space-x-3 p-3 bg-[var(--color-surface-secondary)] rounded-lg">
          <div className="w-12 h-12 rounded overflow-hidden">
            <img
              src={currentFile}
              alt="Current"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <p className="text-sm text-[var(--color-text)] font-medium">Current {label.toLowerCase()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
