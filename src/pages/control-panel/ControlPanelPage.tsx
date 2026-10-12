import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { LoadingState } from "../../components/ui/LoadingState";
import { ErrorState } from "../../components/ui/ErrorState";
import { useServerInfo } from "../../features/server/hooks";
import { useMyProfile } from "../../features/users/hooks";
import { isServerOwner } from "../../features/users/roles";
import { classifyAuthError } from "../../utils/authErrors";
import { ChannelsSection } from "./ChannelsSection";
import { ComingSoon, MembersSection } from "./ListSections";
import { OverviewSection } from "./OverviewSection";
import { DEFAULT_SECTION, isSectionId, SECTIONS, type SectionId } from "./sections";

function SectionBody({ id }: { id: SectionId }) {
  switch (id) {
    case "overview":
      return <OverviewSection />;
    case "channels":
      return <ChannelsSection />;
    case "members":
      return <MembersSection />;
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
      <main className="flex min-w-0 flex-1 items-center justify-center rounded-[14px] bg-surface">
        <LoadingState message="Checking permissions…" />
      </main>
    );
  }
  if (error) {
    return (
      <main className="flex min-w-0 flex-1 items-center justify-center rounded-[14px] bg-surface">
        <ErrorState title="Couldn't load your profile" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />
      </main>
    );
  }
  if (!isServerOwner(me)) return <Navigate to="/dashboard" replace />;
  if (section !== undefined && !isSectionId(section)) return <Navigate to="/control-panel" replace />;

  const active: SectionId = isSectionId(section) ? section : DEFAULT_SECTION;
  const current = SECTIONS.find((s) => s.id === active)!;

  return (
    <>
      <aside className="flex w-[244px] shrink-0 flex-col gap-1 overflow-y-auto rounded-[14px] bg-surface p-2.5 max-md:hidden">
        <Link
          to="/dashboard"
          className="mb-2 flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-[14.5px] text-text-tertiary no-underline hover:bg-surface-secondary hover:text-text"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to app
        </Link>

        <div className="px-3 pb-2 pt-1">
          <div className="font-heading text-[11.5px] font-semibold uppercase tracking-[0.12em] text-primary">Control panel</div>
          <div className="mt-1 truncate font-display text-xl">{server?.server_name ?? " "}</div>
        </div>

        <nav aria-label="Control panel sections" className="flex flex-col gap-0.5">
          {SECTIONS.map(({ id, label, icon: Icon, ...rest }) => (
            <Link
              key={id}
              to={`/control-panel/${id}`}
              aria-current={active === id ? "page" : undefined}
              className={[
                "flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-[14.5px] no-underline",
                active === id ? "bg-surface-tertiary font-semibold text-text" : "text-text-tertiary hover:bg-surface-secondary hover:text-text",
              ].join(" ")}
            >
              <Icon size={17} aria-hidden="true" />
              <span className="flex-1">{label}</span>
              {"planned" in rest && <span className="text-[10px] uppercase tracking-[0.1em] text-text-muted">Soon</span>}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-[14px] bg-surface px-6 py-8 sm:px-10">
        <div className="mx-auto flex max-w-[960px] flex-col gap-5">
          <header>
            <h1 className="m-0 font-display text-[34px] font-normal leading-tight tracking-normal">{current.label}</h1>
            <p className="m-0 mt-1 text-[15px] text-text-tertiary">{current.description}</p>
          </header>
          <SectionBody id={active} />
        </div>
      </main>
    </>
  );
}
