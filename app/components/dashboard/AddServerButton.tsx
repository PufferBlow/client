import React from "react";

interface AddServerButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export const AddServerButton: React.FC<AddServerButtonProps> = ({
  onClick,
  disabled = false,
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`pb-focus-ring mt-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-border-secondary)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-[background-color,color,border-color,border-radius] duration-200 hover:rounded-xl hover:border-[var(--color-success)]/50 hover:bg-[var(--color-success)] hover:text-[var(--color-on-success)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      title="Add a server"
      aria-label="Add a server"
    >
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    </button>
  );
};

export default AddServerButton;

