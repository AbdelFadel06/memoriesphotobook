"use client";

import { LoaderCircle, X } from "lucide-react";
import type { ReactNode } from "react";

export const STEPS = ["Format", "Photos", "Thème", "Validation"] as const;

/** Full-screen frame: progress on top, the step in the middle, actions at the bottom. */
export default function WizardShell({
  step,
  onClose,
  onBack,
  onNext,
  nextLabel = "Continuer",
  nextDisabled,
  pending,
  footerNote,
  children,
}: {
  step: number;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  pending?: boolean;
  footerNote?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col bg-white">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <span className="font-brand text-[2rem] leading-none text-neutral-900">Memories</span>
          <p className="ml-auto text-sm text-neutral-500" aria-live="polite">
            Étape {step + 1} sur {STEPS.length} ·{" "}
            <span className="text-neutral-900">{STEPS[step]}</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Quitter la création d'album"
            className="-mr-2 grid size-10 place-items-center rounded-full text-neutral-700 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-900"
          >
            <X aria-hidden className="size-5" strokeWidth={2} />
          </button>
        </div>
        <div
          role="progressbar"
          aria-label="Progression"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          className="h-1 bg-neutral-100"
        >
          <div
            className="h-full bg-neutral-900 transition-[width] duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">{children}</div>
      </main>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          {step > 0 && (
            <button
              type="button"
              onClick={onBack}
              disabled={pending}
              className="h-12 rounded-full px-5 font-medium text-neutral-700 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-900 disabled:opacity-50"
            >
              Retour
            </button>
          )}
          <div className="ml-auto flex items-center gap-4">
            {footerNote && <p className="hidden text-sm text-neutral-500 sm:block">{footerNote}</p>}
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled || pending}
              aria-busy={pending}
              className="flex h-12 items-center gap-2 rounded-full bg-neutral-900 px-7 font-medium text-white shadow-[0_12px_24px_-10px_rgb(0_0_0/0.45)] transition hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {pending && <LoaderCircle aria-hidden className="size-5 animate-spin" />}
              {nextLabel}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-neutral-500 sm:text-lg">{subtitle}</p>
    </div>
  );
}
