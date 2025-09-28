import type { Route } from "./+types/settings";
import { Link } from "react-router";
import { useTheme } from "../components/ThemeProvider";
import { useState, useEffect } from "react";
import { updateUsername, updateUserStatus, updatePassword, resetAuthToken, getCurrentUserProfile, getAuthTokenFromCookies, getHostPortFromCookies, profileCache, type UpdateUsernameRequest, type UpdateStatusRequest, type UpdatePasswordRequest, type ResetAuthTokenRequest, type GetUserProfileResponse } from "../services/user";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Settings - Pufferblow" },
    { name: "description", content: "Manage your Pufferblow account settings" },
  ];
}

export default function Settings() {
  const [activeSection, setActiveSection] = useState('profile');
  const [username, setUsername] = useState('');
  const [userStatus, setUserStatus] = useState<'online' | 'offline' | 'idle' | 'inactive'>('online');
  const [userBio, setUserBio] = useState('Building the future of decentralized messaging');
  const [bioInputValue, setBioInputValue] = useState('Building the future of decentralized messaging');
  const [hasBioChanged, setHasBioChanged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  const hostPort = getHostPortFromCookies() || 'localhost:7575';
  const authToken = getAuthTokenFromCookies() || '';

  const changeSection = (sectionId: string) => {
    setActiveSection(sectionId);
  };

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || loading) return;
    setLoading(true);
    setMessage(null);
    const response = await updateUsername(hostPort, { auth_token: authToken, new_username: newUsername });
    setLoading(false);
    if (response.success && response.data?.status_code === 200) {
      setMessage({ type: 'success', text: response.data.message });
      setUsername(newUsername);
      setNewUsername('');
      // Update cached profile
      const cachedProfile = profileCache.get();
      if (cachedProfile) {
        cachedProfile.username = newUsername;
        profileCache.set(cachedProfile);
      }
    } else {
      setMessage({ type: 'error', text: response.error || 'Failed to update username' });
    }
  };

  const handleStatusSubmit = async () => {
    if (loading) return;
    setLoading(true);
    setMessage(null);
    const response = await updateUserStatus(hostPort, { auth_token: authToken, status: userStatus });
    setLoading(false);
    if (response.success && response.data?.status_code === 200) {
      setMessage({ type: 'success', text: response.data.message });
      // Update cached profile
      const cachedProfile = profileCache.get();
      if (cachedProfile) {
        cachedProfile.status = userStatus;
        profileCache.set(cachedProfile);
      }
    } else {
      setMessage({ type: 'error', text: response.error || 'Failed to update status' });
    }
  };

  const handlePasswordSubmit = async () => {
    if (!currentPassword || !newPassword || newPassword !== confirmPassword || loading) return;
    setLoading(true);
    setMessage(null);
    const response = await updatePassword(hostPort, { auth_token: authToken, new_password: newPassword, old_password: currentPassword });
    setLoading(false);
    if (response.success && response.data?.status_code === 200) {
      setMessage({ type: 'success', text: response.data.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      // Check for specific password error
      if (response.error?.includes('401') || response.error?.includes('Invalid password') || response.error?.includes('unauthorized')) {
        setMessage({ type: 'error', text: 'Current password is incorrect. Please try again.' });
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to update password' });
      }
    }
  };

  const handleResetAuthToken = async () => {
    if (!resetPassword || loading) return;
    setLoading(true);
    setMessage(null);
    const response = await resetAuthToken(hostPort, { auth_token: authToken, password: resetPassword });
    setLoading(false);
    if (response.success && response.data?.status_code === 200) {
      setMessage({ type: 'success', text: response.data.message });

      // Save new auth token and expiration to cookies
      const expireDate = new Date(response.data.auth_token_expire_time);
      document.cookie = `authToken=${response.data.auth_token}; expires=${expireDate.toUTCString()}; path=/; secure; samesite=strict`;
      document.cookie = `authTokenExpire=${response.data.auth_token_expire_time}; expires=${expireDate.toUTCString()}; path=/; secure; samesite=strict`;

      // Update cached profile with new auth token
      const cachedProfile = profileCache.get();
      if (cachedProfile) {
        cachedProfile.auth_token = response.data.auth_token;
        cachedProfile.auth_token_expire_time = response.data.auth_token_expire_time;
        profileCache.set(cachedProfile);
      }

      // Clear the password field
      setResetPassword('');
      setShowResetModal(false);

      // Optionally redirect to login or refresh the page
      setTimeout(() => {
        window.location.reload(); // Refresh to ensure all components use the new token
      }, 2000);
    } else {
      // Check for specific password error (404 for auth token reset)
      if (response.error?.includes('404') || response.error?.includes('Incorrect password')) {
        setMessage({ type: 'error', text: 'Password is incorrect. Please try again.' });
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to reset auth token' });
      }
    }
  };

  const handleBioChange = (newBio: string) => {
    setUserBio(newBio);
    setBioInputValue(newBio);
    // Here you would typically make an API call to update the bio
    console.log('Bio changed to:', newBio);
  };

  useEffect(() => {
    const loadProfile = async () => {
      const cachedProfile = profileCache.get();
      if (cachedProfile) {
        setUsername(cachedProfile.username);
        setUserStatus(cachedProfile.status);
        setInitialLoading(false);
      } else {
        // No cached profile, fetch from API
        const response = await getCurrentUserProfile(hostPort, authToken);
        if (response.success && response.data?.status_code === 200) {
          const userData = response.data.user_data;
          setUsername(userData.username);
          setUserStatus(userData.status);
          // Cache the profile
          profileCache.set(userData);
          setInitialLoading(false);
        } else {
          setMessage({ type: 'error', text: 'Failed to load user profile' });
          setInitialLoading(false);
        }
      }
    };

    loadProfile();

    // Set initial active section based on URL hash or default to profile
    const hash = window.location.hash.replace('#', '');
    if (hash && ['profile', 'security', 'appearance'].includes(hash)) {
      setActiveSection(hash);
    }
  }, [hostPort, authToken]);

  // Auto-hide messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [message]);
  return (
    <div className="min-h-screen bg-[var(--color-background)] animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Main Content */}
      <main className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Back Button */}
        <div className="mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
        <div className="px-4 py-6 sm:px-0">
          {/* Settings Navigation */}
          <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-md mb-6">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-2xl font-bold text-[var(--color-text)]">
                Account Settings
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Manage your account preferences and security settings.
              </p>
            </div>
          </div>

          {/* Error/Success Messages */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg border relative ${message.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">{message.text}</div>
                <button
                  onClick={() => setMessage(null)}
                  className={`ml-4 p-1 rounded-full hover:bg-black hover:bg-opacity-10 transition-colors ${
                    message.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}
                  aria-label="Close message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Settings Sidebar */}
            <div className="lg:col-span-1">
              <nav className="space-y-1">
                <button
                  onClick={() => changeSection('profile')}
                  className={`w-full text-left border-l-4 px-3 py-2 flex items-center text-sm font-medium transition-colors ${
                    activeSection === 'profile'
                      ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <svg className={`mr-3 flex-shrink-0 h-6 w-6 ${
                    activeSection === 'profile' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </button>
                <button
                  onClick={() => changeSection('security')}
                  className={`w-full text-left border-l-4 px-3 py-2 flex items-center text-sm font-medium transition-colors ${
                    activeSection === 'security'
                      ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <svg className={`mr-3 flex-shrink-0 h-6 w-6 ${
                    activeSection === 'security' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Security
                </button>
                <button
                  onClick={() => changeSection('appearance')}
                  className={`w-full text-left border-l-4 px-3 py-2 flex items-center text-sm font-medium transition-colors ${
                    activeSection === 'appearance'
                      ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)]'
                  }`}
                >
                  <svg className={`mr-3 flex-shrink-0 h-6 w-6 ${
                    activeSection === 'appearance' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                  </svg>
                  Appearance
                </button>
              </nav>
            </div>

            {/* Settings Content */}
            <div className="lg:col-span-3">
              {/* Account Settings */}
              {activeSection === 'profile' && (
                <div className="space-y-6">
                  {/* Change Username */}
                  <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                        Change Username
                      </h3>
                      <form onSubmit={handleUsernameSubmit} className="space-y-4">
                        <div>
                          <label htmlFor="currentUsername" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                            Current Username
                          </label>
                          <input
                            type="text"
                            name="currentUsername"
                            id="currentUsername"
                            value={initialLoading ? 'Loading...' : username}
                            className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm"
                            readOnly
                          />
                        </div>
                        <div>
                          <label htmlFor="newUsername" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                            New Username
                          </label>
                          <input
                            type="text"
                            name="newUsername"
                            id="newUsername"
                            placeholder="New username"
                            value={newUsername}
                            onChange={e => setNewUsername(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                          >
                            {loading ? 'Updating...' : 'Change Username'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>



                  {/* Account Status */}
                  <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                        Account Status
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="accountStatus" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                            Current Status
                          </label>
                          <div className="relative">
                            <select
                              id="accountStatus"
                              name="accountStatus"
                              value={userStatus}
                              onChange={e => setUserStatus(e.target.value as 'online' | 'offline' | 'idle' | 'inactive')}
                              className="mt-1 block w-full px-4 py-3 pr-10 border border-[var(--color-border)] rounded-xl shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] transition-all duration-200 sm:text-sm appearance-none cursor-pointer hover:border-[var(--color-primary)]/50 hover:shadow-md focus:shadow-lg"
                            >
                              <option value="online">Online</option>
                              <option value="offline">Offline</option>
                              <option value="idle">Idle</option>
                              <option value="inactive">Inactive</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                              <svg className="w-5 h-5 text-[var(--color-text-secondary)] transition-transform duration-200 group-hover:text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleStatusSubmit}
                            disabled={loading}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                          >
                            {loading ? 'Updating...' : 'Update Status'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Update Bio */}
                  <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                        Update Bio
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="bio" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                            Bio
                          </label>
                          <textarea
                            id="bio"
                            name="bio"
                            rows={3}
                            value={bioInputValue}
                            onChange={(e) => {
                              const newValue = e.target.value;
                              setBioInputValue(newValue);
                              setHasBioChanged(newValue !== userBio);
                            }}
                            placeholder="Tell us about yourself..."
                            className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm resize-none"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (bioInputValue !== userBio) {
                                handleBioChange(bioInputValue);
                                setHasBioChanged(false);
                              }
                            }}
                            disabled={!hasBioChanged}
                            className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] ${
                              hasBioChanged
                                ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] animate-pulse'
                                : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] cursor-not-allowed'
                            }`}
                          >
                            Update Bio
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Security Settings */}
              {activeSection === 'security' && (
                <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                      Security Settings
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-medium text-[var(--color-text)]">Change Password</h4>
                        <div className="mt-2 space-y-4">
                          <div>
                            <label htmlFor="currentPassword" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                              Current password
                            </label>
                            <input
                              type="password"
                              name="currentPassword"
                              id="currentPassword"
                              value={currentPassword}
                              onChange={e => setCurrentPassword(e.target.value)}
                              className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm"
                            />
                          </div>
                          <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                              New password
                            </label>
                            <input
                              type="password"
                              name="newPassword"
                              id="newPassword"
                              value={newPassword}
                              onChange={e => setNewPassword(e.target.value)}
                              className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm"
                            />
                          </div>
                          <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                              Confirm password
                            </label>
                            <input
                              type="password"
                              name="confirmPassword"
                              id="confirmPassword"
                              value={confirmPassword}
                              onChange={e => setConfirmPassword(e.target.value)}
                              className="mt-1 block w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] transition-all duration-200 sm:text-sm"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handlePasswordSubmit}
                            disabled={loading}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
                          >
                            {loading ? 'Updating...' : 'Update Password'}
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-[var(--color-border)] pt-6">
                        <h4 className="text-sm font-medium text-[var(--color-text)]">Two-Factor Authentication</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          Add an extra layer of security to your account.
                        </p>
                        <div className="mt-3">
                          <button
                            type="button"
                            className="inline-flex justify-center py-2 px-4 border border-[var(--color-border)] shadow-sm text-sm font-medium rounded-md text-[var(--color-text-secondary)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-secondary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]"
                          >
                            Enable 2FA
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-[var(--color-border)] pt-6">
                        <h4 className="text-sm font-medium text-[var(--color-text)]">Authentication Token</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          Resetting your authentication token will log you out of all devices. You'll need to log in again with your new token.
                        </p>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setShowResetModal(true)}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-error)] hover:bg-[var(--color-error)]/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-error)]"
                          >
                            Reset Auth Token
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-[var(--color-border)] pt-6">
                        <h4 className="text-sm font-medium text-[var(--color-text)]">Sign Out</h4>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                          Sign out of your account. You'll need to log in again to access your account.
                        </p>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              // Clear auth token and related cookies
                              document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                              document.cookie = 'authTokenExpire=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                              document.cookie = 'hostPort=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

                              // Clear cached profile
                              profileCache.clear();

                              // Redirect to login
                              window.location.href = '/login';
                            }}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-error)] hover:bg-[var(--color-error)]/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-error)]"
                          >
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Appearance Settings */}
              {activeSection === 'appearance' && (
                <div className="bg-[var(--color-surface)] shadow overflow-hidden sm:rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-[var(--color-text)] mb-4">
                      Appearance
                    </h3>
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-medium text-[var(--color-text)] mb-2">Theme</h4>
                        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                          Choose your preferred theme. Your choice will be saved automatically.
                        </p>
                        <div className="relative">
                          <select
                            value={typeof window !== 'undefined' && !localStorage.getItem('pufferblow-theme') ? 'system' : useTheme().theme}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === 'system') {
                                if (typeof window !== 'undefined') {
                                  localStorage.removeItem('pufferblow-theme');
                                  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                                  useTheme().setTheme(systemTheme);
                                }
                              } else {
                                useTheme().setTheme(value as 'light' | 'dark');
                              }
                            }}
                            className="block w-full px-4 py-3 pr-10 border border-[var(--color-border)] rounded-xl shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] transition-all duration-200 sm:text-sm appearance-none cursor-pointer hover:border-[var(--color-primary)]/50 hover:shadow-md focus:shadow-lg"
                          >
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                            <option value="system">System</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                            <svg className="w-5 h-5 text-[var(--color-text-secondary)] transition-transform duration-200 group-hover:text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-4">
                          <p className="text-xs text-[var(--color-text-muted)]">
                            Current theme: <span className="font-medium text-[var(--color-primary)] capitalize">{useTheme().theme}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Password Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-[var(--color-border)]">
              <h3 className="text-lg font-medium text-[var(--color-text)]">Confirm Password Reset</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                Resetting your authentication token will log you out of all devices. You'll need to log in again with your new token. Please enter your current password to confirm.
              </p>
              <div>
                <label htmlFor="modalPassword" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  id="modalPassword"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-text)] transition-all duration-200"
                  placeholder="Enter your password"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--color-border)] flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetPassword('');
                }}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!resetPassword.trim()) return;
                  setShowResetModal(false);
                  await handleResetAuthToken();
                  setResetPassword('');
                }}
                disabled={!resetPassword.trim() || loading}
                className="px-4 py-2 text-sm font-medium text-white bg-[var(--color-error)] border border-transparent rounded-md hover:bg-[var(--color-error)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--color-error)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Resetting...' : 'Reset Token'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
