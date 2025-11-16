import React, { useState, useRef } from 'react';
import type { MessageAttachment } from '../models/Message';
import { VideoPlayer } from './VideoPlayer';

interface AttachmentBubbleProps extends MessageAttachment {
  onClick?: () => void;
  className?: string;
}


export const AttachmentBubble: React.FC<AttachmentBubbleProps> = ({
  url,
  filename,
  type,
  size,
  onClick,
  className = ''
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename: string, type: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();

    // Audio files
    if (type?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext || '')) {
      return (
        <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      );
    }

    // Video files
    if (type?.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext || '')) {
      return (
        <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    }

    // Document files
    if (type?.startsWith('text/') ||
        ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt'].includes(ext || '') ||
        type?.includes('document') ||
        type?.includes('word') ||
        type?.includes('text')) {
      return (
        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }

    // Archive files
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext || '')) {
      return (
        <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      );
    }

    // Default file icon
    return (
      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7h5a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h5l5 5z" />
      </svg>
    );
  };

  // Image/Video attachment (large bubble style)
  if ((type?.startsWith('image/') || type?.startsWith('video/')) && !imageError) {
    const isImage = type?.startsWith('image/');
    const isVideo = type?.startsWith('video/');

    if (isImage) {
      return (
        <div
          className={`relative group cursor-pointer bg-gray-800 border border-gray-600 rounded-lg overflow-hidden hover:border-gray-500 transition-all duration-200 ${className}`}
          onClick={onClick}
        >
          {/* Loading skeleton */}
          {imageLoading && (
            <div className="absolute inset-0 bg-gray-700 animate-pulse flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-400 text-sm">Loading image...</p>
              </div>
            </div>
          )}

          <img
            src={url}
            alt={filename || 'Attachment'}
            className={`w-full h-auto max-h-96 object-contain transition-opacity duration-300 ${
              imageLoading ? 'opacity-0' : 'opacity-100'
            }`}
            onLoad={() => setImageLoading(false)}
            onError={() => {
              setImageLoading(false);
              setImageError(true);
            }}
            loading="lazy"
          />

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <svg className="w-8 h-8 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filename overlay */}
          {filename && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <p className="text-white text-sm font-medium truncate drop-shadow-lg" title={filename}>
                {filename}
              </p>
            </div>
          )}
        </div>
      );
    }

    if (isVideo) {
      return (
        <div className={`relative ${className}`} onClick={onClick}>
          <VideoPlayer
            src={url}
            filename={filename}
            onError={() => setImageError(true)}
          />
        </div>
      );
    }
  }

  // File attachment (compact bubble style with prominent download button)
  return (
    <div
      className={`flex items-center space-x-3 p-4 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-750 hover:border-gray-500 transition-colors ${className}`}
    >
      {/* File Icon */}
      <div className="flex-shrink-0">
        {getFileIcon(filename || 'file', type || '')}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="text-gray-200 text-sm font-medium truncate" title={filename}>
          {filename || 'Attachment'}
        </div>
        {size && (
          <div className="text-gray-500 text-xs">
            {formatFileSize(size)}
          </div>
        )}
      </div>

      {/* Download Button */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors inline-flex items-center space-x-1"
        onClick={onClick}
        title={`Download ${filename || 'file'}`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>Download</span>
      </a>
    </div>
  );
};

interface AttachmentGridProps {
  attachments: MessageAttachment[];
  className?: string;
}

export const AttachmentGrid: React.FC<AttachmentGridProps> = ({
  attachments,
  className = ''
}) => {
  if (!attachments || attachments.length === 0) return null;

  const getGridClasses = () => {
    const count = attachments.length;

    if (count === 1) {
      // Single attachment - large
      return 'grid-cols-1 max-w-md';
    } else if (count === 2) {
      // Two attachments - side by side
      return 'grid-cols-2 gap-2 max-w-lg';
    } else if (count === 3) {
      // Three attachments - 1 large, 2 small below
      return 'grid-cols-2 gap-2 max-w-lg';
    } else {
      // Four or more - grid
      return 'grid-cols-2 gap-2 max-w-2xl';
    }
  };

  const getItemClasses = (index: number, total: number) => {
    if (total === 1) {
      // Single item - full size
      return 'col-span-1';
    } else if (total === 3 && index === 0) {
      // First of three - spans full width
      return 'col-span-2';
    } else {
      // Other items - normal size
      return '';
    }
  };

  return (
    <div className={`mt-3 grid ${getGridClasses()} ${className}`}>
      {attachments.map((attachment, index) => (
        <AttachmentBubble
          key={index}
          {...attachment}
          className={getItemClasses(index, attachments.length)}
        />
      ))}
    </div>
  );
};
