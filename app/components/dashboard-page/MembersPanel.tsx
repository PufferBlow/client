import type { ReactNode } from "react";

export function MembersPanel({ isVisible, children }: { isVisible: boolean; children: ReactNode }) {
  return (
    <div className={`max-xl:hidden transition-all duration-300 ease-in-out ${isVisible ? "w-72 opacity-100" : "w-0 overflow-hidden opacity-0"}`}>
      {children}
    </div>
  );
}
