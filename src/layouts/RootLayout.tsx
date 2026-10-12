import { Outlet } from "react-router";
import { TitleBar } from "../components/ui/TitleBar";

export function RootLayout() {
  const isElectron = typeof window !== "undefined" && !!window.electron;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-text">
      {isElectron && <TitleBar />}
      <div className="flex min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
