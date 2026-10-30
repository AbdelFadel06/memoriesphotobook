"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookImage, LogOut, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import AvatarEditor from "@/components/profile/AvatarEditor";
import { SettingsButton, SettingsLink, SettingsSection } from "@/components/profile/SettingsRow";
import { clearTokens } from "@/lib/auth";
import { useCurrentUser } from "@/lib/useCurrentUser";

const ICON = { className: "size-6", strokeWidth: 1.75 } as const;

/** Profile hub: dark band with the user, then the settings menu on a white sheet. */
export default function ProfileView() {
  const me = useCurrentUser();
  const router = useRouter();
  const queryClient = useQueryClient();

  function logout() {
    clearTokens();
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <div className="min-h-dvh bg-white md:bg-neutral-100">
      {/* No z-index here: the band stays under the sheet's rounded corners while the
          photo menu (z-30) still opens above the sheet (z-10). */}
      <header className="relative bg-neutral-950 text-white">
        {/* Subtle diagonal light shapes, as on the mock-up; clipped on their own layer */}
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 right-[-10%] h-80 w-2/3 rotate-[-28deg] bg-white/[0.04]" />
          <div className="absolute top-10 right-[-30%] h-80 w-2/3 rotate-[-28deg] bg-white/[0.03]" />
        </div>

        <div className="relative mx-auto max-w-xl px-6 pt-6 pb-16 md:max-w-3xl md:px-10 lg:max-w-5xl lg:pt-10 lg:pb-24">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              aria-label="Retour à mes albums"
              className="-ml-2 grid size-10 place-items-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
            >
              <ArrowLeft aria-hidden className="size-6" strokeWidth={2} />
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Profil</h1>
          </div>

          <div className="mt-8 flex min-h-20 items-center gap-5 lg:mt-12 lg:gap-8">
            {me.data ? (
              <>
                <AvatarEditor user={me.data} />
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold lg:text-3xl">
                    {me.data.name || "Votre profil"}
                  </p>
                  <p className="mt-1 truncate text-white/75 lg:mt-2 lg:text-lg">{me.data.email}</p>
                  <p className="mt-1 hidden text-sm text-white/55 md:block">
                    Membre depuis {memberSince(me.data.created_at)}
                  </p>
                </div>
              </>
            ) : (
              <div aria-busy="true" aria-label="Chargement" className="flex items-center gap-5">
                <span className="size-20 animate-pulse rounded-full bg-white/10 lg:size-28" />
                <span className="h-6 w-48 animate-pulse rounded-full bg-white/10" />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-8 max-w-xl rounded-t-4xl bg-white px-7 pt-7 pb-12 md:mb-12 md:max-w-3xl md:rounded-4xl md:px-10 md:pt-9 md:shadow-sm lg:-mt-12 lg:max-w-5xl lg:px-14 lg:pt-12 lg:pb-14">
        {me.isError && !me.unauthorized ? (
          <div role="alert" className="pt-6">
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
          <div className="md:grid md:grid-cols-2 md:gap-x-12 lg:gap-x-20">
            <SettingsSection title="Paramètres du compte">
              <SettingsLink href="/profile/informations" icon={<UserRound {...ICON} />}>
                Informations personnelles
              </SettingsLink>
              <SettingsLink href="/profile/securite" icon={<ShieldCheck {...ICON} />}>
                Mot de passe et sécurité
              </SettingsLink>
            </SettingsSection>

            <SettingsSection title="Autre">
              <SettingsLink href="/dashboard" icon={<BookImage {...ICON} />}>
                Mes albums
              </SettingsLink>
              <SettingsButton onClick={logout} icon={<LogOut {...ICON} />}>
                Se déconnecter
              </SettingsButton>
            </SettingsSection>
          </div>
        )}
      </main>
    </div>
  );
}

function memberSince(isoDate: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(isoDate),
  );
}
