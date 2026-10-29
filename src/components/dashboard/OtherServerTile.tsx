import { useState } from "react";
import { Clock } from "lucide-react";
import { Button, Modal, SpaceIcon } from "@pufferblow/spines";
import { previewAssetUrl, useInstancePreview } from "../../features/instance/preview";
import { switchAccount, type Account } from "../../services/accounts";
import { checkRequest, HomeSessionExpired, leaveServer } from "../../services/servers";
import { classifyAuthError } from "../../utils/authErrors";

/** A server that is not the one open: your own, or one joined with your account. Clicking opens it (or, while it waits, shows how the request stands). */
export function OtherServerTile({
  account,
  tileClass,
  indicator,
  onMenu,
}: {
  account: Account;
  tileClass: string;
  indicator: React.ReactNode;
  onMenu?: (point: { x: number; y: number }, account: Account) => void;
}) {
  const { data: info } = useInstancePreview(account.instance);
  const [waiting, setWaiting] = useState(false);
  const pending = account.membership?.status === "pending";
  const name = info?.server_name ?? account.membership?.serverName ?? account.instance.raw;

  const open = async () => {
    if (pending) {
      setWaiting(true);
      return;
    }
    if (await switchAccount(account.id)) window.location.assign("/dashboard/channels");
  };

  return (
    <div className="group/tile relative flex w-full justify-center">
      {indicator}
      <button
        type="button"
        onClick={() => void open()}
        onContextMenu={(e) => {
          if (!onMenu) return;
          e.preventDefault();
          onMenu({ x: e.clientX, y: e.clientY }, account);
        }}
        aria-label={pending ? `${name} on ${account.instance.raw}, waiting for approval` : `${name} on ${account.instance.raw}`}
        title={pending ? `${name} (waiting for approval)` : name}
        className={`${tileClass} rounded-lg bg-surface-secondary ${pending ? "opacity-60" : ""}`}
      >
        <SpaceIcon
          id={info?.server_id ?? account.instance.raw}
          name={name}
          src={info?.avatar_kind === "image" ? previewAssetUrl(account.instance, info.avatar_url) : undefined}
          look={{ iconStyle: info?.look?.icon_style as never, tone: info?.look?.tone as never }}
          size={48}
          radius="inherit"
          className="absolute inset-0"
        />
        {pending && (
          <span className="absolute -bottom-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-surface-tertiary text-text shadow-[0_0_0_3px_var(--color-background)]" aria-hidden="true">
            <Clock size={11} />
          </span>
        )}
      </button>
      {waiting && <WaitingDialog account={account} name={name} onClose={() => setWaiting(false)} />}
    </div>
  );
}

function WaitingDialog({ account, name, onClose }: { account: Account; name: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const check = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await checkRequest(account);
      if (result.kind === "joined") {
        if (await switchAccount(result.accountId)) window.location.assign("/dashboard/channels");
        else onClose();
      } else setMessage("Still waiting. A moderator hasn't decided yet.");
    } catch (error) {
      setMessage(error instanceof HomeSessionExpired ? error.message : classifyAuthError(error, "Couldn't check.").message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    await leaveServer(account);
    onClose();
    window.location.reload();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Waiting for ${name}`}
      description="A moderator on that server has to approve you before you can come in."
      footer={
        <>
          <Button variant="ghost" onClick={() => void withdraw()}>
            Withdraw request
          </Button>
          <Button loading={busy} onClick={() => void check()}>
            Check now
          </Button>
        </>
      }
    >
      <p className="m-0 text-[13.5px] text-text-tertiary">
        Asked as {account.membership?.handle}. {message ?? "You can close this; it stays in your server list."}
      </p>
    </Modal>
  );
}

