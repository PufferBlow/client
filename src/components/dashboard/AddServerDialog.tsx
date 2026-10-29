import { useMemo, useState, type FormEvent } from "react";
import { Globe, KeyRound, Lock, UserCheck, Users } from "lucide-react";
import { Button, Input, Modal, SpaceIcon } from "@pufferblow/spines";
import { previewAssetUrl, useDebounced, useInstancePreview } from "../../features/instance/preview";
import type { JoinMode, ServerInfo } from "../../features/server/types";
import { homeOf, listAccounts, switchAccount } from "../../services/accounts";
import { getActiveAccountId } from "../../services/auth";
import { resolveInstance } from "../../services/instance";
import { HomeSessionExpired, joinServer, resolveHome } from "../../services/servers";
import type { InstanceConfig } from "../../services/types";
import { classifyAuthError } from "../../utils/authErrors";

const ACCESS: Record<JoinMode, { label: string; hint: string; icon: typeof Globe }> = {
  open: { label: "Open to everyone", hint: "You can join right away.", icon: Globe },
  invite: { label: "Invite only", hint: "You need an invitation code from someone on the server.", icon: Lock },
  request: { label: "Asks to approve new people", hint: "A moderator decides. You can add a note to your request.", icon: UserCheck },
};

const count = (n: number | null | undefined) => (n === null || n === undefined ? null : n.toLocaleString());

function ServerCard({ instance, info }: { instance: InstanceConfig; info: ServerInfo }) {
  const members = count(info.members_count);
  const online = count(info.online_members);
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface-secondary p-3">
      <SpaceIcon
        id={info.server_id || instance.raw}
        name={info.server_name}
        src={info.avatar_kind === "image" ? previewAssetUrl(instance, info.avatar_url) : undefined}
        look={{ iconStyle: info.look?.icon_style as never, tone: info.look?.tone as never }}
        size={48}
      />
      <div className="min-w-0 flex-1 leading-snug">
        <div className="truncate text-[15px] font-semibold">{info.server_name}</div>
        <div className="truncate text-[12.5px] text-text-muted">{instance.raw}</div>
        {info.server_description && <p className="m-0 mt-1 line-clamp-2 text-[13px] text-text-tertiary">{info.server_description}</p>}
        {(members || online) && (
          <p className="m-0 mt-1 flex items-center gap-1.5 text-[12px] text-text-muted">
            <Users size={12} aria-hidden="true" />
            {members && `${members} ${info.members_count === 1 ? "member" : "members"}`}
            {members && online && " · "}
            {online && `${online} online`}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Join a server with the account you already have: type its address, see what it is and how it lets people in, and join.
 * Nothing is created on the server and there is no password. A private server asks for its invitation code; one that
 * approves new people takes a request, and the server shows up in the list, waiting.
 */
export function AddServerDialog({ onClose }: { onClose: () => void }) {
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; expired?: boolean } | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const typed = useDebounced(address.trim(), 450);
  const instance = useMemo<InstanceConfig | null>(() => {
    if (!typed) return null;
    try {
      return resolveInstance(typed);
    } catch {
      return null;
    }
  }, [typed]);
  const settling = address.trim() !== typed;
  const preview = useInstancePreview(instance);
  const info = preview.data;

  const home = resolveHome();
  const mode: JoinMode = info?.join_mode ?? "open";
  const ownServer = !!instance && !!home && home.instance.raw.toLowerCase() === instance.raw.toLowerCase();
  const alreadyJoined = !!instance && listAccounts().some((a) => a.membership && a.instance.raw.toLowerCase() === instance.raw.toLowerCase() && a.membership.homeId === (home?.account?.id ?? ""));
  const canTry = !!instance && !!info && !ownServer && !settling && !busy;
  const needsCode = mode === "invite";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canTry || !instance) return;
    if (needsCode && !code.trim()) {
      setError({ message: "Enter the invitation code you were given." });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await joinServer(instance, info, { inviteCode: code, message: note });
      if (result.kind === "pending") {
        setSent(info?.server_name ?? instance.raw);
        return;
      }
      // Opening the server you just joined is the point of joining it.
      if (await switchAccount(result.accountId)) window.location.assign("/dashboard/channels");
      else onClose();
    } catch (cause) {
      if (cause instanceof HomeSessionExpired) setError({ message: cause.message, expired: true });
      else setError({ message: classifyAuthError(cause, "Couldn't join that server.").message });
    } finally {
      setBusy(false);
    }
  };

  const openHome = async () => {
    const active = listAccounts().find((a) => a.id === getActiveAccountId());
    const target = active ? homeOf(active) : undefined;
    if (target && (await switchAccount(target.id))) window.location.assign("/dashboard/channels");
  };

  if (sent) {
    return (
      <Modal
        isOpen
        onClose={onClose}
        title="Request sent"
        description={`${sent} asks a moderator to approve new people.`}
        footer={<Button onClick={onClose}>Done</Button>}
      >
        <p className="m-0 text-[13.5px] text-text-tertiary">It is in your server list, marked as waiting. When a moderator approves it you can open it from there.</p>
      </Modal>
    );
  }

  const AccessIcon = ACCESS[mode].icon;
  return (
    <Modal isOpen onClose={onClose} title="Join a server" description="Join with your account. Nothing new is created on the server.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-text-secondary">Server address</span>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} autoFocus aria-label="Server address" placeholder="chat.example.org or 192.168.1.5:7575" autoCapitalize="none" spellCheck={false} />
        </label>

        {instance && settling && <p className="m-0 text-[13px] text-text-muted">Looking…</p>}
        {instance && !settling && preview.isPending && <p className="m-0 text-[13px] text-text-muted">Looking for that server…</p>}
        {instance && !settling && preview.isError && (
          <p role="alert" className="m-0 text-[13px] text-error-text">
            Couldn&apos;t find a Pufferblow server at {instance.raw}. Check the address.
          </p>
        )}

        {instance && info && !settling && (
          <>
            <ServerCard instance={instance} info={info} />
            {ownServer ? (
              <p className="m-0 text-[13px] text-text-tertiary">That is your own server.</p>
            ) : alreadyJoined ? (
              <p className="m-0 text-[13px] text-text-tertiary">You have already joined it (or asked to). It is in your server list.</p>
            ) : (
              <>
                <p className="m-0 flex items-start gap-2 text-[13px] text-text-tertiary">
                  <AccessIcon size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    <b className="font-semibold text-text-body">{ACCESS[mode].label}.</b> {ACCESS[mode].hint}
                  </span>
                </p>
                {mode !== "open" && (
                  <label className="flex flex-col gap-1.5">
                    <span className="flex items-center gap-1.5 text-[13px] text-text-secondary">
                      <KeyRound size={13} aria-hidden="true" />
                      {needsCode ? "Invitation code" : "Invitation code (optional)"}
                    </span>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} aria-label="Invitation code" placeholder="ABCD-EFGH-JKMN" autoCapitalize="characters" spellCheck={false} />
                  </label>
                )}
                {mode === "request" && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] text-text-secondary">Note for the moderators (optional)</span>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Note for the moderators" placeholder="Who you are, who sent you" />
                  </label>
                )}
              </>
            )}
          </>
        )}

        {error && (
          <div role="alert" className="flex flex-col gap-2 text-[13px] text-error-text">
            <p className="m-0">{error.message}</p>
            {error.expired && (
              <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => void openHome()}>
                Open my server
              </Button>
            )}
          </div>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={!canTry || alreadyJoined}>
            {mode === "request" && !code.trim() ? "Request to join" : code.trim() ? "Join with code" : "Join"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
