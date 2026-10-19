import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router";
import { ArrowLeft, Palette, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { Avatar } from "../../components/dashboard/Avatar";
import { ErrorState } from "../../components/ui/ErrorState";
import { LoadingState } from "../../components/ui/LoadingState";
import { useMyProfile } from "../../features/users/hooks";
import type { UserProfile } from "../../features/users/types";
import { resolveAssetUrl } from "../../services/authed";
import { classifyAuthError } from "../../utils/authErrors";
import { AccountSection } from "./AccountSection";
import { ProfileSection } from "./ProfileSection";
import { SecuritySection } from "./SecuritySection";

const SECTIONS = [
  { id: "account", label: "My account", icon: UserRound },
  { id: "profile", label: "Profile", icon: Palette },
  { id: "security", label: "Security", icon: ShieldCheck },
] as const satisfies readonly { id: string; label: string; icon: LucideIcon }[];

type SectionId = (typeof SECTIONS)[number]["id"];
const isSection = (value: string | undefined): value is SectionId => SECTIONS.some((s) => s.id === value);

/** Banner + avatar preview: the banner image the server hosts, or the accent colour when there is none. */
function ProfileHeader({ profile }: { profile: UserProfile }) {
  const accent = profile.accent_color ?? "#9a9a9a";
  const banner = resolveAssetUrl(profile.banner_url);
  return (
    <div className="overflow-hidden rounded-[14px] border border-border-secondary bg-surface-secondary">
      <div
        className="h-24"
        style={{ background: banner ? `url("${banner}") center / cover` : `radial-gradient(120% 140% at 20% 0%, ${accent} 0%, #1a1a1a 85%)` }}
      />
      <div className="flex items-end gap-3.5 px-5 pb-4">
        <Avatar
          name={profile.username}
          src={profile.avatar_url}
          seed={profile.user_id}
          size={72}
          ringColor="var(--color-surface-secondary)"
          className="-mt-9 border-4 border-surface-secondary"
        />
        <div className="min-w-0 pb-1 leading-tight">
          <div className="truncate font-display text-2xl">{profile.username}</div>
          <div className="truncate text-[13px] text-text-tertiary">@{profile.origin_server}</div>
        </div>
      </div>
    </div>
  );
}

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
      <aside className="flex w-[244px] shrink-0 flex-col gap-1 overflow-y-auto rounded-[14px] bg-surface p-2.5 max-md:hidden">
        <Link
          to="/dashboard"
          className="mb-2 flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-[14.5px] text-text-tertiary hover:bg-surface-secondary hover:text-text"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to app
        </Link>
        <h2 className="m-0 px-3 pb-1.5 pt-2 font-heading text-[11.5px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          Settings
        </h2>
        <nav aria-label="Settings sections" className="flex flex-col gap-0.5">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              to={`/settings/${id}`}
              aria-current={active === id ? "page" : undefined}
              className={[
                "flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-[14.5px]",
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

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-[14px] bg-surface px-6 py-8 sm:px-10">
        <div className="mx-auto flex max-w-[640px] flex-col gap-5">
          <h1 className="m-0 font-display text-[34px] font-normal leading-tight tracking-normal">
            {SECTIONS.find((s) => s.id === active)?.label}
          </h1>

          {isPending ? (
            <LoadingState message="Loading your profile…" />
          ) : error ? (
            <ErrorState
              title="Couldn't load your profile"
              message={classifyAuthError(error, "Check your connection and try again.").message}
              onRetry={() => refetch()}
            />
          ) : (
            <>
              <ProfileHeader profile={profile} />
              {active === "account" && <AccountSection profile={profile} />}
              {active === "profile" && <ProfileSection profile={profile} />}
              {active === "security" && <SecuritySection />}
            </>
          )}
        </div>
      </main>
    </>
  );
}
