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

  useEffect(() => {
    // Detect platform from user agent
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes('win')) {
      setDetectedPlatform('windows');
    } else if (userAgent.includes('mac') || userAgent.includes('darwin')) {
      setDetectedPlatform('mac');
    } else if (userAgent.includes('linux')) {
      setDetectedPlatform('linux');
    } else {
      setDetectedPlatform('unknown');
    }

    setIsLoading(false);
  }, []);

  const downloadLinks = {
    windows: "https://pufferblow-desktop.up.railway.app/download/windows",
    mac: "https://pufferblow-desktop.up.railway.app/download/mac",
    linux: "https://pufferblow-desktop.up.railway.app/download/linux"
  };

  const getDownloadText = (platform: string) => {
    switch (platform) {
      case 'windows':
        return 'Download for Windows';
      case 'mac':
        return 'Download for macOS';
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
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2-2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'mac':
        return (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
        );
      case 'linux':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H6a2 2 0 01-2-2V7a2 2 0 012-2h1m6 0v4m-5 4h10M7 16.5A2.5 2.5 0 019.5 19h5a2.5 2.5 0 002.5-2.5v-9A2.5 2.5 0 0014.5 5h-5A2.5 2.5 0 007 7.5" />
          </svg>
        );
      default:
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Navigation */}
      <nav className="bg-[var(--color-surface)] backdrop-blur-md border-b border-[var(--color-border)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <img
                  src="/pufferblow-art-pixel-32x32.png"
                  alt="Pufferblow"
                  className="w-6 h-6"
                />
              </div>
              <span className="text-2xl font-bold text-[var(--color-text)]">Pufferblow</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link
                to="/signup"
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Get Started
              </Link>
              <a
                href="https://github.com/pufferblow/pufferblow"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] p-2 rounded-md transition-colors"
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

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
            <img
              src="/pufferblow-art-pixel-64x64.png"
              alt="Pufferblow Desktop"
              className="w-12 h-12"
            />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-[var(--color-text)] mb-6">
            {detectedPlatform === 'unknown' ? 'Download' : 'Recommended for Your'} Platform
          </h1>
          <p className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto">
            Get the full Pufferblow experience with our native desktop app.
            {detectedPlatform !== 'unknown' && ` We've detected you're on ${
              detectedPlatform === 'mac' ? 'macOS' :
              detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1)
            }, so here's the perfect download for you!`}
          </p>
        </div>

        {/* Platform Detection & Download */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-xl border border-[var(--color-border)] mb-12">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              {getPlatformIcon(detectedPlatform)}
              <span className="ml-3 text-lg font-medium text-[var(--color-text)]">
                {detectedPlatform === 'unknown' ? 'unknown platform' :
                 detectedPlatform === 'mac' ? 'macOS detected' :
                 `${detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1)} detected`}
              </span>
            </div>

            <a
              href={downloadLinks[detectedPlatform as keyof typeof downloadLinks] || "https://pufferblow-desktop.up.railway.app/download"}
              className="inline-flex items-center bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-accent-hover)] text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              {getPlatformIcon(detectedPlatform)}
              <span className="ml-3">{getDownloadText(detectedPlatform)}</span>
            </a>

            <p className="text-sm text-[var(--color-text-secondary)] mt-4">
              {detectedPlatform === 'unknown'
                ? 'Couldn\'t detect your platform? You can choose from all available downloads below.'
                : 'Download should start automatically in your browser.'
              }
            </p>
          </div>
        </div>

        {/* All Download Options */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-xl border border-[var(--color-border)]">
          <h3 className="text-2xl font-bold text-[var(--color-text)] text-center mb-8">
            All Download Options
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Windows */}
            <div className="text-center p-6 bg-[var(--color-background-secondary)] rounded-xl border border-[var(--color-border)]">
              <div className="flex justify-center items-center w-12 h-12 bg-[#007ACC] rounded-lg mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-[var(--color-text)] mb-2">
                Windows
              </h4>
              <p className="text-[var(--color-text-secondary)] text-sm mb-4">
                .exe installer for Windows 10/11
              </p>
              <a
                href="https://pufferblow-desktop.up.railway.app/download/windows"
                className="inline-block bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                Download for Windows
              </a>
            </div>

            {/* macOS */}
            <div className="text-center p-6 bg-[var(--color-background-secondary)] rounded-xl border border-[var(--color-border)]">
              <div className="flex justify-center items-center w-12 h-12 bg-black rounded-lg mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-[var(--color-text)] mb-2">
                macOS
              </h4>
              <p className="text-[var(--color-text-secondary)] text-sm mb-4">
                .dmg file for Intel and Apple Silicon
              </p>
              <a
                href="https://pufferblow-desktop.up.railway.app/download/mac"
                className="inline-block bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                Download for macOS
              </a>
            </div>

            {/* Linux */}
            <div className="text-center p-6 bg-[var(--color-background-secondary)] rounded-xl border border-[var(--color-border)]">
              <div className="flex justify-center items-center w-12 h-12 bg-[#FCC624] rounded-lg mx-auto mb-4">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H6a2 2 0 01-2-2V7a2 2 0 012-2h1m6 0v4m-5 4h10M7 16.5A2.5 2.5 0 019.5 19h5a2.5 2.5 0 002.5-2.5v-9A2.5 2.5 0 0014.5 5h-5A2.5 2.5 0 007 7.5" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-[var(--color-text)] mb-2">
                Linux
              </h4>
              <p className="text-[var(--color-text-secondary)] text-sm mb-4">
                AppImage for all Linux distributions
              </p>
              <a
                href="https://pufferblow-desktop.up.railway.app/download/linux"
                className="inline-block bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                Download for Linux
              </a>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-start space-x-3">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  First Time Installing?
                </h4>
                <ul className="text-blue-800 dark:text-blue-200 space-y-1 text-sm">
                  <li>• Make sure you have enough disk space (50MB free recommended)</li>
                  <li>• The app will require internet access for communication features</li>
                  <li>• On Windows, you may need to approve the app through Windows Defender</li>
                  <li>• First launch may take a moment while the app initializes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-[var(--color-text)] text-center mb-12">
            Why Download the Desktop App?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[var(--color-text)] mb-4">
                Lightning Fast
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Desktop app runs locally with native performance and instant access to your communities.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-success)] to-[var(--color-primary)] rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[var(--color-text)] mb-4">
                Always Available
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Decentralized architecture ensures your communities stay accessible even during outages.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[var(--color-text)] mb-4">
                Secure & Private
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                End-to-end encryption and decentralized storage keep your conversations safe and private.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-[var(--color-text-secondary)] mb-4">
            Having trouble? Check our installation guide or contact support.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="text-[var(--color-primary)] hover:text-[var(--color-accent)] font-medium transition-colors"
            >
              ← Back to Homepage
            </Link>
            <a
              href="https://pufferblow.github.io/pufferblow/docs/installation"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-primary)] hover:text-[var(--color-accent)] font-medium transition-colors"
            >
              📖 Installation Guide
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
