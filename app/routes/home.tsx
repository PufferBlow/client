import type { Route } from "./+types/home";
import { Link } from "react-router";
import { useState, useEffect } from "react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Pufferblow - Decentralized Messaging" },
    { name: "description", content: "Experience the future of messaging with decentralized servers, enhanced privacy, and Discord-like features." },
  ];
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is authenticated by looking for auth cookie
    const checkAuth = () => {
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key.trim()] = value;
        return acc;
      }, {} as Record<string, string>);

      return !!(cookies.authToken && cookies.authToken.trim() !== '');
    };

    setIsAuthenticated(checkAuth());
  }, []);
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Navigation */}
      <nav className="bg-[var(--color-surface)] backdrop-blur-md border-b border-[var(--color-border)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                <img
                  src="/pufferblow-art-pixel-32x32.png"
                  alt="Pufferblow"
                  className="w-6 h-6"
                />
              </div>
              <span className="text-2xl font-bold text-[var(--color-text)]">Pufferblow</span>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Get Started
                  </Link>
                </>
              )}
              <a
                href="https://pufferblow.github.io/pufferblow"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] px-3 py-2 rounded-md text-sm font-medium transition-colors"
                title="View documentation"
              >
                Docs
              </a>
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

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-[var(--color-text)] mb-6">
              The Future of
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]">
                Decentralized Messaging
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-[var(--color-text-secondary)] mb-8 max-w-3xl mx-auto leading-relaxed">
              Experience Discord-like messaging with the power of decentralization.
              Your conversations are distributed across multiple nodes for unmatched privacy and reliability.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/signup"
                className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-accent-hover)] text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Start Your Journey
              </Link>
              <Link
                to="/login"
                className="border-2 border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-text)] px-8 py-4 rounded-lg text-lg font-semibold transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl"></div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-[var(--color-surface)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-[var(--color-primary)] mb-2">10K+</div>
              <div className="text-[var(--color-text-secondary)]">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[var(--color-accent)] mb-2">500+</div>
              <div className="text-[var(--color-text-secondary)]">Communities</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[var(--color-success)] mb-2">99.9%</div>
              <div className="text-[var(--color-text-secondary)]">Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[var(--color-warning)] mb-2">24/7</div>
              <div className="text-[var(--color-text-secondary)]">Decentralized</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-[var(--color-background)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[var(--color-text)] mb-4">
              How Pufferblow Works
            </h2>
            <p className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto">
              Get started with decentralized messaging in three simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                1
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text)] mb-4">
                Create Your Account
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Sign up with your email and create a secure account. Your data remains private and encrypted.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                2
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text)] mb-4">
                Join Communities
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Discover and join decentralized servers. Connect with friends and communities that share your interests.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-success)] to-[var(--color-primary)] rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                3
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text)] mb-4">
                Start Chatting
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Enjoy real-time messaging with voice channels, file sharing, and all your favorite Discord features.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-[var(--color-background-secondary)] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[var(--color-text)] mb-4">
              Why Choose Pufferblow?
            </h2>
            <p className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto">
              Built for the modern world with decentralization at its core
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Card 1 */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-[var(--color-border)]">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text)] mb-4">
                Enhanced Privacy
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Your messages are encrypted and distributed across decentralized nodes.
                No single point of failure, no centralized data collection.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-[var(--color-border)]">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-success)] to-[var(--color-primary)] rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text)] mb-4">
                Lightning Fast
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Optimized for speed with real-time messaging, voice channels,
                and seamless file sharing across all your devices.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-[var(--color-border)]">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text)] mb-4">
                Community Focused
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Create servers, organize channels, and build communities around
                your interests with powerful moderation tools.
              </p>
            </div>

            {/* Feature Card 4 */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-[var(--color-border)]">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-warning)] to-[var(--color-primary)] rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text)] mb-4">
                Always Online
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Decentralized architecture ensures your communities stay online
                even if some nodes go down. 99.9% uptime guaranteed.
              </p>
            </div>

            {/* Feature Card 5 */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-[var(--color-border)]">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-error)] to-[var(--color-accent)] rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text)] mb-4">
                Cross-Platform
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Access your conversations from any device. Desktop, mobile,
                web - your communities are always at your fingertips.
              </p>
            </div>

            {/* Feature Card 6 */}
            <div className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-[var(--color-border)]">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-info)] to-[var(--color-primary)] rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text)] mb-4">
                Open Source
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Built by the Pufferblow organization on GitHub. Both client and API
                source code are publicly available. Contribute to the platform,
                suggest features, and help shape the future of decentralized messaging.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="py-24 bg-[var(--color-background-secondary)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[var(--color-text)] mb-4">
              Experience the Interface
            </h2>
            <p className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto">
              A familiar Discord-like experience with decentralized messaging at its core
            </p>
          </div>

          {/* Dashboard Preview */}
          <div className="bg-[var(--color-surface)] rounded-2xl shadow-lg border border-[var(--color-border)] overflow-hidden">
            <div className="h-screen max-h-96 flex font-sans gap-2 p-2 select-none">
              {/* Server Sidebar */}
              <div className="w-16 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] flex flex-col items-center py-3 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--color-border-secondary)] scrollbar-track-transparent">
                {/* Pufferblow Logo */}
                <div className="w-12 h-12 bg-[#5865f2] rounded-2xl flex items-center justify-center mb-2 hover:rounded-xl hover:bg-[#4752c4] transition-all duration-200 cursor-pointer group relative">
                  <img
                    src="/pufferblow-art-pixel-32x32.png"
                    alt="Pufferblow"
                    className="w-8 h-8"
                  />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#23a559] rounded-full border-2 border-[#1e1f22] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>

                <div className="w-8 h-px bg-[#35373c] rounded"></div>

                {/* Server Icons */}
                <div className="w-12 h-12 bg-[#313338] rounded-2xl flex items-center justify-center hover:rounded-xl hover:bg-[#404eed] transition-all duration-200 cursor-pointer group relative">
                  <span className="text-white font-semibold text-lg">G</span>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#23a559] rounded-full border-2 border-[#1e1f22] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <div className="w-12 h-12 bg-[#313338] rounded-2xl flex items-center justify-center hover:rounded-xl hover:bg-[#22c55e] transition-all duration-200 cursor-pointer group relative">
                  <span className="text-white font-semibold text-lg">D</span>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#f59e0b] rounded-full border-2 border-[#1e1f22] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <div className="w-12 h-12 bg-[#313338] rounded-2xl flex items-center justify-center hover:rounded-xl hover:bg-[#ef4444] transition-all duration-200 cursor-pointer group relative">
                  <span className="text-white font-semibold text-lg">T</span>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#23a559] rounded-full border-2 border-[#1e1f22] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>

                {/* Add Server Button */}
                <div className="w-12 h-12 bg-[#313338] rounded-2xl flex items-center justify-center hover:rounded-xl hover:bg-[#23a559] transition-all duration-200 cursor-pointer group">
                  <svg className="w-6 h-6 text-[#b5bac1] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
              </div>

              {/* Channel Sidebar */}
              <div className="w-60 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] flex flex-col resize-x min-w-48 max-w-96">
                {/* Server Header */}
                <div className="h-12 px-4 flex items-center justify-between border-b border-gray-800 shadow-sm">
                  <h1 className="text-white font-semibold">General Server</h1>
                  <svg className="w-4 h-4 text-gray-400 cursor-pointer hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Channel List */}
                <div className="flex-1 overflow-y-auto">
                  {/* Text Channels */}
                  <div className="px-2 py-4">
                    <div className="flex items-center px-2 mb-1">
                      <svg className="w-3 h-3 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Text Channels</span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center px-2 py-1 rounded hover:bg-gray-600 cursor-pointer bg-gray-600">
                        <span className="text-gray-400 mr-2">#</span>
                        <span className="text-gray-300 text-sm">general</span>
                      </div>
                      <div className="flex items-center px-2 py-1 rounded hover:bg-gray-600 cursor-pointer">
                        <span className="text-gray-400 mr-2">#</span>
                        <span className="text-gray-400 text-sm">random</span>
                      </div>
                      <div className="flex items-center px-2 py-1 rounded hover:bg-gray-600 cursor-pointer">
                        <span className="text-gray-400 mr-2">#</span>
                        <span className="text-gray-400 text-sm">development</span>
                      </div>
                    </div>
                  </div>

                  {/* Voice Channels */}
                  <div className="px-2 py-2">
                    <div className="flex items-center px-2 mb-1">
                      <svg className="w-3 h-3 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Voice Channels</span>
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center px-2 py-1 rounded hover:bg-gray-600 cursor-pointer">
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                        <span className="text-gray-400 text-sm">General</span>
                      </div>
                      <div className="flex items-center px-2 py-1 rounded hover:bg-gray-600 cursor-pointer">
                        <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                        <span className="text-gray-400 text-sm">Gaming</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* User Panel */}
                <div className="h-14 bg-gray-800 px-2 flex items-center">
                  <div
                    className="flex items-center flex-1 cursor-pointer hover:bg-gray-700 rounded-md transition-colors p-1 -m-1"
                  >
                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center mr-2">
                      <span className="text-white text-sm font-semibold">U</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">User</div>
                      <div className="text-gray-400 text-xs">Online</div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-600">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                      </svg>
                    </button>
                    <Link to="/settings" className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-600">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Main Chat Area */}
              <div className="flex-1 flex flex-col bg-gray-800 rounded-xl shadow-lg border border-gray-600 resize-x min-w-96">
                {/* Channel Header */}
                <div className="h-12 px-4 flex items-center justify-between border-b border-gray-700 bg-gray-800">
                  <div className="flex items-center">
                    <span className="text-gray-400 mr-2">#</span>
                    <h2 className="text-white font-semibold">general</h2>
                    <div className="ml-2 text-gray-400 text-sm">Decentralized general discussion</div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <svg className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <svg className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <button className="w-5 h-5 text-gray-400 hover:text-white transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </button>
                    <svg className="w-5 h-5 text-gray-400 cursor-pointer hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Welcome Message */}
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <img
                        src="/pufferblow-art-pixel-32x32.png"
                        alt="Pufferblow Bot"
                        className="w-6 h-6"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-white font-medium select-text">Pufferblow Bot</span>
                        <span className="bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded">BOT</span>
                        <span className="text-gray-400 text-xs select-text">Today at 12:00 PM</span>
                      </div>
                      <div className="text-gray-300 select-text">
                        Welcome to Pufferblow! 🎉 This is a decentralized messaging platform similar to Discord.
                        Your messages are distributed across decentralized servers for better privacy and reliability.
                      </div>
                    </div>
                  </div>

                  {/* Sample Messages */}
                  <div className="group relative flex items-start space-x-3 px-2 py-1 rounded hover:bg-gray-700/30 transition-colors">
                    <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold">A</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-white font-medium select-text">Alice</span>
                        <span className="text-gray-400 text-xs select-text">Today at 12:05 PM</span>
                      </div>
                      <div className="text-gray-300 select-text">
                        Hey everyone! Love the decentralized approach. No more worrying about server downtime! 🚀
                      </div>
                    </div>
                  </div>

                  <div className="group relative flex items-start space-x-3 px-2 py-1 rounded hover:bg-gray-700/30 transition-colors">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold">B</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium select-text">Bob</span>
                          <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">ADMIN</span>
                        </div>
                        <span className="text-gray-400 text-xs select-text">Today at 12:07 PM</span>
                      </div>
                      <div className="text-gray-300 select-text">
                        The UI looks great! Very familiar coming from Discord. How does the decentralization work exactly?
                      </div>
                    </div>
                  </div>

                  <div className="group relative flex items-start space-x-3 px-2 py-1 rounded hover:bg-gray-700/30 transition-colors">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold">C</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium select-text">Charlie</span>
                          <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">MOD</span>
                        </div>
                        <span className="text-gray-400 text-xs select-text">Today at 12:10 PM</span>
                      </div>
                      <div className="text-gray-300 select-text">
                        @Bob The messages are distributed across multiple nodes in the network. Even if some servers go down,
                        your messages remain accessible through other nodes. Pretty cool tech! 💪
                      </div>
                    </div>
                  </div>
                </div>

                {/* Message Input */}
                <div className="p-4">
                  <div className="bg-gray-600 rounded-lg px-4 py-3">
                    <div className="flex items-end space-x-3">
                      {/* File Upload Button */}
                      <label className="flex-shrink-0">
                        <input
                          type="file"
                          multiple
                          className="hidden"
                        />
                        <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-500 transition-colors text-gray-400 hover:text-white">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        </button>
                      </label>

                      {/* Message Input */}
                      <div className="flex-1">
                        <div className="text-gray-400 text-sm">Message #general</div>
                      </div>

                      {/* Emoji Button */}
                      <button className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-gray-500 text-gray-400 hover:text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l.707.707A1 1 0 0012.414 11H13m-3 3.5a.5.5 0 11-1 0 .5.5 0 011 0zM16 7a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>

                      {/* Send Button */}
                      <button className="w-8 h-8 flex items-center justify-center rounded transition-colors bg-blue-600 hover:bg-blue-700 text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Member List */}
              <div className="w-60 bg-[var(--color-surface)] rounded-xl shadow-lg border border-[var(--color-border)] p-4 flex flex-col">
                {/* Header with close button */}
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Members</h3>
                </div>

                {/* Scrollable member content */}
                <div className="flex-1 overflow-y-auto">
                  {/* Admin Section */}
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2 bg-[var(--color-surface-tertiary)] px-2 py-1 rounded border border-[var(--color-border)]">Admin — 1</h4>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-3 px-3 py-2 rounded-xl border border-[var(--color-border)]">
                        <div className="relative">
                          <div className="w-8 h-8 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center shadow-md border-2 border-red-300">
                            <span className="text-white text-xs font-bold drop-shadow-sm">B</span>
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[var(--color-surface)] shadow-sm"></div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[var(--color-text)] text-sm font-semibold drop-shadow-sm select-text">Bob</span>
                          <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">ADMIN</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Moderators Section */}
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2 bg-[var(--color-surface-tertiary)] px-2 py-1 rounded border border-[var(--color-border)]">Moderators — 1</h4>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-3 px-3 py-2 rounded-xl border border-[var(--color-border)]">
                        <div className="relative">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center shadow-md border-2 border-purple-400/50">
                            <span className="text-white text-xs font-bold drop-shadow-sm">C</span>
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[var(--color-surface)] shadow-sm"></div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[var(--color-text)] text-sm font-semibold drop-shadow-sm select-text">Charlie</span>
                          <span className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">MOD</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Members Section */}
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2 bg-[var(--color-surface-tertiary)] px-2 py-1 rounded border border-[var(--color-border)]">Members — 2</h4>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-3 px-3 py-2 rounded-xl border border-[var(--color-border)]">
                        <div className="relative">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md border-2 border-blue-400/50">
                            <span className="text-white text-xs font-bold drop-shadow-sm">U</span>
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[var(--color-surface)] shadow-sm"></div>
                        </div>
                        <span className="text-[var(--color-text)] text-sm font-semibold drop-shadow-sm select-text">User</span>
                      </div>
                      <div className="flex items-center space-x-3 px-3 py-2 rounded-xl border border-[var(--color-border)]">
                        <div className="relative">
                          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-md border-2 border-green-400/50">
                            <span className="text-white text-xs font-bold drop-shadow-sm">A</span>
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[var(--color-surface)] shadow-sm"></div>
                        </div>
                        <span className="text-[var(--color-text)] text-sm font-semibold drop-shadow-sm select-text">Alice</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <p className="text-[var(--color-text-secondary)]">
              Join communities, create servers, and chat with friends in a decentralized environment
            </p>
          </div>
        </div>
      </section>



      {/* Newsletter Section */}
      <section className="py-16 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold text-[var(--color-text)] mb-4">
            Stay Updated
          </h3>
          <p className="text-[var(--color-text-secondary)] mb-8">
            Get the latest updates on Pufferblow's development and be the first to know about new features.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <button className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-accent-hover)] text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200">
              Subscribe
            </button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Join the Decentralized Revolution?
          </h2>
          <p className="text-xl text-[var(--color-text-secondary)] mb-8">
            Create your account today and experience messaging like never before.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="bg-white text-[var(--color-primary)] hover:bg-[var(--color-background-secondary)] px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
              Create Your Account
            </Link>
            <Link
              to="/login"
              className="border-2 border-white text-white hover:bg-white hover:text-[var(--color-primary)] px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--color-surface)] text-[var(--color-text)] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <img
                src="/pufferblow-art-pixel-64x64.png"
                alt="Pufferblow Logo"
                className="h-8 w-8"
              />
              <span className="text-xl font-bold">Pufferblow</span>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
                Terms of Service
              </a>
              <a href="#" className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
                Support
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
