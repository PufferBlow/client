import { Flame } from "lucide-react";
import { previewAssetUrl } from "../../features/instance/preview";
import type { ServerInfo } from "../../features/server/types";
import { bannerCss, defaultBannerCss, fishUrl, identity } from "../../lib/identity";
import type { InstanceConfig } from "../../services/types";
import { BrandLockup } from "../ui/PufferblowBrand";

const count = (n: number | null | undefined) => (n === null || n === undefined ? null : n.toLocaleString());

/**
 * The key art beside the sign-in form. Until a handle points at an instance it is the brand; once
 * one does, it is that instance: its banner, name, how many people are on it and where it is hosted,
 * so you can see where you are going before you type a password.
 */
export function AuthArt({ instance, info }: { instance: InstanceConfig | null; info: ServerInfo | null }) {
  const host = instance?.raw;
  const identityOf = identity(host ?? "pufferblow");
  const banner = instance && info ? previewAssetUrl(instance, info.banner_url) : undefined;
  const background = banner ? `url("${banner}") center / cover` : host ? defaultBannerCss(host, "50% 40%") : bannerCss(identityOf.hex, identityOf.pattern, "50% 40%");
  const online = count(info?.online_members);
  const members = count(info?.members_count);

  return (
    <aside aria-label={info ? `${info.server_name} on ${host}` : "Pufferblow"} className="relative hidden overflow-hidden rounded-lg lg:block" style={{ background }}>
      <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(242,242,242,0.035)_0_2px,transparent_2px_16px)]" />
      <BrandLockup size={34} tone="ink" className="absolute left-7 top-7 text-on-primary" />

      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-background/90 to-transparent px-8 pb-8 pt-32">
        {info && instance ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-text px-2.5 py-[5px] font-heading text-[11px] font-bold uppercase leading-none tracking-[0.14em] text-on-primary">
              <Flame size={12} aria-hidden="true" />
              Your instance
            </span>
            <h2 className="mb-2 mt-3.5 font-display text-5xl font-normal leading-[1.05]">{info.server_name}</h2>
            <div className="flex items-center gap-3.5 text-sm text-text-tertiary">
              <span className="flex" aria-hidden="true">
                {(["happy", "wink", "default"] as const).map((face, i) => (
                  <img
                    key={face}
                    src={fishUrl(face, (["violet", "coral", "sky"] as const)[i]!)}
                    alt=""
                    className={`size-[26px] rounded-full border-2 border-background ${i > 0 ? "-ml-2" : ""}`}
                  />
                ))}
              </span>
              <span>
                {online && (
                  <>
                    <b className="font-semibold text-text">{online}</b> online
                  </>
                )}
                {online && members && " · "}
                {members && `${members} members`}
                {(online || members) && " · "}hosted on {instance.host}
              </span>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-5xl font-normal leading-[1.05]">A quiet room full of loud fish.</h2>
            <p className="mt-3 max-w-md text-[15px] text-text-tertiary">Join any Pufferblow instance and talk with people across the fediverse.</p>
          </>
        )}
      </div>
    </aside>
  );
}
