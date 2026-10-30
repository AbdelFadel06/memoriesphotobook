"use client";

import Link from "next/link";

import UserAvatar from "@/components/ui/UserAvatar";
import { useCurrentUser } from "@/lib/useCurrentUser";

/** Header of the signed-in pages: brand on the left, profile avatar on the right. */
export default function AppHeader() {
  const me = useCurrentUser();

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/dashboard"
          className="font-brand rounded-lg text-[2rem] leading-none text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900"
        >
          Memories
        </Link>

        {me.data ? (
          <Link
            href="/profile"
            aria-label="Mon profil"
            title={me.data.name || me.data.email}
            className="rounded-full ring-offset-2 transition hover:ring-2 hover:ring-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          >
            <UserAvatar name={me.data.name} email={me.data.email} avatarUrl={me.data.avatar_url} />
          </Link>
        ) : (
          <span aria-hidden className="size-9 animate-pulse rounded-full bg-neutral-200" />
        )}
      </div>
    </header>
  );
}
