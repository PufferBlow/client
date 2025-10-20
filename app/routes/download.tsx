import { Link } from "react-router";
import { useState, useEffect } from "react";

export function meta({}: any) {
  return [
    { title: "Download Pufferblow Desktop App" },
    { name: "description", content: "Download Pufferblow desktop app for Windows, macOS, or Linux. Experience decentralized messaging on your desktop." },
  ];
}

export default function Download() {
  const [detectedPlatform, setDetectedPlatform] = useState<string>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated by looking for auth cookie
    const checkAuth = () => {
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key.trim()] = value;
      return acc;
    }, {} as Record<string, string>);

    return !!(cookies.auth_token && cookies.auth_token.trim() !== '');
    };

    setIsAuthenticated(checkAuth());
  }, []);

  useEffect(() => {
    // Detect platform from user agent
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('win')) {
      setDetectedPlatform('windows');
    } else if (userAgent.includes('linux')) {
      setDetectedPlatform('linux');
    } else {
      setDetectedPlatform('unknown');
    }

    setIsLoading(false);
  }, []);

  const downloadLinks = {
    windows: "https://github.com/pufferblow/pufferblow-desktop/releases/latest/download/pufferblow-desktop-windows.exe",
    linux: "https://github.com/pufferblow/pufferblow-desktop/releases/latest/download/pufferblow-desktop-linux.AppImage"
  };

  const getDownloadText = (platform: string) => {
    switch (platform) {
      case 'windows':
        return 'Download for Windows';
      case 'linux':
        return 'Download for Linux';
      default:
        return 'Download Desktop App';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'windows':
        return (
          <svg className="w-6 h-6 text-[var(--color-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'linux':
        return (
          <svg className="w-6 h-6 text-[var(--color-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H6a2 2 0 01-2-2V7a2 2 0 012-2h1m6 0v4m-5 4h10M7 16.5A2.5 2.5 0 019.5 19h5a2.5 2.5 0 002.5-2.5v-9A2.5 2.5 0 0014.5 5h-5A2.5 2.5 0 007 7.5" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6 text-[var(--color-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--color-background)] to-[var(--color-background-secondary)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-background)] to-[var(--color-background-secondary)]">
      {/* Navigation - Synced with Home Page */}
      <nav className="bg-gradient-to-r from-[var(--color-surface)]/95 to-[var(--color-background-secondary)]/95 backdrop-blur-xl border-b border-[var(--color-border)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <Link
                to="/"
                className="flex flex-col cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] rounded-lg p-2 -m-2"
              >
                <h1 className="text-4xl font-black text-[var(--color-text)] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-200">
                  Pufferblow
                </h1>
                <span className="text-base text-[var(--color-text-secondary)] font-semibold group-hover:text-[var(--color-text)] transition-colors duration-200">Decentralized Messaging</span>
              </Link>
            </div>

            <div className="flex items-center space-x-6">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:from-[var(--color-primary-hover)] hover:to-[#6e9cf1] text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-2xl flex items-center gap-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Dashboard</span>
                </Link>
              ) : (
                <Link
                  to="/signup"
                  className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:from-[var(--color-primary-hover)] hover:to-[#6e9cf1] text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-2xl"
                >
                  Get Started Free
                </Link>
              )}

              <a
                href="https://github.com/pufferblow/pufferblow"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] p-3 rounded-xl transition-all duration-200 hover:bg-[var(--color-surface-secondary)]"
                title="View source code on GitHub"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Modern Synced Design */}
      <section className="relative overflow-hidden py-32 lg:py-40">
        <div className="absolute inset-0 opacity-5">
          <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)] via-transparent to-[var(--color-accent)]"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-[var(--color-surface)]/50 backdrop-blur-sm border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium mb-8">
              <svg className="w-4 h-4 mr-2 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Desktop App Download
            </div>

            <h1 className="text-6xl md:text-8xl font-black text-[var(--color-text)] mb-8 leading-none">
              Desktop Experience
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent)] to-[var(--color-secondary)] animate-pulse">
                Unleashed
              </span>
              <span className="block text-4xl md:text-5xl font-bold text-[var(--color-text-secondary)] font-light">
                Native Performance
              </span>
            </h1>

            <p className="text-2xl md:text-3xl text-[var(--color-text-secondary)] mb-12 max-w-4xl mx-auto leading-relaxed font-light">
              Experience Pufferblow with blazing-fast performance, offline syncing,
              and battery-efficient notifications.
              <span className="text-[var(--color-primary)] font-semibold">Your desktop deserves the best.</span>
            </p>

            {/* Platform Detection & Download - Enhanced */}
            <div className="bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-3xl p-8 shadow-2xl border border-[var(--color-border)] backdrop-blur-sm mb-16">
              <div className="text-center">
                <div className="flex items-center justify-center mb-6">
                  {getPlatformIcon(detectedPlatform)}
                  <span className="ml-3 text-xl font-bold text-[var(--color-text)]">
                    {detectedPlatform === 'unknown' ? '🖥️ AI-Powered Detection' :
                     detectedPlatform === 'windows' ? '🪟 Windows Detected' :
                     `🐧 Linux Detected`}
                  </span>
                </div>

                <div className="mb-6">
                  <p className="text-[var(--color-text-secondary)] text-lg">
                    {detectedPlatform === 'unknown'
                      ? 'Select your platform manually from the options below.'
                      : `Perfect! Here's your customized download for ${detectedPlatform === 'mac' ? 'macOS' : detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1)}.`}
                  </p>
                </div>

                <a
                  href={downloadLinks[detectedPlatform as keyof typeof downloadLinks] || "https://pufferblow-desktop.up.railway.app/download"}
                  className="group inline-flex items-center bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent)] to-[var(--color-secondary)] hover:from-[var(--color-primary-hover)] hover:via-[#6e9cf1] hover:to-[var(--color-secondary-hover)] text-white px-12 py-6 rounded-2xl text-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-[0_25px_50px_rgba(94,129,172,0.3)]"
                >
                  <svg className="w-8 h-8 mr-4 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{getDownloadText(detectedPlatform)}</span>
                  <svg className="w-8 h-8 ml-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>

                <p className="text-[var(--color-text-muted)] text-sm mt-4 flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {detectedPlatform === 'unknown'
                    ? 'Auto-detection failed • Manual selection required'
                    : 'Download starts instantly • Safe & secure'}
                </p>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-[var(--color-text-secondary)] text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Up to 10x faster than web
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Background notifications
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Offline message queuing
              </div>
            </div>
          </div>
        </div>

        {/* Background Animations */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-20 -left-40 w-[600px] h-[600px] bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-accent)]/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 -right-40 w-[600px] h-[600px] bg-gradient-to-r from-[var(--color-secondary)]/10 to-[var(--color-success)]/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-[var(--color-info)]/5 to-[var(--color-warning)]/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '4s'}}></div>
        </div>

        <div className="absolute top-32 left-16 w-3 h-3 bg-[var(--color-primary)] rounded-full opacity-60 animate-bounce" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-48 right-24 w-2 h-2 bg-[var(--color-accent)] rounded-full opacity-60 animate-bounce" style={{animationDelay: '3s'}}></div>
        <div className="absolute bottom-32 left-1/4 w-4 h-4 bg-[var(--color-secondary)] rounded-full opacity-60 animate-bounce" style={{animationDelay: '5s'}}></div>
      </section>

      {/* All Platforms Section - Enhanced */}
      <section className="py-24 bg-[var(--color-background-secondary)] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[var(--color-text)] mb-6">
              Choose Your Platform
            </h2>
            <p className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto">
              Pufferblow desktop apps are available for all major operating systems
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Windows Card */}
            <div className="group relative bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-3xl p-8 shadow-2xl hover:shadow-[0_25px_50px_rgba(94,129,172,0.15)] border border-[var(--color-border)] backdrop-blur-sm transition-all duration-300 transform hover:-translate-y-2">
              <div className="absolute top-6 right-6 w-12 h-12 bg-[#0078D4] rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>

              <div className="text-center mb-8 mt-8">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-gray-300 overflow-hidden">
                  <img src="/os-logos/windows-logo.svg" alt="Windows Logo" className="w-full h-full object-contain p-2" />
                </div>
                <h3 className="text-3xl font-bold text-[var(--color-text)] mb-4">
                  Windows
                </h3>
                <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed">
                  Native .exe installer for Windows 10/11 with auto-updater and system integration.
                </p>
              </div>

              <div className="flex items-center justify-between text-sm text-[var(--color-text)] mb-6">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>System Tray</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Quick Launch</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Auto-Start</span>
                </div>
              </div>

              <a
                href="https://github.com/pufferblow/pufferblow-desktop/releases/latest/download/pufferblow-desktop-windows.exe"
                className="w-full flex items-center justify-center bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-4 rounded-2xl text-lg font-bold transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Windows .exe
              </a>

              <div className="mt-4 text-center">
                <span className="text-xs text-[var(--color-text)]">Version 1.0.0 • 24MB installer</span>
              </div>
            </div>

            {/* Linux Card */}
            <div className="group relative bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-3xl p-8 shadow-2xl hover:shadow-[0_25px_50px_rgba(94,129,172,0.15)] border border-[var(--color-border)] backdrop-blur-sm transition-all duration-300 transform hover:-translate-y-2">
              <div className="absolute top-6 right-6 w-12 h-12 bg-[#FCC624] rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H6a2 2 0 01-2-2V7a2 2 0 012-2h1m6 0v4m-5 4h10M7 16.5A2.5 2.5 0 019.5 19h5a2.5 2.5 0 002.5-2.5v-9A2.5 2.5 0 0014.5 5h-5A2.5 2.5 0 007 7.5" />
                </svg>
              </div>

              <div className="text-center mb-8 mt-8">
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-gray-300 overflow-hidden">
                  <img src="/os-logos/linux-logo.svg" alt="Linux Logo" className="w-full h-full object-contain p-2" />
                </div>
                <h3 className="text-3xl font-bold text-[var(--color-text)] mb-4">
                  Linux
                </h3>
                <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed">
                  Portable AppImage format that works on any Linux distribution without installation.
                </p>
              </div>

              <div className="flex items-center justify-between text-sm text-[var(--color-text)] mb-6">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>No Root</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Portable</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Cross Distro</span>
                </div>
              </div>

              <a
                href="https://github.com/pufferblow/pufferblow-desktop/releases/latest/download/pufferblow-desktop-linux.AppImage"
                className="w-full flex items-center justify-center bg-gradient-to-r from-orange-400 to-orange-600 hover:from-orange-500 hover:to-orange-700 text-black px-8 py-4 rounded-2xl text-lg font-bold transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H6a2 2 0 01-2-2V7a2 2 0 012-2h1m6 0v4m-5 4h10M7 16.5A2.5 2.5 0 019.5 19h5a2.5 2.5 0 002.5-2.5v-9A2.5 2.5 0 0014.5 5h-5A2.5 2.5 0 007 7.5" />
                </svg>
                Download Linux AppImage
              </a>

              <div className="mt-4 text-center">
                <span className="text-xs text-[var(--color-text)]">Version 1.0.0 • 35MB portable app</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Modern Call-to-Action */}
      <section className="py-32 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-black/10 backdrop-blur-sm border border-black/20 text-black text-sm font-medium mb-8">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Ready to Get Started?
          </div>

          <h2 className="text-6xl md:text-7xl font-black text-black mb-8 leading-tight">
            Join the Movement
          </h2>

          <p className="text-xl md:text-2xl text-black/80 mb-12 max-w-3xl mx-auto leading-relaxed">
            Thousands of users are already experiencing decentralized messaging.
            <span className="text-black font-semibold"> Be the next one to join the revolution.</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link
              to="/signup"
              className="bg-white text-[var(--color-primary)] hover:bg-gray-100 px-10 py-5 rounded-2xl text-2xl font-bold transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-[0_25px_50px_rgba(0,0,0,0.25)] flex items-center gap-3 group"
            >
              <svg className="w-8 h-8 transition-transform group-hover:rotate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Start Your Journey Now
            </Link>

            <Link
              to="/"
              className="border-3 border-white text-white hover:bg-white hover:text-[var(--color-primary)] px-10 py-5 rounded-2xl text-2xl font-bold transition-all duration-300 transform hover:scale-105 backdrop-blur-sm bg-white/10 hover:bg-white"
            >
              Return to Home
            </Link>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-16 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-white/80 text-sm">
            <a href="#" className="hover:text-white transition-colors">Installation Guide</a>
            <a href="#" className="hover:text-white transition-colors">System Requirements</a>
            <a href="#" className="hover:text-white transition-colors">Release Notes</a>
            <a href="#" className="hover:text-white transition-colors">Command Line</a>
          </div>

        </div>
      </section>

      {/* Footer - Minimal */}
      <footer className="bg-[var(--color-surface)] text-[var(--color-text)] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <span className="text-xl font-black text-[var(--color-text)] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent cursor-pointer">
                Pufferblow
              </span>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
                Terms of Service
              </a>
              <a href="#" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
                GitHub
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-[var(--color-border)] text-center text-[var(--color-text-secondary)]">
            <p>&copy; 2025 Pufferblow. Built for the decentralized future.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
