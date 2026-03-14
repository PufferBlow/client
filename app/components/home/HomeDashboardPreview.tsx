import React from "react";

type PreviewMessage = {
  id: string;
  author: string;
  timestamp: string;
  content: string;
  avatar: string;
  statusColor: string;
};

const previewChannels = [
  { id: "welcome", name: "welcome", selected: true },
  { id: "announcements", name: "announcements", selected: false },
  { id: "general", name: "general", selected: false },
  { id: "media", name: "media", selected: false },
];

const previewMessages: PreviewMessage[] = [
  {
    id: "m1",
    author: "Pufferblow",
    timestamp: "Today at 2:31 PM",
    content:
      "Welcome to your decentralized server. Channels, members, and realtime updates stay in sync across instances.",
    avatar: "PB",
    statusColor: "bg-[var(--color-success)]",
  },
  {
    id: "m2",
    author: "John Doe",
    timestamp: "Today at 2:32 PM",
    content:
      "The dashboard layout feels familiar and clean. This is exactly what I needed moving from Discord.",
    avatar: "JD",
    statusColor: "bg-[var(--color-success)]",
  },
];

const previewMembers = [
  { id: "u1", name: "John Doe", avatar: "JD", status: "online" },
  { id: "u2", name: "Sarah Jane", avatar: "SJ", status: "idle" },
  { id: "u3", name: "Mike Brown", avatar: "MB", status: "dnd" },
];

function presenceDot(status: string): string {
  if (status === "online") return "bg-[var(--color-success)]";
  if (status === "idle") return "bg-[var(--color-warning)]";
  if (status === "dnd") return "bg-[var(--color-error)]";
  return "bg-[var(--color-text-muted)]";
}

export default function HomeDashboardPreview() {
  return (
    <div className="relative max-w-6xl mx-auto">
      <div className="absolute -top-4 -left-4 w-8 h-8 bg-[var(--color-primary)] rounded-full opacity-60 animate-bounce" />
      <div
        className="absolute -bottom-6 -right-6 w-6 h-6 bg-[var(--color-accent)] rounded-full opacity-60 animate-bounce"
        style={{ animationDelay: "0.8s" }}
      />

      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-2xl overflow-hidden">
        <div className="h-10 bg-[var(--color-surface-secondary)] border-b border-[var(--color-border)] flex items-center px-4">
          <div className="flex space-x-2">
            <div className="w-3 h-3 rounded-full bg-[var(--color-error)]" />
            <div className="w-3 h-3 rounded-full bg-[var(--color-warning)]" />
            <div className="w-3 h-3 rounded-full bg-[var(--color-success)]" />
          </div>
          <div className="flex-1 text-center text-xs text-[var(--color-text-secondary)]">
            your.instance.example/dashboard
          </div>
        </div>

        <div className="h-[560px] overflow-hidden bg-[var(--color-background)] flex font-sans gap-2 p-2 select-none relative min-w-0">
          <div className="flex flex-col gap-0 h-full shrink-0">
            <div className="flex flex-1 gap-2 min-h-0">
              <div className="w-16 shrink-0 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] flex flex-col items-center py-2 space-y-2">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-sm font-bold text-[var(--color-on-primary)]">
                  PB
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[var(--color-success)] rounded-full border-2 border-[var(--color-surface)]" />
                </div>
                <div className="w-8 h-px bg-[var(--color-border)] rounded my-1" />
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] font-semibold flex items-center justify-center">
                  WS
                </div>
                <button className="w-12 h-12 bg-[var(--color-surface-secondary)] rounded-2xl hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] mt-auto">
                  +
                </button>
              </div>

              <div className="w-72 lg:w-80 shrink-0 min-w-[16rem] max-w-[22rem] bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--color-border)]">
                  <h1 className="text-[var(--color-text)] font-bold text-sm truncate">
                    Welcome Server
                  </h1>
                  <p className="text-[var(--color-text-secondary)] text-xs">
                    Decentralized Community
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-4">
                  <div className="flex items-center px-2 mb-2">
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                      Channels
                    </span>
                  </div>
                  <div className="space-y-1">
                    {previewChannels.map((channel) => (
                      <div
                        key={channel.id}
                        className={`flex items-center px-2 py-1 rounded-md cursor-pointer ${
                          channel.selected
                            ? "bg-[var(--color-active)] text-[var(--color-text)]"
                            : "hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        <span className="mr-2">#</span>
                        <span className="text-sm">{channel.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full bg-[var(--color-surface-secondary)] rounded-b-xl border-t border-[var(--color-border)]">
              <div className="px-3 py-2 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-[var(--color-on-primary)]">
                  JD
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--color-text)] truncate">
                    John Doe
                  </div>
                  <div className="text-[11px] text-[var(--color-text-secondary)]">
                    online
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="pb-icon-btn">
                    <svg
                      className="pb-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14"
                      />
                      <rect
                        x={3}
                        y={7}
                        width={12}
                        height={10}
                        rx={2}
                        ry={2}
                        strokeWidth={2}
                      />
                    </svg>
                  </button>
                  <button className="pb-icon-btn">
                    <svg
                      className="pb-icon"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
            <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-secondary)]/70">
              <div className="flex items-center">
                <span className="text-[var(--color-text-secondary)] mr-2">#</span>
                <h2 className="text-[var(--color-text)] font-semibold tracking-tight">
                  welcome
                </h2>
              </div>
              <div className="flex items-center space-x-2 text-[var(--color-text-secondary)]">
                <button className="pb-icon-btn">?</button>
                <button className="pb-icon-btn">...</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 break-words">
              {previewMessages.map((message) => (
                <div key={message.id} className="flex items-start space-x-3">
                  <div className="relative shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-[var(--color-on-primary)]">
                      {message.avatar}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-surface)] ${message.statusColor}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--color-text)]">
                        {message.author}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {message.timestamp}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mt-1">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-[var(--color-border)]">
              <div className="bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm text-[var(--color-text-muted)]">
                Message #welcome
              </div>
            </div>
          </div>

          <div className="hidden xl:flex w-56 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
            <div className="w-full flex flex-col">
              <div className="h-12 px-3 flex items-center border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Members - {previewMembers.length}
              </div>
              <div className="p-3 space-y-2">
                {previewMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--color-hover)]"
                  >
                    <div className="relative">
                      <div className="w-7 h-7 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text)] text-[11px] font-semibold flex items-center justify-center">
                        {member.avatar}
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--color-surface)] ${presenceDot(member.status)}`}
                      />
                    </div>
                    <span className="text-xs text-[var(--color-text-secondary)] truncate">
                      {member.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center mt-8">
        <p className="text-lg text-[var(--color-text-secondary)] font-medium">
          Preview uses the same dashboard shell classes and spacing tokens as the
          live app.
        </p>
      </div>
    </div>
  );
}


