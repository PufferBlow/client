import React, { useState, useEffect } from 'react';

import { Card } from '../Card';
import { Button } from '../Button';
import { LoadingState } from '../LoadingState';
import { ErrorState } from '../ErrorState';
import type { ShowToast } from '../Toast';

import { logger } from '../../utils/logger';

/**
 * Security setting interface
 */
export interface SecuritySetting {
  /**
   * Unique identifier for the setting
   */
  id: string;

  /**
   * Display name for the setting
   */
  name: string;

  /**
   * Description of what the setting does
   */
  description: string;

  /**
   * Whether the setting is currently enabled
   */
  enabled: boolean;

  /**
   * Category this setting belongs to
   */
  category: 'content' | 'access' | 'monitoring' | 'authentication';

  /**
   * Risk level of the setting
   */
  riskLevel: 'low' | 'medium' | 'high';

  /**
   * Whether this setting requires server restart
   */
  requiresRestart?: boolean;
}

/**
 * Props for the SecurityTab component
 */
export interface SecurityTabProps {
  /**
   * Callback for showing toast notifications
   */
  showToast: ShowToast;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * SecurityTab component - manages server security settings and configurations.
 *
 * This component provides an interface for configuring various security features
 * including content moderation, access controls, monitoring, and authentication.
 *
 * @example
 * ```tsx
 * <SecurityTab showToast={showToast} />
 * ```
 */
export const SecurityTab: React.FC<SecurityTabProps> = ({
  showToast,
  className = '',
}) => {
  const [settings, setSettings] = useState<SecuritySetting[]>([
    {
      id: 'content_moderation',
      name: 'Content Moderation',
      description: 'Automatically filter inappropriate content and messages',
      enabled: false,
      category: 'content',
      riskLevel: 'medium',
    },
    {
      id: 'spam_protection',
      name: 'Spam Protection',
      description: 'Prevent spam messages and automated abuse',
      enabled: true,
      category: 'content',
      riskLevel: 'low',
    },
    {
      id: 'ip_logging',
      name: 'IP Address Logging',
      description: 'Log IP addresses for security monitoring and abuse prevention',
      enabled: false,
      category: 'monitoring',
      riskLevel: 'high',
    },
    {
      id: 'rate_limiting',
      name: 'Rate Limiting',
      description: 'Limit the number of requests per user to prevent abuse',
      enabled: true,
      category: 'access',
      riskLevel: 'low',
    },
    {
      id: 'two_factor_auth',
      name: 'Two-Factor Authentication',
      description: 'Require 2FA for all administrator accounts',
      enabled: false,
      category: 'authentication',
      riskLevel: 'medium',
      requiresRestart: true,
    },
    {
      id: 'session_timeout',
      name: 'Session Timeout',
      description: 'Automatically log out inactive users after a period of time',
      enabled: true,
      category: 'access',
      riskLevel: 'low',
    },
    {
      id: 'password_policy',
      name: 'Strong Password Policy',
      description: 'Enforce minimum password requirements for all users',
      enabled: true,
      category: 'authentication',
      riskLevel: 'medium',
    },
    {
      id: 'audit_logging',
      name: 'Audit Logging',
      description: 'Log all administrative actions for compliance and security',
      enabled: true,
      category: 'monitoring',
      riskLevel: 'low',
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<SecuritySetting[]>([]);

  // Load settings on component mount
  useEffect(() => {
    loadSecuritySettings();
  }, []);

  // Track changes
  useEffect(() => {
    const hasAnyChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(hasAnyChanges);
  }, [settings, originalSettings]);

  const loadSecuritySettings = async () => {
    setLoading(true);
    setError(null);

    try {
      // In a real implementation, this would fetch from the API
      // For now, we'll use the default settings
      setOriginalSettings(JSON.parse(JSON.stringify(settings)));
      logger.ui.info('Security settings loaded successfully');
    } catch (err) {
      setError('Failed to load security settings');
      logger.ui.error('Failed to load security settings', { error: err });
    } finally {
      setLoading(false);
    }
  };

  const handleSettingToggle = (settingId: string) => {
    setSettings(prev => prev.map(setting =>
      setting.id === settingId
        ? { ...setting, enabled: !setting.enabled }
        : setting
    ));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setError(null);

    try {
      // In a real implementation, this would save to the API
      // For now, we'll simulate a save operation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if any settings require restart
      const requiresRestart = settings.some(setting =>
        setting.requiresRestart &&
        setting.enabled !== originalSettings.find(orig => orig.id === setting.id)?.enabled
      );

      setOriginalSettings(JSON.parse(JSON.stringify(settings)));

      if (requiresRestart) {
        showToast({
          message: 'Settings saved successfully. Server restart required for some changes.',
          tone: 'warning',
          category: 'system',
          dedupeKey: 'security:settings:restart-required',
        });
      } else {
        showToast({
          message: 'Security settings saved successfully.',
          tone: 'success',
          category: 'system',
          dedupeKey: 'security:settings:saved',
        });
      }

      logger.ui.info('Security settings saved successfully', {
        settingsCount: settings.length,
        requiresRestart
      });
    } catch (err) {
      setError('Failed to save security settings');
      showToast({
        message: 'Failed to save security settings.',
        tone: 'error',
        category: 'system',
        dedupeKey: 'security:settings:save-failed',
      });
      logger.ui.error('Failed to save security settings', { error: err });
    } finally {
      setSaving(false);
    }
  };

  const getCategoryIcon = (category: SecuritySetting['category']) => {
    switch (category) {
      case 'content':
        return '🛡️';
      case 'access':
        return '🔐';
      case 'monitoring':
        return '👁️';
      case 'authentication':
        return '🔑';
      default:
        return '⚙️';
    }
  };

  const getRiskColor = (riskLevel: SecuritySetting['riskLevel']) => {
    switch (riskLevel) {
      case 'low':
        return 'text-[var(--color-success)] bg-[color:color-mix(in_srgb,var(--color-success)_12%,transparent)] border-[color:color-mix(in_srgb,var(--color-success)_35%,transparent)]';
      case 'medium':
        return 'text-[var(--color-warning)] bg-[color:color-mix(in_srgb,var(--color-warning)_12%,transparent)] border-[color:color-mix(in_srgb,var(--color-warning)_35%,transparent)]';
      case 'high':
        return 'text-[var(--color-error)] bg-[color:color-mix(in_srgb,var(--color-error)_12%,transparent)] border-[color:color-mix(in_srgb,var(--color-error)_35%,transparent)]';
      default:
        return 'text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)] border-[var(--color-border-secondary)]';
    }
  };

  const groupedSettings = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<SecuritySetting['category'], SecuritySetting[]>);

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <LoadingState message="Loading security settings..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <ErrorState
          title="Failed to load security settings"
          message={error}
          showRetry
          onRetry={loadSecuritySettings}
        />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-[var(--color-text)]">Security Configuration</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Review security policies for your instance. This surface is currently a control-panel preview until dedicated backend security endpoints land.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {hasChanges && (
            <span className="text-sm font-medium text-[var(--color-warning)]">
              Unsaved changes
            </span>
          )}
          <Button
            onClick={handleSaveSettings}
            disabled={!hasChanges || saving}
            variant="primary"
            size="sm"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Card className="border-[color:color-mix(in_srgb,var(--color-warning)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--color-warning)_12%,transparent)] p-4">
        <div className="flex items-start space-x-3">
          <div className="text-xl text-[var(--color-warning)]">⚠️</div>
          <div>
            <h3 className="font-medium text-[var(--color-warning)]">Preview Surface</h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              These security toggles are not backed by dedicated instance security routes yet. Use the main Settings and Logs sections for live instance configuration and audit visibility.
            </p>
          </div>
        </div>
      </Card>

      {/* Security Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[var(--color-text-secondary)]">Active Protections</div>
              <div className="text-2xl font-bold text-[var(--color-success)]">
                {settings.filter(s => s.enabled).length}
              </div>
            </div>
            <div className="text-2xl">🛡️</div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[var(--color-text-secondary)]">High Risk Settings</div>
              <div className="text-2xl font-bold text-[var(--color-error)]">
                {settings.filter(s => s.riskLevel === 'high' && s.enabled).length}
              </div>
            </div>
            <div className="text-2xl">⚠️</div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[var(--color-text-secondary)]">Requires Restart</div>
              <div className="text-2xl font-bold text-[var(--color-warning)]">
                {settings.filter(s => s.requiresRestart).length}
              </div>
            </div>
            <div className="text-2xl">🔄</div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[var(--color-text-secondary)]">Security Score</div>
              <div className="text-2xl font-bold text-[var(--color-info)]">
                {Math.round((settings.filter(s => s.enabled).length / settings.length) * 100)}%
              </div>
            </div>
            <div className="text-2xl">📊</div>
          </div>
        </Card>
      </div>

      {/* Settings by Category */}
      {Object.entries(groupedSettings).map(([category, categorySettings]) => (
        <Card key={category} className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="text-2xl">{getCategoryIcon(category as SecuritySetting['category'])}</div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text)] capitalize">
                {category.replace('_', ' ')} Security
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {category === 'content' && 'Control what content is allowed on your server'}
                {category === 'access' && 'Manage who can access your server and how'}
                {category === 'monitoring' && 'Track and log server activity for security'}
                {category === 'authentication' && 'Configure user authentication and verification'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {categorySettings.map((setting) => (
              <div
                key={setting.id}
                className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/70 p-4 transition-colors hover:border-[var(--color-border-secondary)] hover:bg-[var(--color-hover)]/70"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="font-medium text-[var(--color-text)]">{setting.name}</h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded border ${getRiskColor(setting.riskLevel)}`}>
                      {setting.riskLevel.toUpperCase()}
                    </span>
                    {setting.requiresRestart && (
                      <span className="rounded border border-[color:color-mix(in_srgb,var(--color-warning)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--color-warning)_12%,transparent)] px-2 py-1 text-xs font-medium text-[var(--color-warning)]">
                        RESTART REQUIRED
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">{setting.description}</p>
                </div>

                <div className="ml-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={setting.enabled}
                      onChange={() => handleSettingToggle(setting.id)}
                      className="sr-only"
                    />
                    <div className={`
                      relative inline-block w-10 h-6 rounded-full transition-colors
                      ${setting.enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-surface-tertiary)]'}
                    `}>
                      <div className={`
                        absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[var(--color-on-primary)] transition-transform
                        ${setting.enabled ? 'translate-x-4' : 'translate-x-0'}
                      `}></div>
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      {/* Security Recommendations */}
      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold text-[var(--color-text)]">Security Recommendations</h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-3 rounded-lg border border-[color:color-mix(in_srgb,var(--color-info)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--color-info)_12%,transparent)] p-4">
            <div className="text-xl text-[var(--color-info)]">💡</div>
            <div>
              <h4 className="mb-1 font-medium text-[var(--color-info)]">Enable Content Moderation</h4>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Consider enabling content moderation to automatically filter inappropriate messages and maintain a safe community.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 rounded-lg border border-[color:color-mix(in_srgb,var(--color-warning)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--color-warning)_12%,transparent)] p-4">
            <div className="text-xl text-[var(--color-warning)]">⚠️</div>
            <div>
              <h4 className="mb-1 font-medium text-[var(--color-warning)]">IP Logging Privacy</h4>
              <p className="text-sm text-[var(--color-text-secondary)]">
                IP logging can help prevent abuse but may impact user privacy. Consider your local privacy laws before enabling.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 rounded-lg border border-[color:color-mix(in_srgb,var(--color-success)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--color-success)_12%,transparent)] p-4">
            <div className="text-xl text-[var(--color-success)]">✅</div>
            <div>
              <h4 className="mb-1 font-medium text-[var(--color-success)]">Regular Security Audits</h4>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Regularly review your security settings and audit logs to ensure your server remains secure.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default SecurityTab;
