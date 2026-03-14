import type { Route } from "./+types/home";
import { Link } from "react-router";
import { useState, useEffect } from "react";
import { Navigate } from "react-router";
import HomeDashboardPreview from "../components/home/HomeDashboardPreview";
import { PufferblowBrand } from "../components/PufferblowBrand";

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
              <Link to="/" className="rounded-lg pb-focus-ring">
                <PufferblowBrand
                  size={52}
                  subtitle="Fediversed Messaging"
                  surfaceColor="var(--color-surface)"
                  className="group"
                  titleClassName="text-3xl md:text-4xl group-hover:translate-x-0.5 transition-transform duration-200"
                  subtitleClassName="tracking-[0.24em] group-hover:text-[var(--color-text)] transition-colors duration-200"
                />
              </Link>
            </div>
            <div className="flex items-center space-x-6">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] px-8 py-4 text-lg font-bold text-[var(--color-on-primary)] shadow-2xl transition-all duration-300 hover:scale-105 hover:from-[var(--color-primary-hover)] hover:to-[var(--color-accent-hover)] hover:shadow-[0_25px_50px_color-mix(in_srgb,var(--color-primary)_28%,transparent)] group"
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
                    className="rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[var(--color-on-primary)] shadow-lg transition-all duration-200 hover:scale-105 hover:from-[var(--color-primary-hover)] hover:to-[var(--color-accent-hover)] hover:shadow-2xl"
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
            <div className="mb-10 flex justify-center">
              <div className="rounded-[2rem] border border-[var(--color-border-secondary)] bg-[radial-gradient(circle_at_top,rgba(245,245,220,0.08),transparent_58%),linear-gradient(180deg,rgba(28,25,25,0.92),rgba(14,13,13,0.92))] px-8 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <PufferblowBrand
                  size={92}
                  align="center"
                  subtitle="Discord-Like Chat for the Fediverse"
                  surfaceColor="var(--color-surface)"
                  className="flex-col gap-5"
                  textClassName="items-center"
                  titleClassName="text-5xl md:text-6xl"
                  subtitleClassName="text-xs md:text-sm tracking-[0.36em] text-[var(--color-text-muted)]"
                />
              </div>
            </div>

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
                className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent)] to-[var(--color-secondary)] px-10 py-5 text-xl font-bold text-[var(--color-on-primary)] shadow-2xl transition-all duration-300 hover:scale-105 hover:from-[var(--color-primary-hover)] hover:via-[var(--color-accent-hover)] hover:to-[var(--color-secondary-hover)] hover:shadow-[0_25px_50px_color-mix(in_srgb,var(--color-primary)_24%,transparent)]"
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
                title="Download Client"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Client
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
              <div className="w-16 h-16 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] rounded-full flex items-center justify-center mx-auto mb-6 text-[var(--color-on-primary)] text-2xl font-bold">
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
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] text-2xl font-bold text-[var(--color-on-primary)]">
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
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-[var(--color-success)] to-[var(--color-primary)] text-2xl font-bold text-[var(--color-on-primary)]">
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
                <svg className="w-8 h-8 text-[var(--color-on-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <svg className="w-8 h-8 text-[var(--color-on-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <svg className="w-8 h-8 text-[var(--color-on-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <svg className="w-8 h-8 text-[var(--color-on-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <svg className="w-8 h-8 text-[var(--color-on-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <svg className="w-8 h-8 text-[var(--color-on-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          <HomeDashboardPreview />
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
            <button className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] hover:from-[var(--color-primary-hover)] hover:to-[var(--color-accent-hover)] text-[var(--color-on-primary)] px-6 py-3 rounded-lg font-semibold transition-all duration-200">
              Subscribe
            </button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-[var(--color-on-primary)] mb-6">
            Ready to Join the Decentralized Revolution?
          </h2>
          <p className="text-xl text-[var(--color-text-secondary)] mb-8">
            Create your account today and experience messaging like never before.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/signup"
              className="rounded-lg bg-[var(--color-surface)] px-8 py-4 text-lg font-semibold text-[var(--color-text)] shadow-lg transition-all duration-200 hover:scale-105 hover:bg-[var(--color-hover)]"
            >
              Create Your Account
            </Link>
            {!isAuthenticated && (
              <Link
                to="/login"
                className="border-2 border-[var(--color-on-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-on-primary)] hover:text-[var(--color-primary)] px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200"
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
                <PufferblowBrand
                  size={36}
                  subtitle="Fediversed Messaging"
                  surfaceColor="var(--color-surface)"
                  titleClassName="text-2xl"
                  subtitleClassName="text-[10px] tracking-[0.24em]"
                />
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
