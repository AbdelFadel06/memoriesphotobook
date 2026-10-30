"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { User } from "@/lib/auth";
import { useCurrentUser } from "@/lib/useCurrentUser";

/** Profile sub-page: back arrow to /profile, title, intro and content (needs a session). */
export default function SubPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: (user: User) => ReactNode;
}) {
  const me = useCurrentUser();

  return (
    <div className="min-h-dvh bg-white md:bg-neutral-100 md:py-10">
      <main className="mx-auto max-w-xl bg-white px-6 pt-6 pb-10 md:rounded-4xl md:px-10 md:pt-8 md:shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            aria-label="Retour au profil"
            className="-ml-2 grid size-10 place-items-center rounded-full text-neutral-900 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-900"
          >
            <ArrowLeft aria-hidden className="size-6" strokeWidth={2} />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
        </div>
        <p className="mt-4 text-neutral-500">{intro}</p>

        <div className="mt-8">
          {me.isPending || me.unauthorized ? (
            <div aria-busy="true" aria-label="Chargement" className="space-y-4">
              <div className="h-16 animate-pulse rounded-full bg-neutral-100" />
              <div className="h-16 animate-pulse rounded-full bg-neutral-100" />
            </div>
          ) : me.isError ? (
            <div role="alert">
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
            children(me.data)
          )}
        </div>
      </main>
    </div>
  );
}
