import { Outlet } from "react-router";
import { Globe, Radio, ShieldCheck } from "lucide-react";
import { BrandLockup } from "../components/ui/PufferblowBrand";

const HIGHLIGHTS = [
  { icon: Globe, label: "Federated spaces" },
  { icon: Radio, label: "Voice & text" },
  { icon: ShieldCheck, label: "Self-hosted" },
];

export function AuthLayout() {
  return (
    <div className="grid h-full w-full gap-2.5 bg-background p-2.5 lg:grid-cols-[minmax(0,1fr)_460px]">
      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden rounded-[14px] bg-[radial-gradient(120%_100%_at_20%_10%,#3a3a3a_0%,#1a1a1a_75%)] lg:block"
      >
        <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(242, 242, 242,0.035)_0_2px,transparent_2px_16px)]" />

        <BrandLockup size={44} className="absolute left-7 top-7" />

        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-background/90 to-transparent px-8 pb-8 pt-32">
          <h2 className="font-display text-5xl leading-[1.05]">Your community, on your terms.</h2>
          <p className="mb-5 mt-3 max-w-md text-[15px] text-text-tertiary">
            Join any Pufferblow instance and talk with people across the fediverse.
          </p>
          <ul className="flex flex-wrap gap-2.5">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full bg-background/60 px-3 py-1.5 text-[13px] text-text-secondary"
              >
                <Icon size={14} className="text-primary" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex min-h-0 flex-col overflow-y-auto rounded-[14px] bg-surface px-6 py-10 sm:px-10 lg:py-12">
        <BrandLockup size={34} className="mb-8 lg:hidden" />
        <Outlet />
      </main>
    </div>
  );
}
