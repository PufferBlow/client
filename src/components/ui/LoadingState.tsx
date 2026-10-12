import { Spinner } from "./Spinner";

export interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Spinner size="lg" className="text-primary" />
      <p className="mt-4 text-sm text-text-secondary">{message}</p>
    </div>
  );
}
