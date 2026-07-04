'use client';
import { useState, type ReactNode } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

// A trigger button that opens a confirmation dialog before running `onConfirm`.
// Drop-in replacement for an inline delete button: pass the trigger's visual
// content as children and its classes via triggerClassName. The dialog closes
// itself on cancel; on a successful mutation the caller's list typically
// refetches and unmounts this button, which removes the dialog with it.
export function ConfirmButton({
  onConfirm,
  pending = false,
  error,
  title,
  message,
  confirmLabel = 'Delete',
  triggerClassName,
  triggerAriaLabel,
  disabled = false,
  children,
}: {
  onConfirm: () => void;
  pending?: boolean;
  error?: string | null;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  triggerClassName?: string;
  triggerAriaLabel?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        disabled={disabled}
        aria-label={triggerAriaLabel}
        className={triggerClassName}
      >
        {children}
      </button>
      <ConfirmDialog
        open={open}
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        pending={pending}
        error={error}
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
