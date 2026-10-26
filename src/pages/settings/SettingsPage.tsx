import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router";
import { ArrowLeft, Monitor, Palette, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { ErrorState, LoadingState } from "@pufferblow/spines";
import { useMyProfile } from "../../features/users/hooks";
import { classifyAuthError } from "../../utils/authErrors";
import { DesktopSection } from "./DesktopSection";
import { AccountSection } from "./AccountSection";
import { ProfileSection } from "./ProfileSection";
import { SecuritySection } from "./SecuritySection";
import { lastAppLocation } from "../../features/navigation/lastAppLocation";

const SECTIONS = [
  { id: "account", label: "My account", icon: UserRound },
  { id: "profile", label: "Profile", icon: Palette },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "desktop", label: "Desktop app", icon: Monitor },
] as const satisfies readonly { id: string; label: string; icon: LucideIcon }[];

type SectionId = (typeof SECTIONS)[number]["id"];
/** Tray and updates belong to the desktop app; a browser has no such section. */
const inDesktop = () => typeof window !== "undefined" && !!window.electron;
const sectionsHere = () => SECTIONS.filter((s) => s.id !== "desktop" || inDesktop());
const isSection = (value: string | undefined): value is SectionId => sectionsHere().some((s) => s.id === value);

export function SettingsPage() {
  const { section } = useParams();

  useEffect(() => {
    // Settings isn't a good place to land on next launch; keep the chat view as the resume point.
    localStorage.setItem("pb_last_route", "/dashboard");
  }, []);

  const { data: profile, error, isPending, refetch } = useMyProfile();

  if (section !== undefined && !isSection(section)) return <Navigate to="/settings" replace />;
  const active: SectionId = isSection(section) ? section : "account";

  return (
    <>
      <aside className="flex w-[244px] shrink-0 flex-col gap-1 overflow-y-auto rounded-lg bg-surface p-2.5 max-md:hidden">
        <Link
          to={lastAppLocation()}
          className="mb-2 flex h-10 items-center gap-2.5 rounded-md px-3 text-[14.5px] text-text-tertiary hover:bg-surface-secondary hover:text-text"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to app
        </Link>
        <h2 className="m-0 px-3 pb-1.5 pt-2 font-heading text-[11.5px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          Settings
        </h2>
        <nav aria-label="Settings sections" className="flex flex-col gap-0.5">
          {sectionsHere().map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              to={`/settings/${id}`}
              aria-current={active === id ? "page" : undefined}
              className={[
                "flex h-10 items-center gap-2.5 rounded-md px-3 text-[14.5px]",
                active === id
                  ? "bg-surface-tertiary font-semibold text-text"
                  : "text-text-tertiary hover:bg-surface-secondary hover:text-text",
              ].join(" ")}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg bg-surface px-6 py-8 sm:px-10">
        <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
          <h1 className="m-0 font-display text-[34px] font-normal leading-tight tracking-normal">
            {SECTIONS.find((s) => s.id === active)?.label}
          </h1>

          {isPending ? (
            <LoadingState message="Loading your profile…" shape="form" />
          ) : error ? (
            <ErrorState
              title="Couldn't load your profile"
              message={classifyAuthError(error, "Check your connection and try again.").message}
              onRetry={() => refetch()}
            />
          ) : (
            <>
              {active === "profile" && <ProfileSection profile={profile} />}
              {active !== "profile" && (
                // Cards sit side by side once the window has room for two.
                <div className="grid items-start gap-5 xl:grid-cols-2">
                  {active === "account" && <AccountSection profile={profile} />}
                  {active === "security" && <SecuritySection />}
                  {active === "desktop" && <DesktopSection />}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
