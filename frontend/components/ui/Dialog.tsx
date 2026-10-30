"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Modal built on the native <dialog>: focus trap, Escape and inert background for free.
 */
export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      aria-labelledby="dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-white p-0 text-neutral-900 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <h2 id="dialog-title" className="text-xl font-semibold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              aria-label="Fermer"
              onClick={onClose}
              className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-900"
            >
              <X aria-hidden className="size-5" strokeWidth={2} />
            </button>
          </div>
          {description && <p className="mt-2 text-neutral-600">{description}</p>}
          <div className="mt-6">{children}</div>
        </div>
      )}
    </dialog>
  );
}
