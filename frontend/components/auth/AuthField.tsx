import type { InputHTMLAttributes, ReactNode } from "react";

type AuthFieldProps = {
  id: string;
  label: string;
  /** Mobile only: icon shown left of the field. */
  icon: ReactNode;
  /** Buttons shown at the right of the field (clear, show password…). */
  trailing?: ReactNode;
  error?: string;
  /** Red border without a message of its own (the message is shown elsewhere). */
  invalid?: boolean;
  /** Id of an external message describing the field, e.g. a form-level error. */
  describedById?: string;
  hint?: string;
  /** Desktop only: link aligned with the label (e.g. forgotten password). */
  labelAside?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id">;

/**
 * Mobile: icon + divider + floating label inside a tall rounded box.
 * Desktop: classic label above a compact input.
 */
export default function AuthField({
  id,
  label,
  icon,
  trailing,
  error,
  invalid,
  describedById,
  hint,
  labelAside,
  className,
  ...input
}: AuthFieldProps) {
  const hasError = Boolean(error) || Boolean(invalid);
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`, describedById]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between">
        {/* The real label: visually hidden on mobile where the floating one is shown. */}
        <label
          htmlFor={id}
          className="sr-only md:not-sr-only md:mb-1.5 md:px-5 md:text-[15px] md:font-semibold md:text-neutral-900"
        >
          {label}
        </label>
        {labelAside}
      </div>
      <div
        className={`flex h-16 items-center gap-3 rounded-full border bg-white px-5 transition-shadow md:h-12 md:gap-2 ${
          hasError
            ? "border-red-500 ring-2 ring-red-500/15"
            : "border-neutral-200 focus-within:border-neutral-900 focus-within:ring-4 focus-within:ring-neutral-900/10 md:border-neutral-300"
        }`}
      >
        <span aria-hidden className="text-neutral-800 md:hidden">
          {icon}
        </span>
        <span aria-hidden className="h-8 w-px bg-neutral-200 md:hidden" />
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <span
            aria-hidden
            className="text-[13px] leading-tight font-semibold text-neutral-700 md:hidden"
          >
            {label}
          </span>
          <input
            id={id}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy || undefined}
            className="w-full bg-transparent text-[17px] text-neutral-900 outline-none placeholder:text-transparent md:text-[15px] md:placeholder:text-neutral-400"
            {...input}
          />
        </div>
        {trailing}
      </div>
      {hint && !hasError && (
        <p id={`${id}-hint`} className="mt-1.5 px-5 text-sm text-neutral-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 px-5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
