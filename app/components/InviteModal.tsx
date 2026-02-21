import { useEffect, useMemo, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./ui/Modal";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverName: string;
  serverId?: string;
  onGenerateInvite: (options: {
    maxUses?: number;
    expiresAt?: Date;
    isPermanent?: boolean;
  }) => Promise<string>;
  onCopyInvite: (inviteCode: string) => void;
}

const EXPIRE_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "30min", label: "30 minutes" },
  { value: "1hour", label: "1 hour" },
  { value: "6hours", label: "6 hours" },
  { value: "1day", label: "1 day" },
  { value: "7days", label: "7 days" },
];

function expirationToDate(expiresIn: string): Date | undefined {
  const now = Date.now();

  switch (expiresIn) {
    case "30min":
      return new Date(now + 30 * 60 * 1000);
    case "1hour":
      return new Date(now + 60 * 60 * 1000);
    case "6hours":
      return new Date(now + 6 * 60 * 60 * 1000);
    case "1day":
      return new Date(now + 24 * 60 * 60 * 1000);
    case "7days":
      return new Date(now + 7 * 24 * 60 * 60 * 1000);
    default:
      return undefined;
  }
}

export function InviteModal({
  isOpen,
  onClose,
  serverName,
  onGenerateInvite,
  onCopyInvite,
}: InviteModalProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [maxUses, setMaxUses] = useState<number | undefined>();
  const [expiresIn, setExpiresIn] = useState("never");

  useEffect(() => {
    if (!isOpen) {
      setInviteCode(null);
      setMaxUses(undefined);
      setExpiresIn("never");
    }
  }, [isOpen]);

  const isPermanent = expiresIn === "never";
  const inviteUrl = useMemo(
    () => (inviteCode ? `https://pufferblow.space/invite/${inviteCode}` : ""),
    [inviteCode],
  );

  const handleGenerateInvite = async () => {
    setIsGenerating(true);
    try {
      const code = await onGenerateInvite({
        maxUses: maxUses || undefined,
        expiresAt: expirationToDate(expiresIn),
        isPermanent,
      });
      setInviteCode(code);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyInvite = () => {
    if (!inviteCode) return;
    onCopyInvite(inviteCode);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Members"
      description={`Create an invite for ${serverName}.`}
      widthClassName="max-w-lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {!inviteCode ? (
            <Button onClick={handleGenerateInvite} loading={isGenerating}>
              Generate Invite
            </Button>
          ) : (
            <Button onClick={handleCopyInvite}>Copy Link</Button>
          )}
        </div>
      }
    >
      {!inviteCode ? (
        <div className="space-y-4">
          <div>
            <label htmlFor="maxUses" className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
              Max Uses (optional)
            </label>
            <input
              id="maxUses"
              type="number"
              min="1"
              value={maxUses || ""}
              onChange={(event) => setMaxUses(event.target.value ? Number(event.target.value) : undefined)}
              className="w-full rounded-lg border pb-border bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
              placeholder="Unlimited"
            />
          </div>

          <div>
            <label htmlFor="expiresIn" className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
              Expires In
            </label>
            <select
              id="expiresIn"
              value={expiresIn}
              onChange={(event) => setExpiresIn(event.target.value)}
              className="w-full rounded-lg border pb-border bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
            >
              {EXPIRE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border pb-border bg-[var(--color-surface-secondary)] p-3">
            <p className="text-xs text-[var(--color-text-muted)]">Invite URL</p>
            <p className="mt-1 break-all text-sm text-[var(--color-text)]">{inviteUrl}</p>
          </div>

          <div className="rounded-lg border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] p-3 text-sm text-[var(--color-text-secondary)]">
            {isPermanent ? "This invite does not expire." : `Expires: ${expiresIn}`}
            {maxUses ? ` • Max uses: ${maxUses}` : " • Unlimited uses"}
          </div>
        </div>
      )}
    </Modal>
  );
}

