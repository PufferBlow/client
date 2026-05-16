/**
 * SettingsTab — runtime configuration editor. Surfaces every field returned
 * by GET /system/config and writes back via PATCH /system/config.
 */
import React, { useEffect, useState } from "react";
import { getAuthTokenFromCookies } from "../../../services/user";
import {
  getServerInfo,
  updateServerInfo,
  uploadServerAvatar,
  uploadServerBanner,
  getServerConfig,
  updateServerConfig,
  type RuntimeConfig,
} from "../../../services/system";
import { convertToFullStorageUrl } from "../../../services/apiClient";
import { logger } from "../../../utils/logger";
import type { ShowToast } from "../../Toast";
import { Notice } from "../../ui/Notice";
import {
  controlPanelSectionClass,
  controlPanelInputClass,
  controlPanelTextAreaClass,
  controlPanelSelectClass,
  controlPanelSegmentClass,
} from "../shared";

export function SettingsTab({
  showToast
}: {
  showToast: ShowToast;
}) {
  const voiceQualityRuntimeKeys = new Set([
    'RTC_DEFAULT_QUALITY_PROFILE',
    'RTC_AUDIO_SAMPLE_RATE_HZ',
    'RTC_AUDIO_CHANNELS',
    'RTC_AUDIO_STEREO_ENABLED',
    'RTC_AUDIO_DTX_ENABLED',
    'RTC_AUDIO_FEC_ENABLED',
    'RTC_AUDIO_BITRATE_LOW_KBPS',
    'RTC_AUDIO_BITRATE_BALANCED_KBPS',
    'RTC_AUDIO_BITRATE_HIGH_KBPS',
    'RTC_VIDEO_BITRATE_LOW_KBPS',
    'RTC_VIDEO_BITRATE_BALANCED_KBPS',
    'RTC_VIDEO_BITRATE_HIGH_KBPS',
    'RTC_VIDEO_WIDTH_LOW',
    'RTC_VIDEO_WIDTH_BALANCED',
    'RTC_VIDEO_WIDTH_HIGH',
    'RTC_VIDEO_HEIGHT_LOW',
    'RTC_VIDEO_HEIGHT_BALANCED',
    'RTC_VIDEO_HEIGHT_HIGH',
    'RTC_VIDEO_FPS_LOW',
    'RTC_VIDEO_FPS_BALANCED',
    'RTC_VIDEO_FPS_HIGH',
  ]);
  const serializeExtensions = (extensions?: string[] | null) =>
    extensions && extensions.length > 0 ? extensions.join(', ') : undefined;

  const parseExtensions = (value?: string) =>
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean);
  const getRuntimeNumber = (key: string, fallback: number) =>
    typeof runtimeConfig[key] === 'number' ? (runtimeConfig[key] as number) : fallback;
  const getRuntimeBoolean = (key: string, fallback: boolean) =>
    typeof runtimeConfig[key] === 'boolean' ? (runtimeConfig[key] as boolean) : fallback;
  const getRuntimeString = (key: string, fallback: string) =>
    typeof runtimeConfig[key] === 'string' ? (runtimeConfig[key] as string) : fallback;

  const [serverInfo, setServerInfo] = useState<{
    server_name: string;
    server_description: string;
    version: string;
    max_users: number | null;
    is_private: boolean;
    creation_date: string | null;
    max_message_length?: number;
    max_image_size?: number;
    max_video_size?: number;
    max_sticker_size?: number;
    max_gif_size?: number;
    max_audio_size?: number;
    max_file_size?: number;
    max_total_attachment_size?: number;
    allowed_image_types?: string;
    allowed_video_types?: string;
    allowed_file_types?: string;
    allowed_sticker_types?: string;
    allowed_gif_types?: string;
    allowed_audio_types?: string;
    avatar_url?: string | null;
    banner_url?: string | null;
  }>({
    server_name: 'Loading...',
    server_description: 'Loading...',
    version: 'Loading...',
    max_users: null,
    is_private: false,
    creation_date: null,
    max_message_length: undefined,
    max_image_size: undefined,
    max_video_size: undefined,
    max_sticker_size: undefined,
    max_gif_size: undefined,
    max_audio_size: undefined,
    max_file_size: undefined,
    max_total_attachment_size: undefined,
    allowed_image_types: undefined,
    allowed_video_types: undefined,
    allowed_file_types: undefined,
    allowed_sticker_types: undefined,
    allowed_gif_types: undefined,
    allowed_audio_types: undefined,
    avatar_url: null,
    banner_url: null,
  });
  const [originalServerInfo, setOriginalServerInfo] = useState<typeof serverInfo | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>({});
  const [originalRuntimeConfig, setOriginalRuntimeConfig] = useState<RuntimeConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSettingsSubTab, setActiveSettingsSubTab] = useState<'general' | 'appearance' | 'files' | 'runtime'>('general');

  // Load server info and runtime config on component mount
  useEffect(() => {
    const loadServerInfo = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getServerInfo();
        if (response.success && response.data) {
          const info = response.data.server_info || {};
          setServerInfo({
            server_name: info.server_name || 'Loading...',
            server_description: info.server_description || 'Loading...',
            version: info.version || 'Loading...',
            max_users: info.max_users || null,
            is_private: info.is_private || false,
            creation_date: info.creation_date || null,
            max_message_length: info.max_message_length,
            max_image_size: info.max_image_size,
            max_video_size: info.max_video_size,
            max_sticker_size: info.max_sticker_size,
            max_gif_size: info.max_gif_size,
            max_audio_size: info.max_audio_size,
            max_file_size: info.max_file_size,
            max_total_attachment_size: info.max_total_attachment_size,
            allowed_image_types: serializeExtensions(info.allowed_image_types),
            allowed_video_types: serializeExtensions(info.allowed_video_types),
            allowed_file_types: serializeExtensions(info.allowed_file_types),
            allowed_sticker_types: serializeExtensions(info.allowed_sticker_types),
            allowed_gif_types: serializeExtensions(info.allowed_gif_types),
            allowed_audio_types: serializeExtensions(info.allowed_audio_types),
            avatar_url: info.avatar_url || null,
            banner_url: info.banner_url || null,
          });
          setOriginalServerInfo(JSON.parse(JSON.stringify({
            server_name: info.server_name || 'Loading...',
            server_description: info.server_description || 'Loading...',
            version: info.version || 'Loading...',
            max_users: info.max_users || null,
            is_private: info.is_private || false,
            creation_date: info.creation_date || null,
            max_message_length: info.max_message_length,
            max_image_size: info.max_image_size,
            max_video_size: info.max_video_size,
            max_sticker_size: info.max_sticker_size,
            max_gif_size: info.max_gif_size,
            max_audio_size: info.max_audio_size,
            max_file_size: info.max_file_size,
            max_total_attachment_size: info.max_total_attachment_size,
            allowed_image_types: serializeExtensions(info.allowed_image_types),
            allowed_video_types: serializeExtensions(info.allowed_video_types),
            allowed_file_types: serializeExtensions(info.allowed_file_types),
            allowed_sticker_types: serializeExtensions(info.allowed_sticker_types),
            allowed_gif_types: serializeExtensions(info.allowed_gif_types),
            allowed_audio_types: serializeExtensions(info.allowed_audio_types),
            avatar_url: info.avatar_url || null,
            banner_url: info.banner_url || null
          }))); // Deep copy
        } else {
          setError('Failed to load server information');
        }

        // Load runtime configuration
        const authToken = getAuthTokenFromCookies() || '';
        if (authToken) {
          const configResponse = await getServerConfig(authToken, false);
          if (configResponse.success && configResponse.data) {
            const config = configResponse.data.runtime_config || {};
            setRuntimeConfig(config);
            setOriginalRuntimeConfig(JSON.parse(JSON.stringify(config))); // Deep copy
          }
        }
      } catch (err) {
        setError('Failed to load server information');
        logger.api.error('Failed to load server info', err);
      } finally {
        setLoading(false);
      }
    };

    loadServerInfo();
  }, []);

  // Handle avatar upload immediately when selected
  const handleAvatarUpload = async (file: File) => {
    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      setError('Authentication token not found');
      return;
    }

    try {
      const response = await uploadServerAvatar(authToken, file);

      if (response.success && response.data) {
        const fullAvatarUrl = convertToFullStorageUrl(response.data.avatar_url);
        setServerInfo(prev => ({ ...prev, avatar_url: fullAvatarUrl }));
        setOriginalServerInfo(prev => prev ? { ...prev, avatar_url: fullAvatarUrl } : null);
        logger.ui.info('Server avatar updated successfully', response.data);
      } else {
        setError('Failed to upload avatar');
        logger.ui.error('Failed to upload avatar', response.error);
      }
    } catch (err) {
      setError('Failed to upload avatar');
      logger.api.error('Failed to upload avatar', err);
    }
  };

  // Handle banner upload immediately when selected
  const handleBannerUpload = async (file: File) => {
    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      setError('Authentication token not found');
      return;
    }

    try {
      const response = await uploadServerBanner(authToken, file);

      if (response.success && response.data) {
        const fullBannerUrl = convertToFullStorageUrl(response.data.banner_url);
        setServerInfo(prev => ({ ...prev, banner_url: fullBannerUrl }));
        setOriginalServerInfo(prev => prev ? { ...prev, banner_url: fullBannerUrl } : null);
        logger.ui.info('Server banner updated successfully', response.data);
      } else {
        setError('Failed to upload banner');
        logger.ui.error('Failed to upload banner', response.error);
      }
    } catch (err) {
      setError('Failed to upload banner');
      logger.api.error('Failed to upload banner', err);
    }
  };

  const handleSave = async () => {
    // Form validation
    if (!serverInfo.server_name?.trim()) {
      setError('Server name cannot be empty');
      return;
    }

    if (serverInfo.server_name.length > 100) {
      setError('Server name cannot exceed 100 characters');
      return;
    }

    const authToken = getAuthTokenFromCookies() || '';
    if (!authToken) {
      setError('Authentication token not found');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Save server info changes
      const changes: any = {};
      if (serverInfo.server_name !== originalServerInfo?.server_name) {
        changes.server_name = serverInfo.server_name.trim();
      }
      if (serverInfo.server_description !== originalServerInfo?.server_description) {
        changes.server_description = (serverInfo.server_description || '').trim();
      }
      if (serverInfo.is_private !== originalServerInfo?.is_private) {
        changes.is_private = serverInfo.is_private;
      }
      if (serverInfo.max_message_length !== undefined && serverInfo.max_message_length !== originalServerInfo?.max_message_length) {
        changes.max_message_length = serverInfo.max_message_length;
      }
      if (serverInfo.max_image_size !== undefined && serverInfo.max_image_size !== originalServerInfo?.max_image_size) {
        changes.max_image_size = serverInfo.max_image_size;
      }
      if (serverInfo.max_video_size !== undefined && serverInfo.max_video_size !== originalServerInfo?.max_video_size) {
        changes.max_video_size = serverInfo.max_video_size;
      }
      if (serverInfo.max_sticker_size !== undefined && serverInfo.max_sticker_size !== originalServerInfo?.max_sticker_size) {
        changes.max_sticker_size = serverInfo.max_sticker_size;
      }
      if (serverInfo.max_gif_size !== undefined && serverInfo.max_gif_size !== originalServerInfo?.max_gif_size) {
        changes.max_gif_size = serverInfo.max_gif_size;
      }
      if (serverInfo.allowed_image_types !== originalServerInfo?.allowed_image_types) {
        changes.allowed_image_types = parseExtensions(serverInfo.allowed_image_types);
      }
      if (serverInfo.allowed_video_types !== originalServerInfo?.allowed_video_types) {
        changes.allowed_video_types = parseExtensions(serverInfo.allowed_video_types);
      }
      if (serverInfo.allowed_file_types !== originalServerInfo?.allowed_file_types) {
        changes.allowed_file_types = parseExtensions(serverInfo.allowed_file_types);
      }
      if (serverInfo.allowed_sticker_types !== originalServerInfo?.allowed_sticker_types) {
        changes.allowed_sticker_types = parseExtensions(serverInfo.allowed_sticker_types);
      }
      if (serverInfo.allowed_gif_types !== originalServerInfo?.allowed_gif_types) {
        changes.allowed_gif_types = parseExtensions(serverInfo.allowed_gif_types);
      }

      // Save runtime config changes
      const runtimeConfigChanges: Record<string, unknown> = {};
      for (const key in runtimeConfig) {
        if (runtimeConfig[key] !== originalRuntimeConfig[key]) {
          runtimeConfigChanges[key] = runtimeConfig[key];
        }
      }

      if (Object.keys(changes).length === 0 && Object.keys(runtimeConfigChanges).length === 0) {
        setError('No changes to save');
        setSaving(false);
        return;
      }

      // Update server info if there are changes
      if (Object.keys(changes).length > 0) {
        const response = await updateServerInfo({
          auth_token: authToken,
          ...changes
        });

        if (!response.success) {
          setError(response.error || 'Failed to update server settings');
          return;
        }
        setOriginalServerInfo(JSON.parse(JSON.stringify(serverInfo)));
      }

      // Update runtime config if there are changes
      if (Object.keys(runtimeConfigChanges).length > 0) {
        const response = await updateServerConfig(authToken, runtimeConfigChanges);

        if (!response.success) {
          setError(response.error || 'Failed to update runtime configuration');
          return;
        }
        setOriginalRuntimeConfig(JSON.parse(JSON.stringify(runtimeConfig)));
        
        if (response.data?.restart_required) {
          showToast({
            message: 'Server restart required for some settings to take effect.',
            tone: 'warning',
            category: 'system',
          });
        }
      }

      showToast({
        message: 'Settings updated successfully.',
        tone: 'success',
        category: 'system',
        dedupeKey: 'settings-tab:settings-updated',
      });
      logger.ui.info('Settings updated successfully');
    } catch (err) {
      setError('Failed to save settings');
      logger.api.error('Failed to save settings', err);
      showToast({
        message: 'Failed to save settings.',
        tone: 'error',
        category: 'system',
      });
    } finally {
      setSaving(false);
    }
  };

  // Helper function to convert data URL to File object
  const dataURLToFile = (dataURL: string, filename: string): File => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Avatar and banner are uploaded immediately when selected, so they shouldn't count as "unsaved changes"
  const hasChanges = (originalServerInfo &&
    (serverInfo.server_name !== originalServerInfo.server_name ||
      serverInfo.server_description !== originalServerInfo.server_description ||
      serverInfo.is_private !== originalServerInfo.is_private ||
      serverInfo.max_users !== originalServerInfo.max_users ||
      serverInfo.max_message_length !== originalServerInfo.max_message_length ||
      serverInfo.max_image_size !== originalServerInfo.max_image_size ||
      serverInfo.max_video_size !== originalServerInfo.max_video_size ||
      serverInfo.max_sticker_size !== originalServerInfo.max_sticker_size ||
      serverInfo.max_gif_size !== originalServerInfo.max_gif_size ||
      serverInfo.allowed_image_types !== originalServerInfo.allowed_image_types ||
      serverInfo.allowed_video_types !== originalServerInfo.allowed_video_types ||
      serverInfo.allowed_file_types !== originalServerInfo.allowed_file_types ||
      serverInfo.allowed_sticker_types !== originalServerInfo.allowed_sticker_types ||
      serverInfo.allowed_gif_types !== originalServerInfo.allowed_gif_types)) ||
    JSON.stringify(runtimeConfig) !== JSON.stringify(originalRuntimeConfig);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className={controlPanelSectionClass}>
          <div className="animate-pulse space-y-6">
            <div className="h-6 bg-[var(--color-surface-tertiary)] rounded w-48"></div>
            <div className="space-y-4">
              <div className="h-16 bg-[var(--color-surface-tertiary)] rounded"></div>
              <div className="h-24 bg-[var(--color-surface-tertiary)] rounded"></div>
              <div className="h-12 bg-[var(--color-surface-tertiary)] rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={controlPanelSectionClass}>
        <h2 className="mb-6 text-lg font-medium text-[var(--color-text)]">Server Settings</h2>

        {error && (
          <div className="mb-4">
            <Notice tone="error" message={error} />
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button className={controlPanelSegmentClass(activeSettingsSubTab === 'general')} onClick={() => setActiveSettingsSubTab('general')}>General</button>
            <button className={controlPanelSegmentClass(activeSettingsSubTab === 'appearance')} onClick={() => setActiveSettingsSubTab('appearance')}>Appearance</button>
            <button className={controlPanelSegmentClass(activeSettingsSubTab === 'files')} onClick={() => setActiveSettingsSubTab('files')}>File Uploads</button>
            <button className={controlPanelSegmentClass(activeSettingsSubTab === 'runtime')} onClick={() => setActiveSettingsSubTab('runtime')}>Runtime</button>
          </div>
          {activeSettingsSubTab === 'general' && (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-[var(--color-text)]">Basic Information</h3>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Server Name
              </label>
              <input
                type="text"
                value={serverInfo.server_name}
                onChange={(e) => setServerInfo({ ...serverInfo, server_name: e.target.value })}
                className={controlPanelInputClass}
                disabled={saving}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Description
              </label>
              <textarea
                value={serverInfo.server_description}
                onChange={(e) => setServerInfo({ ...serverInfo, server_description: e.target.value })}
                rows={3}
                className={controlPanelTextAreaClass}
                disabled={saving}
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPrivate"
                checked={serverInfo.is_private}
                onChange={(e) => setServerInfo({ ...serverInfo, is_private: e.target.checked })}
                className="mr-3"
                disabled={saving}
              />
              <label htmlFor="isPrivate" className="text-sm font-medium text-[var(--color-text)]">
                Make server private (invite only)
              </label>
            </div>



            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Maximum Message Length
              </label>
              <input
                type="number"
                value={serverInfo.max_message_length ?? ''}
                onChange={(e) => setServerInfo({ ...serverInfo, max_message_length: e.target.value ? parseInt(e.target.value) : undefined })}
                min="100"
                max="10000"
                placeholder="Default (4000)"
                className={controlPanelInputClass}
                disabled={saving}
              />
            </div>
          </div>
          )}
          {activeSettingsSubTab === 'appearance' && (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-[var(--color-text)]">Server Appearance</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Server Avatar */}
              <div className="space-y-3">
                <h4 className="font-medium text-[var(--color-text)]">Server Avatar</h4>
                <div className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    {serverInfo.avatar_url ? (
                      <>
                        <img
                          src={convertToFullStorageUrl(serverInfo.avatar_url)}
                          alt="Server Avatar"
                          className="h-20 w-20 rounded-2xl border-2 border-[var(--color-border)] object-cover"
                        />
                        <button
                          onClick={() => setServerInfo({ ...serverInfo, avatar_url: null })}
                          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-error)] text-[var(--color-on-error)] text-xs font-bold transition-opacity hover:opacity-90"
                          disabled={saving}
                          title="Remove avatar"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-primary)] text-2xl font-bold text-[var(--color-on-primary)]">
                        {serverInfo.server_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-sm text-[var(--color-text-secondary)]">Supports PNG, JPEG, GIF, WebP. Recommended 128×128 px.</p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setServerInfo({ ...serverInfo, avatar_url: ev.target?.result as string });
                          reader.readAsDataURL(file);
                          await handleAvatarUpload(file);
                        }
                      }}
                      disabled={saving}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload Avatar
                    </label>
                  </div>
                </div>
              </div>

              {/* Server Banner */}
              <div className="space-y-3">
                <h4 className="font-medium text-[var(--color-text)]">Server Banner</h4>

                {/* Preview — always shown */}
                <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)]">
                  {serverInfo.banner_url ? (
                    <>
                      <img
                        src={convertToFullStorageUrl(serverInfo.banner_url)}
                        alt="Server Banner"
                        className="h-28 w-full object-cover"
                      />
                      <button
                        onClick={() => setServerInfo({ ...serverInfo, banner_url: null })}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white text-sm font-bold backdrop-blur-sm transition-opacity hover:bg-black/80"
                        disabled={saving}
                        title="Remove banner"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <div className="flex h-28 w-full items-center justify-center bg-gradient-to-br from-[var(--color-surface-secondary)] to-[var(--color-surface-tertiary)]">
                      <span className="text-xs text-[var(--color-text-muted)]">No banner set — gradient color shown in sidebar</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setServerInfo({ ...serverInfo, banner_url: ev.target?.result as string });
                        reader.readAsDataURL(file);
                        await handleBannerUpload(file);
                      }
                    }}
                    disabled={saving}
                    className="hidden"
                    id="banner-upload"
                  />
                  <label
                    htmlFor="banner-upload"
                    className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Upload Banner
                  </label>
                  <p className="text-sm text-[var(--color-text-secondary)]">Recommended 1200×300 px. Supports GIF.</p>
                </div>
              </div>
            </div>

            {/* File Format Info */}
            <div className="bg-[var(--color-surface-secondary)]/50 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-[var(--color-primary)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-[var(--color-text)]">
                  <strong>GIF Support:</strong> Both static and animated GIF files are supported for avatar and banner images.
                  Recommended sizes: Avatar (128x128px), Banner (1200x300px).
                  <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    Supported formats: PNG, JPEG/JPG, GIF, WebP
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
          {activeSettingsSubTab === 'files' && (
          <div className="space-y-4">
            <h3 className="text-md font-medium text-[var(--color-text)]">File Upload Restrictions</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Max Image Size (MB)
                </label>
                <input
                  type="number"
                  min="1"
                  value={serverInfo.max_image_size ?? ''}
                  onChange={(e) => setServerInfo({ ...serverInfo, max_image_size: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  placeholder="5"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Max Video Size (MB)
                </label>
                <input
                  type="number"
                  min="1"
                  value={serverInfo.max_video_size ?? ''}
                  onChange={(e) => setServerInfo({ ...serverInfo, max_video_size: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  placeholder="50"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Max Sticker Size (MB)
                </label>
                <input
                  type="number"
                  min="1"
                  value={serverInfo.max_sticker_size ?? ''}
                  onChange={(e) => setServerInfo({ ...serverInfo, max_sticker_size: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  placeholder="5"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Max GIF Size (MB)
                </label>
                <input
                  type="number"
                  min="1"
                  value={serverInfo.max_gif_size ?? ''}
                  onChange={(e) => setServerInfo({ ...serverInfo, max_gif_size: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  placeholder="10"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Allowed Image Types
                </label>
                <input
                  type="text"
                  value={serverInfo.allowed_image_types || 'PNG, JPG, JPEG, GIF, WebP'}
                  onChange={(e) => setServerInfo({ ...serverInfo, allowed_image_types: e.target.value })}
                  placeholder="PNG, JPG, JPEG, GIF, WebP"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Allowed Video Types
                </label>
                <input
                  type="text"
                  value={serverInfo.allowed_video_types || 'MP4, WebM'}
                  onChange={(e) => setServerInfo({ ...serverInfo, allowed_video_types: e.target.value })}
                  placeholder="MP4, WebM"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Allowed Document Types
                </label>
                <input
                  type="text"
                  value={serverInfo.allowed_file_types || 'PDF, DOC, DOCX, TXT, ZIP'}
                  onChange={(e) => setServerInfo({ ...serverInfo, allowed_file_types: e.target.value })}
                  placeholder="PDF, DOC, DOCX, TXT, ZIP"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Allowed Sticker Types
                </label>
                <input
                  type="text"
                  value={serverInfo.allowed_sticker_types || 'PNG, GIF'}
                  onChange={(e) => setServerInfo({ ...serverInfo, allowed_sticker_types: e.target.value })}
                  placeholder="PNG, GIF"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                  Allowed GIF Types
                </label>
                <input
                  type="text"
                  value={serverInfo.allowed_gif_types || 'GIF'}
                  onChange={(e) => setServerInfo({ ...serverInfo, allowed_gif_types: e.target.value })}
                  placeholder="GIF"
                  className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/50 p-4">
              <div className="mb-3 text-sm font-medium text-[var(--color-text)]">
                Server-derived Attachment Caps
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-[var(--color-surface)] px-3 py-2">
                  <div className="text-[var(--color-text-secondary)]">Max audio size</div>
                  <div className="font-medium text-[var(--color-text)]">
                    {serverInfo.max_audio_size ?? 'Unavailable'} MB
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Types: {serverInfo.allowed_audio_types || 'n/a'}
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--color-surface)] px-3 py-2">
                  <div className="text-[var(--color-text-secondary)]">Max document size</div>
                  <div className="font-medium text-[var(--color-text)]">
                    {serverInfo.max_file_size ?? 'Unavailable'} MB
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--color-surface)] px-3 py-2">
                  <div className="text-[var(--color-text-secondary)]">Max total attachment size</div>
                  <div className="font-medium text-[var(--color-text)]">
                    {serverInfo.max_total_attachment_size ?? 'Unavailable'} MB
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs text-[var(--color-text-muted)]">
                These caps come from the active instance storage policy. They are enforced server-side and shown here so owners can see the full effective upload policy.
              </div>
            </div>
          </div>
          )}
          {activeSettingsSubTab === 'runtime' && Object.keys(runtimeConfig).length > 0 && (
            <div className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-md font-medium text-[var(--color-text)]">Voice & Streaming Quality</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  These instance defaults are used for voice sessions, and are also forwarded to media-sfu as the authoritative publishing profile.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Default Quality Profile
                    </label>
                    <select
                      value={getRuntimeString('RTC_DEFAULT_QUALITY_PROFILE', 'balanced')}
                      onChange={(e) => setRuntimeConfig({ ...runtimeConfig, RTC_DEFAULT_QUALITY_PROFILE: e.target.value })}
                      className={controlPanelSelectClass}
                      disabled={saving}
                    >
                      <option value="low">Low</option>
                      <option value="balanced">Balanced</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Audio Sample Rate (Hz)
                    </label>
                    <input
                      type="number"
                      value={getRuntimeNumber('RTC_AUDIO_SAMPLE_RATE_HZ', 48000)}
                      onChange={(e) => setRuntimeConfig({ ...runtimeConfig, RTC_AUDIO_SAMPLE_RATE_HZ: parseInt(e.target.value, 10) || 48000 })}
                      className={controlPanelInputClass}
                      disabled={saving}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Audio Channels
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="2"
                      value={getRuntimeNumber('RTC_AUDIO_CHANNELS', 1)}
                      onChange={(e) => setRuntimeConfig({ ...runtimeConfig, RTC_AUDIO_CHANNELS: parseInt(e.target.value, 10) || 1 })}
                      className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-4 py-2 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                      disabled={saving}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)]">
                      <input
                        type="checkbox"
                        checked={getRuntimeBoolean('RTC_AUDIO_STEREO_ENABLED', false)}
                        onChange={(e) => setRuntimeConfig({ ...runtimeConfig, RTC_AUDIO_STEREO_ENABLED: e.target.checked })}
                        disabled={saving}
                      />
                      Stereo
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)]">
                      <input
                        type="checkbox"
                        checked={getRuntimeBoolean('RTC_AUDIO_DTX_ENABLED', true)}
                        onChange={(e) => setRuntimeConfig({ ...runtimeConfig, RTC_AUDIO_DTX_ENABLED: e.target.checked })}
                        disabled={saving}
                      />
                      DTX
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)]">
                      <input
                        type="checkbox"
                        checked={getRuntimeBoolean('RTC_AUDIO_FEC_ENABLED', true)}
                        onChange={(e) => setRuntimeConfig({ ...runtimeConfig, RTC_AUDIO_FEC_ENABLED: e.target.checked })}
                        disabled={saving}
                      />
                      FEC
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['LOW', 'BALANCED', 'HIGH'] as const).map((profile) => (
                    <div key={profile} className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4">
                      <div className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]">
                        {profile.toLowerCase()}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                          Audio bitrate (kbps)
                        </label>
                        <input
                          type="number"
                          value={getRuntimeNumber(`RTC_AUDIO_BITRATE_${profile}_KBPS`, profile === 'LOW' ? 24 : profile === 'BALANCED' ? 48 : 64)}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [`RTC_AUDIO_BITRATE_${profile}_KBPS`]: parseInt(e.target.value, 10) || 0 })}
                          className={controlPanelInputClass}
                          disabled={saving}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                          Video bitrate (kbps)
                        </label>
                        <input
                          type="number"
                          value={getRuntimeNumber(`RTC_VIDEO_BITRATE_${profile}_KBPS`, profile === 'LOW' ? 800 : profile === 'BALANCED' ? 1500 : 2500)}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [`RTC_VIDEO_BITRATE_${profile}_KBPS`]: parseInt(e.target.value, 10) || 0 })}
                          className={controlPanelInputClass}
                          disabled={saving}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          value={getRuntimeNumber(`RTC_VIDEO_WIDTH_${profile}`, profile === 'LOW' ? 640 : profile === 'BALANCED' ? 1280 : 1920)}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [`RTC_VIDEO_WIDTH_${profile}`]: parseInt(e.target.value, 10) || 0 })}
                          className={controlPanelInputClass}
                          disabled={saving}
                          aria-label={`${profile.toLowerCase()} video width`}
                        />
                        <input
                          type="number"
                          value={getRuntimeNumber(`RTC_VIDEO_HEIGHT_${profile}`, profile === 'LOW' ? 360 : profile === 'BALANCED' ? 720 : 1080)}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [`RTC_VIDEO_HEIGHT_${profile}`]: parseInt(e.target.value, 10) || 0 })}
                          className={controlPanelInputClass}
                          disabled={saving}
                          aria-label={`${profile.toLowerCase()} video height`}
                        />
                        <input
                          type="number"
                          value={getRuntimeNumber(`RTC_VIDEO_FPS_${profile}`, profile === 'LOW' ? 15 : profile === 'BALANCED' ? 30 : 60)}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [`RTC_VIDEO_FPS_${profile}`]: parseInt(e.target.value, 10) || 0 })}
                          className={controlPanelInputClass}
                          disabled={saving}
                          aria-label={`${profile.toLowerCase()} video fps`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <h3 className="text-md font-medium text-[var(--color-text)]">Runtime Configuration</h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Advanced server configuration. Changes to some settings may require a server restart to take effect.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(runtimeConfig)
                  .filter(([key]) => !key.includes('SECRET') && !key.includes('PASSWORD') && !voiceQualityRuntimeKeys.has(key))
                  .map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                        {key.replace(/_/g, ' ')}
                      </label>
                      {typeof value === 'boolean' ? (
                        <input
                          type="checkbox"
                          checked={value as boolean}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [key]: e.target.checked })}
                          className="w-4 h-4"
                          disabled={saving}
                        />
                      ) : typeof value === 'number' ? (
                        <input
                          type="number"
                          value={value as number}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [key]: parseInt(e.target.value) || 0 })}
                          className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                          disabled={saving}
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(value || '')}
                          onChange={(e) => setRuntimeConfig({ ...runtimeConfig, [key]: e.target.value })}
                          className="w-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)]"
                          disabled={saving}
                        />
                      )}
                    </div>
                  ))}
              </div>

              <div className="bg-[var(--color-surface-secondary)]/50 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <svg className="w-5 h-5 text-[var(--color-primary)] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-[var(--color-text)]">
                    <strong>Note:</strong> Sensitive configuration keys (containing 'SECRET' or 'PASSWORD') are not displayed here for security reasons.
                    Modify these through environment variables or config files on the server.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-[var(--color-border)]">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-[var(--color-surface-tertiary)] disabled:cursor-not-allowed text-[var(--color-on-primary)] px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
            >
              {saving && (
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
            {hasChanges && !saving && (
              <span className="ml-3 text-sm text-[var(--color-warning)]">
                You have unsaved changes
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}