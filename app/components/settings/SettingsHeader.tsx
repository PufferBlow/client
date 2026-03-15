import { Notice } from "../ui/Notice";

type SettingsHeaderProps = {
  title: string;
  message: { type: "success" | "error"; text: string } | null;
  onDismissMessage: () => void;
};

export function SettingsHeader({ title, message, onDismissMessage }: SettingsHeaderProps) {
  return (
    <div className="flex h-12 flex-shrink-0 items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6">
      <div className="flex items-center space-x-4">
        <h1 className="text-base font-semibold text-[var(--color-text)]">{title}</h1>
        {message && (
          <div className="ml-auto">
            <Notice
              tone={message.type === "success" ? "success" : "error"}
              message={message.text}
              onClose={onDismissMessage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
