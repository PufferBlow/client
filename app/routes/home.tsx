import type { Route } from "./+types/home";
import { Link } from "react-router";
import { useState, useEffect } from "react";
import { Navigate } from "react-router";

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

    return !!(cookies.auth_token && cookies.auth_token.trim() !== '');
    };

    setIsAuthenticated(checkAuth());
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Navigation */}
      <nav className="bg-gradient-to-r from-[var(--color-surface)]/95 to-[var(--color-background-secondary)]/95 backdrop-blur-xl border-b border-[var(--color-border)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <div className="flex flex-col cursor-pointer group">
                <h1 className="text-4xl font-black text-[var(--color-text)] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent group-hover:scale-105 transition-transform duration-200">
                  Pufferblow
                </h1>
                <span className="text-base text-[var(--color-text-secondary)] font-semibold group-hover:text-[var(--color-text)] transition-colors duration-200">Decentralized Messaging</span>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:from-[var(--color-primary-hover)] hover:to-[#6e9cf1] text-white px-8 py-4 rounded-2xl text-lg font-bold transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-[0_25px_50px_rgba(94,129,172,0.3)] flex items-center gap-3 group"
                >
                  <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="tracking-wide">Dashboard</span>
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-[var(--color-surface-secondary)]"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:from-[var(--color-primary-hover)] hover:to-[#6e9cf1] text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-2xl"
                  >
                    Get Started Free
                  </Link>
                </>
              )}
              <a
                href="https://pufferblow.github.io/pufferblow"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-[var(--color-surface-secondary)]"
                title="View documentation"
              >
                Docs
              </a>
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

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[var(--color-background)] via-[var(--color-background)] to-[var(--color-background-secondary)]">
        <div className="absolute inset-0 opacity-5">
          <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)] via-transparent to-[var(--color-accent)]"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 lg:py-40">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-[var(--color-surface)]/50 backdrop-blur-sm border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium mb-8">
              <svg className="w-4 h-4 mr-2 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Now in public beta • Join thousands of early adopters
            </div>

            <h1 className="text-6xl md:text-8xl font-black text-[var(--color-text)] mb-8 leading-none">
              Decentralized
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent)] to-[var(--color-secondary)] animate-pulse">
                Messaging
              </span>
              <span className="block text-4xl md:text-5xl font-bold text-[var(--color-text-secondary)] font-light">
                Built for Tomorrow
              </span>
            </h1>

            <p className="text-2xl md:text-3xl text-[var(--color-text-secondary)] mb-12 max-w-4xl mx-auto leading-relaxed font-light">
              Experience Discord-like messaging with the power of decentralization. Your conversations are distributed across multiple nodes for unmatched privacy, security, and reliability.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
              <Link
                to="/signup"
                className="group bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent)] to-[var(--color-secondary)] hover:from-[var(--color-primary-hover)] hover:via-[#6e9cf1] hover:to-[var(--color-secondary-hover)] text-white px-10 py-5 rounded-2xl text-xl font-bold transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-[0_25px_50px_rgba(94,129,172,0.25)] flex items-center gap-3"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Create Account
              </Link>

              {!isAuthenticated && (
                <Link
                  to="/login"
                  className="border-3 border-[var(--color-border-secondary)] text-[var(--color-text)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] px-10 py-5 rounded-2xl text-xl font-semibold transition-all duration-300 transform hover:scale-105 backdrop-blur-sm bg-[var(--color-surface)]/30 hover:bg-[var(--color-surface)]/50"
                >
                  Sign In
                </Link>
              )}

              <Link
                to="/download"
                className="border-3 border-[var(--color-border-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--color-success)] hover:text-[var(--color-success)] px-10 py-5 rounded-2xl text-xl font-semibold transition-all duration-300 transform hover:scale-105 backdrop-blur-sm bg-[var(--color-surface)]/30 hover:bg-[var(--color-surface)]/50 flex items-center gap-3"
                title="Download Desktop App"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download App
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-[var(--color-text-secondary)] text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                End-to-end encrypted
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Lightning fast
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Decentralized architecture
              </div>
            </div>
          </div>
        </div>

        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
          <div className="absolute top-20 -left-40 w-[600px] h-[600px] bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-accent)]/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 -right-40 w-[600px] h-[600px] bg-gradient-to-r from-[var(--color-secondary)]/10 to-[var(--color-success)]/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-[var(--color-info)]/5 to-[var(--color-warning)]/5 rounded-full blur-3xl animate-pulse" style={{animationDelay: '4s'}}></div>
        </div>

        <div className="absolute top-32 left-16 w-3 h-3 bg-[var(--color-primary)] rounded-full opacity-60 animate-bounce" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-48 right-24 w-2 h-2 bg-[var(--color-accent)] rounded-full opacity-60 animate-bounce" style={{animationDelay: '3s'}}></div>
        <div className="absolute bottom-32 left-1/4 w-4 h-4 bg-[var(--color-secondary)] rounded-full opacity-60 animate-bounce" style={{animationDelay: '5s'}}></div>
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
                Your messages are encrypted and distributed across decentralized nodes. No single point of failure, no centralized data collection.
              </p>
            </div>

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
                Optimized for speed with real-time messaging, voice channels, and seamless file sharing across all your devices.
              </p>
            </div>

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
                Create servers, organize channels, and build communities around your interests with powerful moderation tools.
              </p>
            </div>

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
                Decentralized architecture ensures your communities stay online even if some nodes go down. 99.9% uptime guaranteed.
              </p>
            </div>

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
                Access your conversations from any device. Desktop, mobile, web - your communities are always at your fingertips.
              </p>
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-[var(--color-border)]">
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-info)] to-[var(--color-primary)] rounded-2xl flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-[var(--color-text)] mb-4">
                Open Source & Host Your Own
              </h3>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                Built by the Pufferblow organization on GitHub. Both client and API source code are publicly available.
                <a
                  href="https://pufferblow.github.io/pufferblow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] font-semibold underline decoration-2 underline-offset-2 transition-colors duration-200"
                >
                  Learn how to host your own server
                </a>
                and join the decentralized network. Contribute to the platform and shape its future!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Dashboard Demo Section */}
      <section className="py-32 bg-gradient-to-br from-[var(--color-background)] to-[var(--color-background-secondary)] relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-32 h-32 bg-[var(--color-primary)]/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-[var(--color-accent)]/10 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-[var(--color-surface)]/50 backdrop-blur-sm border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium mb-6">
              <svg className="w-4 h-4 mr-2 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Live Interactive Preview
            </div>

            <h2 className="text-5xl md:text-6xl font-black text-[var(--color-text)] mb-6 leading-tight">
              Try It Before You Sign Up
            </h2>
            <p className="text-xl md:text-2xl text-[var(--color-text-secondary)] max-w-3xl mx-auto leading-relaxed">
              Explore the Pufferblow interface in an interactive demo.
              <span className="text-[var(--color-primary)] font-semibold"> Click around, explore channels, and experience the Nord theme firsthand.</span>
            </p>
          </div>

          {/* Enhanced Interactive Dashboard Mockup */}
          <div className="relative max-w-6xl mx-auto">
            {/* Floating accent elements */}
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-[var(--color-primary)] rounded-full opacity-60 animate-bounce" style={{animationDelay: '1s'}}></div>
            <div className="absolute -bottom-6 -right-6 w-6 h-6 bg-[var(--color-accent)] rounded-full opacity-60 animate-bounce" style={{animationDelay: '3s'}}></div>

            <div className="bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-3xl shadow-2xl border border-[var(--color-border)] overflow-hidden backdrop-blur-sm">
              {/* Browser-like top bar */}
              <div className="h-10 bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)] flex items-center px-4 space-x-2">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-[var(--color-background)] rounded-lg px-4 py-1 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                    pufferblow.app/dashboard
                  </div>
                </div>
              </div>

              {/* Dashboard Content */}
              <div className="h-[600px] flex font-sans gap-3 p-3 relative">
                {/* Server Sidebar with Nord Colors */}
                <div className="w-16 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border-secondary)] flex flex-col items-center py-4 space-y-3 backdrop-blur-sm">
                  {/* Pufferblow Logo */}
                  <div className="w-12 h-12 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] rounded-2xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer group">
                    <img
                      src="/pufferblow-art-pixel-32x32.png"
                      alt="Pufferblow"
                      className="w-8 h-8"
                    />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--color-success)] rounded-full border-2 border-[var(--color-surface)] shadow-md animate-pulse"></div>
                  </div>

                  <div className="w-8 h-px bg-[var(--color-border)] rounded"></div>

                  {/* Current Server */}
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer group relative bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)]">
                    <span className="text-white font-bold text-lg">WS</span>
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#23a559] rounded-full border-2 border-[var(--color-surface)] opacity-100"></div>
                  </div>

                  {/* Add Server Button */}
                  <div className="w-12 h-12 bg-[#313338] rounded-2xl flex items-center justify-center hover:rounded-xl hover:bg-[#23a559] transition-all duration-200 cursor-pointer group mt-auto">
                    <svg className="w-6 h-6 text-[#b5bac1] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                </div>

                {/* Channel Sidebar with Nord Theme */}
                <div className="w-64 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] flex flex-col backdrop-blur-sm">
                  {/* Server Header Enhanced */}
                  <div className="relative h-24 w-full group cursor-pointer">
                    <img
                      src="data:image/svg+xml,%3Csvg width='400' height='96' viewBox='0 0 400 96' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='grad1' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23BF616A;stop-opacity:1' /%3E%3Cstop offset='50%25' style='stop-color:%235E81AC;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%238FBCBB;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='96' fill='url(%23grad1)'/%3E%3Ctext x='40' y='32' font-family='Arial, sans-serif' font-size='14' font-weight='bold' fill='%23ECEFF4'%3EWelcome Server%3C/text%3E%3Ctext x='40' y='50' font-family='Arial, sans-serif' font-size='12' fill='%23D8DEE9'%3EDecentralized Community%3C/text%3E%3C/svg%3E"
                      alt="Welcome Server Banner"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
                    <div className="absolute bottom-3 left-3 flex items-center space-x-3">
                      <div className="w-10 h-10 bg-[var(--color-primary)] rounded-2xl flex items-center justify-center border-3 border-white/80 shadow-lg">
                        <span className="text-white font-bold text-sm">WS</span>
                      </div>
                    </div>
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Channel List with Nord Colors */}
                  <div className="flex-1 p-4 space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2 flex items-center">
                        <svg className="w-3 h-3 mr-2 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Text Channels
                      </h3>
                      <div className="space-y-1">
                        <div className="flex items-center px-3 py-2 rounded-xl bg-[var(--color-surface-tertiary)] hover:bg-[var(--color-hover)] transition-colors cursor-pointer group">
                          <span className="text-[var(--color-text-secondary)] mr-2 text-sm">#</span>
                          <span className="text-[var(--color-text)] font-medium">welcome</span>
                          <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex items-center px-3 py-2 rounded-xl hover:bg-[var(--color-hover)] transition-colors cursor-pointer group">
                          <span className="text-[var(--color-text-secondary)] mr-2 text-sm">#</span>
                          <span className="text-[var(--color-text-secondary)]">announcements</span>
                        </div>
                        <div className="flex items-center px-3 py-2 rounded-xl hover:bg-[var(--color-hover)] transition-colors cursor-pointer group">
                          <span className="text-[var(--color-text-secondary)] mr-2 text-sm">#</span>
                          <span className="text-[var(--color-text-secondary)]">general</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-[var(--color-border)] pt-4">
                      <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2 flex items-center">
                        <svg className="w-3 h-3 mr-2 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        Voice Channels
                      </h3>
                      <div className="space-y-1">
                        <div className="flex items-center px-3 py-2 rounded-xl hover:bg-[var(--color-hover)] transition-colors cursor-pointer group">
                          <svg className="w-4 h-4 text-[var(--color-success)] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                          <span className="text-[var(--color-text-secondary)]">General Voice</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* User Panel */}
                  <div className="h-14 bg-[var(--color-surface-secondary)] border-t border-[var(--color-border)] px-3 flex items-center">
                    <div className="flex items-center flex-1 cursor-pointer hover:bg-[var(--color-hover)] rounded-lg transition-colors p-2 -mx-2">
                      <div className="w-8 h-8 bg-[#A3BE8C] rounded-full flex items-center justify-center mr-3 border-2 border-[var(--color-border)]">
                        <span className="text-white font-semibold text-sm">JD</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[var(--color-text)] text-sm font-medium truncate">John Doe</div>
                        <div className="text-[var(--color-success)] text-xs font-medium">#1234</div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button className="w-6 h-6 rounded hover:bg-[var(--color-surface-tertiary)] flex items-center justify-center transition-colors">
                          <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        </button>
                        <button className="w-6 h-6 rounded hover:bg-[var(--color-surface-tertiary)] flex items-center justify-center transition-colors">
                          <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Chat Area with Nord Theme */}
                <div className="flex-1 flex flex-col bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] backdrop-blur-sm">
                  {/* Channel Header */}
                  <div className="h-12 px-6 flex items-center justify-between border-b border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)]">
                    <div className="flex items-center space-x-3">
                      <span className="text-[var(--color-text-secondary)] text-lg">#</span>
                      <h2 className="text-[var(--color-text)] font-semibold">welcome</h2>
                      <div className="w-px h-6 bg-[var(--color-border)]"></div>
                      <span className="text-[var(--color-text-muted)] text-sm">Welcome to Pufferblow! 🎉</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="w-8 h-8 rounded-lg hover:bg-[var(--color-hover)] flex items-center justify-center transition-colors">
                        <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </button>
                      <button className="w-8 h-8 rounded-lg hover:bg-[var(--color-hover)] flex items-center justify-center transition-colors">
                        <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </button>
                      <button className="w-8 h-8 rounded-lg hover:bg-[var(--color-hover)] flex items-center justify-center transition-colors mr-2">
                        <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Welcome Message */}
                    <div className="flex items-start space-x-3 group">
                      <div className="relative">
                        <img
                          src="/pufferblow-art-pixel-32x32.png"
                          alt="Pufferblow"
                          className="w-10 h-10 rounded-full border-2 border-[var(--color-border)] shadow-sm"
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[var(--color-success)] rounded-full border-2 border-[var(--color-surface)]"></div>
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-baseline space-x-2">
                          <span className="text-[var(--color-text)] font-semibold">Pufferblow</span>
                          <span className="bg-[var(--color-primary)] text-white text-xs px-2 py-0.5 rounded-full font-medium">BOT</span>
                          <span className="text-[var(--color-text-muted)] text-xs">Today at 2:31 PM</span>
                        </div>
                        <div className="text-[var(--color-text-secondary)] leading-relaxed">
                          Welcome to <span className="text-[var(--color-primary)] font-semibold">Pufferblow</span>! 🎉<br/>
                          This is our <span className="text-[var(--color-accent)]">decentralized messaging platform</span> designed to give you better privacy and control over your conversations.
                        </div>
                      </div>
                    </div>

                    {/* Member Message */}
                    <div className="flex items-start space-x-3 group">
                      <div className="relative">
                        <div className="w-10 h-10 bg-[#88C0D0] rounded-full flex items-center justify-center border-2 border-[var(--color-border)] shadow-sm">
                          <span className="text-white font-semibold text-sm">JD</span>
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[var(--color-success)] rounded-full border-2 border-[var(--color-surface)]"></div>
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-baseline space-x-2">
                          <span className="text-[var(--color-text)] font-semibold hover:underline cursor-pointer">John Doe</span>
                          <span className="text-[var(--color-text-muted)] text-xs">Today at 2:32 PM</span>
                        </div>
                        <div className="text-[var(--color-text-secondary)] leading-relaxed">
                          This interface looks amazing! The Nord theme really makes it feel polished and modern. Can't wait to try it out! 🚀
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="w-6 h-6 rounded hover:bg-[var(--color-surface-secondary)] flex items-center justify-center">
                          <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Message Input Area */}
                  <div className="p-6 border-t border-[var(--color-border-secondary)]">
                    <div className="bg-[var(--color-surface-secondary)] rounded-2xl px-4 py-3 border border-[var(--color-border)] shadow-inner">
                      <div className="flex items-end space-x-4">
                        <div className="flex-1">
                          <div className="text-[var(--color-text-secondary)] text-sm mb-1">Message #welcome</div>
                          <input
                            type="text"
                            placeholder="Type your message..."
                            className="w-full bg-transparent text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <button className="w-8 h-8 rounded-xl hover:bg-[var(--color-hover)] flex items-center justify-center transition-colors">
                            <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                          </button>
                          <button className="w-8 h-8 rounded-xl hover:bg-[var(--color-hover)] flex items-center justify-center transition-colors">
                            <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l.707.707A1 1 0 0012.414 11H13m-3 3.5a.5.5 0 11-1 0 .5.5 0 011 0zM16 7a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Member List with Nord Theme */}
                <div className="w-64 opacity-90">
                  <div className="w-64 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-secondary)] rounded-2xl shadow-xl border border-[var(--color-border)] flex flex-col backdrop-blur-sm h-full">
                    <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
                      <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Members - 12</h3>
                      <button className="w-6 h-6 rounded-lg hover:bg-[var(--color-hover)] flex items-center justify-center transition-colors">
                        <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 p-4 space-y-6">
                      {/* Online Members */}
                      <div>
                        <h4 className="text-xs font-bold text-[var(--color-success)] uppercase tracking-wide mb-3 flex items-center">
                          <div className="w-2 h-2 bg-[var(--color-success)] rounded-full mr-2"></div>
                          Online — 8
                        </h4>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-[var(--color-hover)] transition-colors cursor-pointer">
                            <div className="relative">
                              <div className="w-8 h-8 bg-[#A3BE8C] rounded-full flex items-center justify-center border-2 border-[var(--color-border)]">
                                <span className="text-white text-xs font-bold">JD</span>
                              </div>
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[var(--color-success)] rounded-full border-2 border-[var(--color-surface)]"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[var(--color-text)] text-sm font-medium truncate">John Doe</div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-[var(--color-hover)] transition-colors cursor-pointer">
                            <div className="relative">
                              <div className="w-8 h-8 bg-[#88C0D0]/80 rounded-full flex items-center justify-center border-2 border-[var(--color-border)]">
                                <span className="text-white text-xs font-bold">SJ</span>
                              </div>
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#EBCB8B] rounded-full border-2 border-[var(--color-surface)]"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[var(--color-text)] text-sm font-medium truncate">Sarah Jane</div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-[var(--color-hover)] transition-colors cursor-pointer">
                            <div className="relative">
                              <div className="w-8 h-8 bg-[#BF616A]/80 rounded-full flex items-center justify-center border-2 border-[var(--color-border)]">
                                <span className="text-white text-xs font-bold">MB</span>
                              </div>
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-[var(--color-surface)]"></div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[var(--color-text)] text-sm font-medium truncate">Mike Brown</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Offline Members */}
                      <div>
                        <h4 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3 flex items-center">
                          <div className="w-2 h-2 bg-[var(--color-text-muted)] rounded-full mr-2"></div>
                          Offline — 4
                        </h4>
                        <div className="space-y-2 opacity-50">
                          <div className="flex items-center space-x-3 px-3 py-2 rounded-xl">
                            <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center border-2 border-[var(--color-border)]">
                              <span className="text-white text-xs font-bold">AW</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[var(--color-text-secondary)] text-sm font-medium truncate">Alex Wilson</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center mt-8">
              <p className="text-lg text-[var(--color-text-secondary)] font-medium">
                ✨ <span className="text-[var(--color-primary)]">Nord-themed interface</span> with modern gradients, smooth animations, and elegant typography
              </p>
              <div className="mt-6 text-sm text-[var(--color-text-muted)]">
                🎨 Built with <span className="text-[var(--color-accent)]">CSS custom properties</span> • 🚀 Powered by <span className="text-[var(--color-success)]">React & TypeScript</span>
              </div>
            </div>
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
            {!isAuthenticated && (
              <Link
                to="/login"
                className="border-2 border-white text-white hover:bg-white hover:text-[var(--color-primary)] px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--color-surface)] text-[var(--color-text)] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <span className="text-xl font-black text-[var(--color-text)] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent cursor-pointer">Pufferblow</span>
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


// 2025-10-18 19:02:14.149 | ERROR    | pufferblow.api.background_tasks.background_tasks_manager:_update_online_users_chart:892 - Failed to update online users chart: hour must be in 0..23
// 2025-10-18 19:02:14.149 | ERROR    | pufferblow.api.background_tasks.background_tasks_manager:update_chart_data:699 - Chart data update failed: hour must be in 0..23
// 2025-10-18 19:02:14.150 | ERROR    | pufferblow.api.background_tasks.background_tasks_manager:run_task:186 - Background task chart_data_update failed: hour must be in 0..23
