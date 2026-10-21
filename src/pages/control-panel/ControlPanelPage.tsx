import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { SpaceIcon } from "../../components/ui/SpaceIcon";
import { RoleTag } from "../../components/ui/RoleTag";
import { resolveAssetUrl } from "../../services/authed";
import { getStoredInstance } from "../../services/instance";
import { LoadingState } from "../../components/ui/LoadingState";
import { ErrorState } from "../../components/ui/ErrorState";
import { useServerInfo } from "../../features/server/hooks";
import { useMyProfile } from "../../features/users/hooks";
import { isServerOwner } from "../../features/users/roles";
import { classifyAuthError } from "../../utils/authErrors";
import { ChannelsSection } from "./ChannelsSection";
import { HealthSection } from "./HealthSection";
import { PeersSection } from "./PeersSection";
import { ComingSoon, MembersSection } from "./ListSections";
import { OverviewSection } from "./OverviewSection";
import { DEFAULT_SECTION, GROUPS, isSectionId, SECTIONS, type SectionId } from "./sections";

function SectionBody({ id }: { id: SectionId }) {
  switch (id) {
    case "overview":
      return <OverviewSection />;
    case "channels":
      return <ChannelsSection />;
    case "members":
      return <MembersSection />;
    case "health":
      return <HealthSection />;
    case "peers":
      return <PeersSection />;
    default: {
      const section = SECTIONS.find((s) => s.id === id);
      return <ComingSoon planned={section && "planned" in section ? section.planned : []} />;
    }
  }
}

/** Owner-only server administration. The server enforces ownership too; this only gates the screen. */
export function ControlPanelPage() {
  const { section } = useParams();
  const { data: me, isPending, error, refetch } = useMyProfile();
  const { data: server } = useServerInfo();

  useEffect(() => {
    // Admin screens aren't somewhere to resume on the next launch.
    localStorage.setItem("pb_last_route", "/dashboard");
  }, []);

  if (isPending) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center rounded-lg bg-surface">
        <LoadingState message="Checking permissions…" />
      </main>
    );
  }
  if (error) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center rounded-lg bg-surface">
        <ErrorState title="Couldn't load your profile" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />
      </main>
    );
  }
  if (!isServerOwner(me)) return <Navigate to="/dashboard" replace />;
  if (section !== undefined && !isSectionId(section)) return <Navigate to="/control-panel" replace />;

  const active: SectionId = isSectionId(section) ? section : DEFAULT_SECTION;
  const current = SECTIONS.find((s) => s.id === active)!;

  const host = getStoredInstance()?.raw ?? "";
  const name = server?.server_name ?? host;

  return (
    <>
      <aside className="flex w-[244px] shrink-0 flex-col overflow-hidden rounded-lg bg-background-secondary max-md:hidden">
        <div className="flex items-center gap-3 px-3.5 pb-1.5 pt-4">
          <SpaceIcon id={host || name} name={name} src={server?.avatar_url ? resolveAssetUrl(server.avatar_url) : null} size={40} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="pb-panel-header truncate leading-tight">{server?.server_name ?? " "}</span>
            <span className="pb-meta flex items-center gap-1.5 text-xs">
              <RoleTag name="Owner" colour="#dadada" dot={false} />
              {server?.version ? `Pufferblow ${server.version}` : host}
            </span>
          </div>
        </div>

        <nav aria-label="Control panel sections" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <Link
            to="/dashboard"
            className="mt-1 flex h-9 items-center gap-2.5 rounded-sm px-2.5 text-[14px] text-text-tertiary no-underline hover:bg-surface-secondary hover:text-text"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to app
          </Link>
          {GROUPS.map((group) => (
            <div key={group.name} role="group" aria-label={group.name}>
              <div className="pb-section-label px-2.5 pb-1.5 pt-3.5">{group.name}</div>
              {group.ids.map((id) => {
                const { label, icon: Icon, ...rest } = SECTIONS.find((s) => s.id === id)!;
                return (
                  <Link
                    key={id}
                    to={`/control-panel/${id}`}
                    aria-current={active === id ? "page" : undefined}
                    className={[
                      "flex h-[34px] items-center gap-2.5 rounded-sm px-2.5 text-[14.5px] no-underline transition-colors duration-(--motion-fast)",
                      active === id ? "bg-surface-tertiary font-semibold text-text" : "font-medium text-text-tertiary hover:bg-surface-secondary hover:text-text-body",
                    ].join(" ")}
                  >
                    <Icon size={16} aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    {"planned" in rest && <span className="text-[10px] uppercase tracking-[0.1em] text-text-faint">Soon</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <p className="m-2 flex items-start gap-2.5 rounded-lg bg-surface-secondary px-3 py-2.5 text-xs leading-snug text-text-tertiary">
          <Lock size={14} aria-hidden="true" className="mt-px shrink-0" />
          Only the owner of {host || "this instance"} can open this panel.
        </p>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-lg bg-surface px-5 py-[22px] sm:px-6">
        <div className="mx-auto flex max-w-[1040px] flex-col gap-4">
          <header className="flex flex-col gap-2">
            <span className="pb-section-label">{GROUPS.find((g) => g.ids.includes(active))?.name}</span>
            <h1 className="pb-display m-0">{current.label}</h1>
            <p className="m-0 text-[14px] text-text-tertiary">{current.description}</p>
          </header>
          <SectionBody id={active} />
        </div>
      </main>
    </>
  );
}
