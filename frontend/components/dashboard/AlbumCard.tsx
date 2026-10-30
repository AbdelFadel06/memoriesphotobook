"use client";

import { BookImage, History, MoreHorizontal, PencilLine, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type { AlbumSummary } from "@/lib/albums";
import { formatLabel, pagesLabel, relativeTime } from "@/lib/format";

import AlbumCover from "./AlbumCover";

export default function AlbumCard({
  album,
  onVersions,
  onDelete,
}: {
  album: AlbumSummary;
  onVersions: () => void;
  onDelete: () => void;
}) {
  const href = `/albums/${album.id}/edit`;
  const title = album.title || "Album sans titre";

  return (
    <article className="group relative">
      <Link
        href={href}
        className="block rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neutral-900"
      >
        <div className="grid aspect-square place-items-center rounded-3xl bg-neutral-100 transition-colors group-hover:bg-neutral-200/70">
          {album.cover ? (
            <AlbumCover
              page={album.cover.page}
              formatId={album.format}
              themeId={album.theme}
              accent={album.accent_color}
              options={album.cover.options}
              photos={album.cover.photos}
            />
          ) : (
            <BookImage aria-hidden className="size-10 text-neutral-400" strokeWidth={1.5} />
          )}
        </div>
        <h3 className="mt-3 truncate px-1 font-semibold text-neutral-900">{title}</h3>
        <p className="mt-0.5 truncate px-1 text-sm text-neutral-500">
          {formatLabel(album.format)} · {pagesLabel(album.page_count)}
        </p>
        <p className="truncate px-1 text-sm text-neutral-400">
          Modifié <time dateTime={album.updated_at}>{relativeTime(album.updated_at)}</time>
        </p>
      </Link>

      <CardMenu label={`Actions pour ${title}`}>
        {(close) => (
          <>
            <MenuLink href={href} icon={<PencilLine className="size-5" strokeWidth={2} />}>
              Ouvrir
            </MenuLink>
            <MenuButton
              onClick={() => {
                close();
                onVersions();
              }}
              icon={<History className="size-5" strokeWidth={2} />}
            >
              Versions précédentes
            </MenuButton>
            <MenuButton
              danger
              onClick={() => {
                close();
                onDelete();
              }}
              icon={<Trash2 className="size-5" strokeWidth={2} />}
            >
              Supprimer
            </MenuButton>
          </>
        )}
      </CardMenu>
    </article>
  );
}

function CardMenu({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !ref.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="absolute top-3 right-3">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-full bg-white/90 text-neutral-900 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-white focus-visible:outline-2 focus-visible:outline-neutral-900"
      >
        <MoreHorizontal aria-hidden className="size-5" strokeWidth={2} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-2 w-60 rounded-2xl bg-white py-1.5 text-neutral-900 shadow-xl ring-1 ring-black/5"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const ITEM =
  "flex w-full items-center gap-3 px-4 py-2.5 text-left font-medium hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none";

function MenuLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link role="menuitem" href={href} className={ITEM}>
      <span aria-hidden>{icon}</span>
      {children}
    </Link>
  );
}

function MenuButton({
  onClick,
  icon,
  danger,
  children,
}: {
  onClick: () => void;
  icon: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`${ITEM} ${danger ? "text-red-600" : ""}`}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </button>
  );
}
