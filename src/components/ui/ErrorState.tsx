import { AlertCircle } from "lucide-react";
import { Button } from "./Button";

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 rounded-full border border-border-secondary bg-surface p-3">
        <AlertCircle className="h-6 w-6 text-error" />
      </div>
      <h3 className="text-base font-medium text-text">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-text-secondary">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
