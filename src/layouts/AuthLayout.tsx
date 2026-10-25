import { useState } from "react";
import { Outlet } from "react-router";
import { AuthArt } from "../components/auth/AuthArt";
import { BrandLockup } from "@pufferblow/spines";
import type { AuthArtState, AuthLayoutContext } from "./authLayoutContext";

export function AuthLayout() {
  const [art, setArt] = useState<AuthArtState>({ instance: null, info: null });

  return (
    <div className="grid h-full w-full gap-2.5 bg-background p-2.5 lg:grid-cols-[minmax(0,1fr)_460px]">
      <AuthArt instance={art.instance} info={art.info} />

      <main className="flex min-h-0 flex-col overflow-y-auto rounded-lg bg-surface px-6 py-10 sm:px-10 lg:py-12">
        <BrandLockup size={34} className="mb-8 lg:hidden" />
        <Outlet context={{ setArt } satisfies AuthLayoutContext} />
      </main>
    </div>
  );
}
