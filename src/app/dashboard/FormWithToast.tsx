'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import clsx from 'clsx';
import { useToast } from './ToastProvider';

export interface ActionState {
  ok: boolean;
  message: string;
}

export const initialActionState: ActionState = { ok: true, message: '' };

function SubmitButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className ?? 'btn-primary'} disabled={pending}>
      {pending ? (pendingLabel ?? 'Enregistrement…') : label}
    </button>
  );
}

/** Wraps a server action returning `ActionState` with a form that surfaces a success/error toast. */
export function FormWithToast({
  action,
  children,
  className,
  submitLabel = 'Enregistrer',
  pendingLabel,
  buttonClassName,
  resetOnSuccess = false,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  submitLabel?: string;
  pendingLabel?: string;
  buttonClassName?: string;
  /** Clears the form's fields after a successful submission - useful for "add" forms kept on the same page. */
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useFormState(action, initialActionState);
  const { showToast } = useToast();
  const seen = useRef<ActionState>(initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state !== seen.current && state.message) {
      seen.current = state;
      showToast(state.message, state.ok ? 'success' : 'error');
      if (state.ok && resetOnSuccess) formRef.current?.reset();
    }
  }, [state, showToast, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      <SubmitButton label={submitLabel} pendingLabel={pendingLabel} className={buttonClassName} />
    </form>
  );
}

function ActionSubmitButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingLabel ?? '…') : label}
    </button>
  );
}

/** Single-click action (toggle/delete/revoke) that surfaces a success/error toast, no other fields. */
export function ActionButton({
  action,
  label,
  pendingLabel,
  variant = 'secondary',
  className,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}) {
  const [state, formAction] = useFormState(action, initialActionState);
  const { showToast } = useToast();
  const seen = useRef<ActionState>(initialActionState);

  useEffect(() => {
    if (state !== seen.current && state.message) {
      seen.current = state;
      showToast(state.message, state.ok ? 'success' : 'error');
    }
  }, [state, showToast]);

  const variantClass = variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : 'btn-secondary';

  return (
    <form action={formAction}>
      <ActionSubmitButton label={label} pendingLabel={pendingLabel} className={clsx(variantClass, className)} />
    </form>
  );
}
