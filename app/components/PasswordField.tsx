import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import Input, { type InputProps } from './Input';

/**
 * Password input with a reveal toggle + Caps Lock indicator.
 *
 * Wraps the standard Input. The toggle button never auto-focuses (so it
 * doesn't steal focus from the field after submit) and is hidden when
 * the input is disabled so a form-in-flight can't get caught in a
 * half-revealed state.
 *
 * Pass through every InputProps except `type` and `endAdornment` —
 * the field controls both internally.
 */
type PasswordFieldProps = Omit<InputProps, 'type' | 'endAdornment'>;

export const PasswordField: React.FC<PasswordFieldProps> = ({
  helperText,
  onKeyDown,
  onKeyUp,
  onBlur,
  disabled,
  ...rest
}) => {
  const [revealed, setRevealed] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  // Browsers don't fire keyup on key.modifierState reliably, so we sample
  // on both keydown and keyup. We never store the key itself.
  const captureCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    try {
      setCapsLockOn(event.getModifierState('CapsLock'));
    } catch {
      // Browsers without getModifierState — just leave the indicator off.
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    captureCapsLock(event);
    onKeyDown?.(event);
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLInputElement>) => {
    captureCapsLock(event);
    onKeyUp?.(event);
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    setCapsLockOn(false);
    onBlur?.(event);
  };

  const effectiveHelper = capsLockOn
    ? helperText
      ? `${helperText} · Caps Lock is on`
      : 'Caps Lock is on'
    : helperText;

  return (
    <Input
      {...rest}
      type={revealed ? 'text' : 'password'}
      helperText={effectiveHelper}
      disabled={disabled}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onBlur={handleBlur}
      endAdornment={
        disabled ? undefined : (
          <button
            type="button"
            // tabIndex={-1} keeps the toggle out of the natural tab order
            // so a sighted user pressing Tab after typing a password lands
            // on the next field, not on the reveal button.
            tabIndex={-1}
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
          >
            {revealed ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )
      }
    />
  );
};

export default PasswordField;
