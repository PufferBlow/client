import { useState, type FormEvent } from "react";
import { Copy } from "lucide-react";
import { Panel, Tag } from "../../components/control-panel/Panel";
import { tableClasses } from "../../components/control-panel/tableClasses";
import { FeedbackLine } from "../../components/settings/SettingsParts";
import { useSave } from "../../components/settings/useSave";
import { Button, ErrorState, Input, LoadingState } from "@pufferblow/spines";
import { useInviteAdmin, useInvites, type Invite } from "../../features/admin/access";
import { copyToClipboard } from "../../lib/clipboard";
import { classifyAuthError } from "../../utils/authErrors";

const TONES: Record<Invite["state"], { label: string; tone: "green" | "neutral" | "red" | "brass" }> = {
  active: { label: "Active", tone: "green" },
  used_up: { label: "Used up", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  revoked: { label: "Revoked", tone: "red" },
};

/** 12 characters read out as three groups of four. */
const grouped = (code: string) => code.replace(/(.{4})(?=.)/g, "$1-");

const EXPIRY = [
  { value: "", label: "Never expires" },
  { value: "1", label: "In 1 hour" },
  { value: "24", label: "In 1 day" },
  { value: "168", label: "In 7 days" },
  { value: "720", label: "In 30 days" },
];

/** Invitation codes: make one for people to join with, see how it is used, end it. */
export function InvitesSection() {
  const { data, isPending, error, refetch } = useInvites();
  const admin = useInviteAdmin();
  const make = useSave("Code made.");
  const [note, setNote] = useState("");
  const [uses, setUses] = useState("");
  const [expiry, setExpiry] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const maxUses = uses.trim() ? Number.parseInt(uses, 10) : undefined;
    void make
      .run(() =>
        admin.create
          .mutateAsync({ note: note.trim() || undefined, max_uses: maxUses && maxUses > 0 ? maxUses : undefined, expires_in_hours: expiry ? Number(expiry) : undefined })
          .then(() => undefined),
      )
      .then((ok) => {
        if (ok) {
          setNote("");
          setUses("");
        }
      });
  };

  const copy = async (code: string) => {
    if (await copyToClipboard(code)) {
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
    }
  };

  const mode = data?.join_mode;
  return (
    <Panel
      title="Invitations"
      description={
        mode === "open"
          ? "The server is open to everyone right now, so codes are not needed. They work once you set it to Invite only or Request to join (Settings, Who can join)."
          : "People join with a code. Make one for a friend, a group or an event, with limits if you want."
      }
      grow
    >
      <div className="flex flex-col gap-4">
        <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_160px_auto]">
          <Input aria-label="Who is it for" placeholder="Who is it for? (optional)" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
          <Input aria-label="How many people can use it" placeholder="Uses" inputMode="numeric" value={uses} onChange={(e) => setUses(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          <select aria-label="When it expires" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="h-11 rounded-md border border-border bg-surface-secondary px-3 text-sm text-text">
            {EXPIRY.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button type="submit" loading={make.loading}>
            Make a code
          </Button>
        </form>
        <FeedbackLine feedback={make.feedback} />

        {isPending ? (
          <LoadingState message="Loading codes…" shape="table" />
        ) : error || !data ? (
          <ErrorState title="Couldn't load codes" message={classifyAuthError(error, "Try again.").message} onRetry={() => void refetch()} />
        ) : data.invites.length === 0 ? (
          <p className="pb-meta m-0 text-[13px]">No codes yet.</p>
        ) : (
          <table className={tableClasses.table}>
            <thead>
              <tr>
                <th scope="col" className={tableClasses.head}>Code</th>
                <th scope="col" className={tableClasses.head}>For</th>
                <th scope="col" className={`${tableClasses.head} text-right`}>Used</th>
                <th scope="col" className={tableClasses.head}>Expires</th>
                <th scope="col" className={tableClasses.head}>State</th>
                <th scope="col" className={tableClasses.head}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.invites.map((invite) => (
                <tr key={invite.code} className={tableClasses.row}>
                  <td className={`${tableClasses.cell} font-mono text-[13px] tracking-wider`}>{grouped(invite.code)}</td>
                  <td className={`${tableClasses.cell} text-text-tertiary`}>{invite.note ?? ""}</td>
                  <td className={`${tableClasses.cell} text-right tabular-nums`}>
                    {invite.uses}
                    {invite.max_uses !== null ? ` / ${invite.max_uses}` : ""}
                  </td>
                  <td className={`${tableClasses.cell} text-text-tertiary`}>{invite.expires_at ? new Date(invite.expires_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Never"}</td>
                  <td className={tableClasses.cell}>
                    <Tag tone={TONES[invite.state].tone}>{TONES[invite.state].label}</Tag>
                  </td>
                  <td className={`${tableClasses.cell} text-right`}>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" aria-label={`Copy code ${grouped(invite.code)}`} onClick={() => void copy(invite.code)}>
                        <Copy size={13} aria-hidden="true" />
                        {copied === invite.code ? "Copied" : "Copy"}
                      </Button>
                      {invite.state === "active" && (
                        <Button size="sm" variant="secondary" aria-label={`Revoke code ${grouped(invite.code)}`} onClick={() => admin.revoke.mutate(invite.code)}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}
