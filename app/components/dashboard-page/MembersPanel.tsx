import type { ReactNode } from "react";

// Visibility breakpoint dropped from `xl` (1280px) to `lg` (1024px) so the
// members panel shows in a normal windowed Electron client, not only when
// the window is maximized. Below `lg` we still hide it because the chat
// area itself needs the horizontal space.
export function MembersPanel({ isVisible, children }: { isVisible: boolean; children: ReactNode }) {
  return (
    <div className={`max-lg:hidden transition-all duration-300 ease-in-out ${isVisible ? "w-72 opacity-100" : "w-0 overflow-hidden opacity-0"}`}>
      {children}
    </div>
  );
}
