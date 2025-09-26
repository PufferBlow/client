import type { Route } from "./+types/home";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Pufferblow - Decentralized Messaging" },
    { name: "description", content: "Experience the future of messaging with decentralized servers, enhanced privacy, and Discord-like features." },
  ];
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Navigation */}
      <nav className="bg-[var(--color-surface)] backdrop-blur-md border-b border-[var(--color-border)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img
                src="/pufferblow-art-pixel-64x64.png"
                alt="Pufferblow Logo"
                className="h-10 w-10"
              />
              <span className="text-2xl font-bold text-[var(--color-text)]">Pufferblow</span>
            </div>
            <div className="flex items-center space-x-4">
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
                Transparent and community-driven. Contribute to the platform,
                suggest features, and help shape the future of messaging.
              </p>
            </div>
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
