/**
 * BlockedIPsTab — admin view for adding/removing IPs from the deny list.
 * The rate-limit middleware reads from the same table and rejects requests
 * before they hit the auth layer.
 */
import { useEffect, useState } from "react";
import { getAuthTokenFromCookies } from "../../../services/user";
import { listBlockedIPs, blockIP, unblockIP } from "../../../services/apiClient";
import type { ShowToast } from "../../Toast";
import { ConfirmDialog } from "../../ui/ConfirmDialog";

export function BlockedIPsTab({
  showToast
}: {
  showToast: ShowToast;
}) {
  const [blockedIPs, setBlockedIPs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newIP, setNewIP] = useState('');
  const [newReason, setNewReason] = useState('');
  const [isAddingIP, setIsAddingIP] = useState(false);
  const [deleteConfirmIP, setDeleteConfirmIP] = useState<any>(null);

  // Load blocked IPs on component mount
  useEffect(() => {
    loadBlockedIPs();
  }, []);

  const loadBlockedIPs = async () => {
    setLoading(true);
    setError(null);

    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        setError('Authentication token not found');
        setLoading(false);
        return;
      }

      const response = await listBlockedIPs(authToken);
      if (response.success && response.data) {
        setBlockedIPs(response.data.blocked_ips || []);
      } else {
        setError(response.error || 'Failed to load blocked IPs');
        setBlockedIPs([]);
      }
    } catch (err) {
      setError('Failed to load blocked IPs');
      setBlockedIPs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockIP = async () => {
    if (!newIP.trim() || !newReason.trim()) {
      showToast({
        message: 'Please provide both IP address and reason.',
        tone: 'error',
        category: 'validation',
      });
      return;
    }

    // Basic IP validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (!ipRegex.test(newIP.trim())) {
      showToast({
        message: 'Please provide a valid IP address.',
        tone: 'error',
        category: 'validation',
      });
      return;
    }

    setIsAddingIP(true);

    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        showToast({
          message: 'Authentication token not found.',
          tone: 'error',
          category: 'system',
        });
        return;
      }

      const response = await blockIP(authToken, newIP.trim(), newReason.trim());
      if (response.success) {
        showToast({
          message: `IP ${newIP} has been blocked successfully.`,
          tone: 'success',
          category: 'destructive',
        });
        setNewIP('');
        setNewReason('');
        await loadBlockedIPs(); // Refresh the list
      } else {
        showToast({
          message: response.error || 'Failed to block IP.',
          tone: 'error',
          category: 'system',
        });
      }
    } catch (err) {
      showToast({
        message: 'Failed to block IP.',
        tone: 'error',
        category: 'system',
      });
    } finally {
      setIsAddingIP(false);
    }
  };

  const handleUnblockIP = async (ip: string) => {
    try {
      const authToken = getAuthTokenFromCookies() || '';
      if (!authToken) {
        showToast({
          message: 'Authentication token not found.',
          tone: 'error',
          category: 'system',
        });
        return;
      }

      const response = await unblockIP(authToken, ip);
      if (response.success) {
        showToast({
          message: `IP ${ip} has been unblocked successfully.`,
          tone: 'success',
          category: 'destructive',
        });
        await loadBlockedIPs(); // Refresh the list
        setDeleteConfirmIP(null);
      } else {
        showToast({
          message: response.error || 'Failed to unblock IP.',
          tone: 'error',
          category: 'system',
        });
      }
    } catch (err) {
      showToast({
        message: 'Failed to unblock IP.',
        tone: 'error',
        category: 'system',
      });
    }
  };

  const filteredIPs = blockedIPs.filter(ip =>
    searchTerm === '' ||
    ip.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ip.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-[var(--color-surface-tertiary)] rounded w-48"></div>
            <div className="h-32 bg-[var(--color-surface-tertiary)] rounded"></div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-[var(--color-surface-tertiary)] rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
          <div className="py-8 text-center text-[var(--color-error)]">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2">Error Loading Blocked IPs</h3>
            <p className="text-sm mb-4">{error}</p>
            <button
              onClick={loadBlockedIPs}
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Blocked IPs Management Header */}
      <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-medium text-[var(--color-text)]">Blocked IP Addresses</h2>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">Manage IP addresses that are blocked from accessing the server</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[var(--color-text)]">{blockedIPs.length}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">Total Blocked</div>
          </div>
        </div>

        {/* Add New IP Block */}
        <div className="bg-[var(--color-surface-secondary)] rounded-lg p-4 mb-6">
          <h3 className="mb-4 text-md font-medium text-[var(--color-text)]">Block New IP Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                IP Address
              </label>
              <input
                type="text"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                placeholder="192.168.1.1 or 2001:db8::1"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                disabled={isAddingIP}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                Reason
              </label>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Reason for blocking"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                disabled={isAddingIP}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleBlockIP}
                disabled={isAddingIP || !newIP.trim() || !newReason.trim()}
                className="flex w-full items-center justify-center space-x-2 rounded-lg px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:bg-[var(--color-surface-tertiary)] disabled:text-[var(--color-text-muted)]"
                style={{ backgroundColor: 'var(--color-error)', color: 'var(--color-on-error)' }}
              >
                {isAddingIP ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Blocking...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Block IP</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search blocked IPs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-4 py-2 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <button
            onClick={loadBlockedIPs}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-on-primary)] px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>

        {/* Blocked IPs List */}
        {filteredIPs.length === 0 ? (
          <div className="text-center text-[var(--color-text-secondary)] py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-[var(--color-surface-secondary)] rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-lg font-medium mb-2">
              {blockedIPs.length === 0 ? 'No blocked IPs' : 'No IPs match your search'}
            </p>
            <p className="text-[var(--color-text-muted)] text-sm">
              {blockedIPs.length === 0 ? 'IP addresses will appear here once blocked' : 'Try adjusting your search terms'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIPs.map((blockedIP, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-[var(--color-surface-secondary)] rounded-lg hover:bg-[var(--color-surface-secondary)] transition-colors"
              >
                {/* IP Info */}
                <div className="flex items-center space-x-4 flex-1">
                  {/* IP Icon */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-error)]">
                    <svg className="w-5 h-5 text-[var(--color-on-error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>

                  {/* IP Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-[var(--color-text)]">{blockedIP.ip}</h4>
                      <span className="rounded px-2 py-1 text-xs font-medium bg-[var(--color-error)] text-[var(--color-on-error)]">
                        Blocked
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-[var(--color-text-secondary)]">
                      <span>Reason: {blockedIP.reason}</span>
                      <span>•</span>
                      <span>Blocked: {new Date(blockedIP.blocked_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setDeleteConfirmIP(blockedIP)}
                    className="p-2 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-success)]"
                    title="Unblock IP"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Information Panel */}
        <div
          className="mt-6 rounded-lg border p-4"
          style={{
            background: 'linear-gradient(to right, color-mix(in srgb, var(--color-error) 10%, transparent), color-mix(in srgb, var(--color-warning) 10%, transparent))',
            borderColor: 'color-mix(in srgb, var(--color-error) 35%, transparent)',
          }}
        >
          <h3 className="mb-2 text-lg font-medium text-[var(--color-text)]">About IP Blocking</h3>
          <p className="text-[var(--color-text-secondary)] text-sm">
            Blocked IP addresses are automatically prevented from accessing the server by the rate limiting middleware.
            IPs are typically blocked when they exceed rate limits or engage in malicious activities.
            You can manually block IPs here for security purposes, or unblock them if needed.
          </p>
        </div>
      </div>

      {/* Unblock Confirmation Modal */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmIP)}
        title="Unblock IP Address"
        description={deleteConfirmIP
          ? `Unblock ${deleteConfirmIP.ip}? This address will be able to access the server again.`
          : ""}
        confirmLabel="Unblock IP"
        cancelLabel="Cancel"
        tone="warning"
        onCancel={() => setDeleteConfirmIP(null)}
        onConfirm={() => {
          if (deleteConfirmIP?.ip) {
            void handleUnblockIP(deleteConfirmIP.ip);
          }
        }}
      />
    </div>
  );
}
