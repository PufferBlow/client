/**
 * In-renderer splash overlay shown during account switching.
 *
 * The Electron splash window (electron/splash.html) only renders at
 * app boot — it doesn't reappear when the renderer hard-reloads. To
 * give a switch the same "rapid restart" feel, we paint this
 * full-viewport overlay in the renderer for the moment between
 * "user clicked an account" and "window.location.assign reloads the
 * SPA." The overlay then disappears naturally when the new tree
 * mounts post-reload, because the React state holding it goes away
 * with the previous renderer instance.
 *
 * Visually mirrors the Electron splash so the two surfaces feel
 * like one continuous loading screen — same logo, same slogan, same
 * indeterminate progress bar. Pure CSS / SVG, no external assets.
 */
export function SwitchAccountSplash() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-[#0a0a0a] text-[#fafafa]">
      <div
        className="h-[88px] w-[88px]"
        aria-hidden
        style={{ animation: "pbSplashBreathe 2.6s ease-in-out infinite" }}
      >
        <svg
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full overflow-visible"
        >
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: "pbSplashRotate 9s linear infinite",
            }}
          >
            {[
              [82, 50],
              [18, 50],
              [50, 82],
              [50, 18],
              [73, 73],
              [27, 27],
              [27, 73],
              [73, 27],
            ].map(([x, y]) => (
              <line
                key={`${x}-${y}`}
                x1={50}
                y1={50}
                x2={x}
                y2={y}
                stroke="#fafafa"
                strokeWidth={3.2}
                strokeLinecap="round"
              />
            ))}
            <circle cx={50} cy={50} r={21} fill="#0a0a0a" />
            <circle cx={50} cy={50} r={21} fill="none" stroke="#fafafa" strokeWidth={3.2} />
            <circle
              cx={50}
              cy={50}
              r={3.2}
              fill="#fafafa"
              style={{
                transformBox: "fill-box",
                transformOrigin: "center",
                animation: "pbSplashDot 2.6s ease-in-out infinite",
              }}
            />
          </g>
        </svg>
      </div>

      <div className="text-[11px] tracking-[0.32em] uppercase text-[rgba(250,250,250,0.55)]">
        Pufferblow
      </div>
      <div className="text-[22px] font-semibold tracking-[-0.02em] text-[#fafafa]">
        Create space
      </div>

      <div className="relative h-1 w-[220px] overflow-hidden rounded-full bg-[rgba(250,250,250,0.12)]">
        <div
          className="absolute inset-y-0 left-0 w-[35%] rounded-full bg-[#fafafa]"
          style={{ animation: "pbSplashIndeterminate 1.4s ease-in-out infinite" }}
        />
      </div>

      {/* Inline @keyframes so the overlay is self-contained — the
          splash window's CSS isn't shared with the renderer. Reuses
          the same animation names so anyone reading both files sees
          the relationship. */}
      <style>{`
        @keyframes pbSplashBreathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.04); }
        }
        @keyframes pbSplashRotate {
          to { transform: rotate(360deg); }
        }
        @keyframes pbSplashDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(0.85); }
        }
        @keyframes pbSplashIndeterminate {
          0%   { left: -35%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
