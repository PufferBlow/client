import { Panel } from "../../components/control-panel/Panel";

/** Placeholder for sections that have a place in the navigation but no screen yet. */
export function ComingSoon({ planned }: { planned: readonly string[] }) {
  return (
    <Panel title="Coming soon" description="This part of the control panel isn't built yet. It will cover:">
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-text-secondary">
        {planned.map((item) => (
          <li key={item} className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
