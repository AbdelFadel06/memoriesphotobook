"use client";

import { BookImage } from "lucide-react";

import AppHeader from "@/components/layout/AppHeader";
import { useCurrentUser } from "@/lib/useCurrentUser";

/** Placeholder until the album history (step 4): checks the session and greets the user. */
export default function DashboardView() {
  const me = useCurrentUser();

  return (
    <div className="min-h-dvh bg-neutral-50">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {me.isPending || me.unauthorized ? (
          <div aria-busy="true" aria-label="Chargement" className="space-y-3">
            <div className="h-8 w-64 animate-pulse rounded-full bg-neutral-200" />
            <div className="h-48 animate-pulse rounded-3xl bg-neutral-200" />
          </div>
        ) : me.isError ? (
          <div role="alert" className="text-center">
            <p className="text-red-600">{me.error.message}</p>
            <button
              type="button"
              onClick={() => me.refetch()}
              className="mt-4 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-black"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Mes albums</h1>
            <div className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
              <BookImage aria-hidden className="size-10 text-neutral-400" strokeWidth={1.5} />
              <p className="mt-4 font-medium text-neutral-900">
                Vous n&apos;avez pas encore d&apos;album
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                La création d&apos;album arrive très bientôt.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
