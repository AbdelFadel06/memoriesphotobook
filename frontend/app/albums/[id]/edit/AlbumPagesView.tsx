"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { PageRender } from "@/components/page-render";
import AppHeader from "@/components/layout/AppHeader";
import { fetchAlbum, fetchPhotoSources } from "@/lib/albums";
import { formatLabel, pagesLabel } from "@/lib/format";
import { getFormat, getTemplate, getTheme, templates } from "@/lib/layouts";
import { useCurrentUser } from "@/lib/useCurrentUser";

/** Read-only view of every page until the editor (step 3) replaces it. */
export default function AlbumPagesView() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const me = useCurrentUser();
  const album = useQuery({
    queryKey: ["albums", id],
    queryFn: () => fetchAlbum(id),
    enabled: me.isSuccess && Number.isInteger(id),
    retry: false,
  });
  // The photos referenced by the album JSON (the single source of truth).
  const photoIds = album.data
    ? [
        ...new Set(
          album.data.content.pages.flatMap((page) =>
            page.slots.flatMap((slot) =>
              "photoId" in slot && slot.photoId != null ? [slot.photoId] : [],
            ),
          ),
        ),
      ].sort((a, b) => a - b)
    : [];
  const photos = useQuery({
    queryKey: ["photos", photoIds],
    queryFn: () => fetchPhotoSources(photoIds),
    enabled: album.isSuccess,
  });

  return (
    <div className="min-h-dvh bg-neutral-100">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/dashboard"
          className="-ml-2 inline-flex items-center gap-2 rounded-full px-2 py-1 text-neutral-600 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-neutral-900"
        >
          <ArrowLeft aria-hidden className="size-5" strokeWidth={2} />
          Mes albums
        </Link>

        {album.isError ? (
          <p role="alert" className="mt-10 text-center text-red-600">
            {album.error.message}
          </p>
        ) : !album.data ? (
          <div aria-busy="true" aria-label="Chargement" className="mt-6 space-y-4">
            <div className="h-9 w-72 animate-pulse rounded-full bg-neutral-200" />
            <div className="h-96 animate-pulse rounded-3xl bg-neutral-200" />
          </div>
        ) : (
          <>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
              {album.data.title || "Album sans titre"}
            </h1>
            <p className="mt-1 text-neutral-500">
              {formatLabel(album.data.format)} · {pagesLabel(album.data.page_count)}
            </p>
            <p className="mt-6 rounded-2xl bg-white px-5 py-4 text-neutral-700">
              L&apos;éditeur arrive bientôt. En attendant, voici toutes les pages de votre album.
            </p>

            <ol className="mt-8 grid gap-10 md:grid-cols-2">
              {album.data.content.pages.map((page, index, pages) =>
                templates[page.layout] ? (
                  <li
                    key={page.id}
                    className={getTemplate(page.layout).spread ? "md:col-span-2" : undefined}
                  >
                    <div className="overflow-hidden rounded-sm shadow-lg">
                      <PageRender
                        page={page}
                        template={getTemplate(page.layout)}
                        theme={getTheme(album.data.content.theme)}
                        format={getFormat(album.data.content.format)}
                        accent={album.data.content.accent}
                        options={album.data.content.options}
                        photos={photos.data ?? {}}
                        runningTitle={album.data.title}
                        folio={index === 0 ? "" : String(firstPageNumber(pages, index))}
                        mode="screen"
                        showGuides={false}
                      />
                    </div>
                    <p className="mt-2 text-sm text-neutral-500">
                      {index === 0 ? "Couverture" : getTemplate(page.layout).name}
                    </p>
                  </li>
                ) : null,
              )}
            </ol>
          </>
        )}
      </main>
    </div>
  );
}

/** Printed page number of a sheet: spreads count as two pages. */
function firstPageNumber(pages: { layout: string }[], index: number): number {
  return pages.slice(0, index).reduce((n, page) => n + (templates[page.layout]?.spread ? 2 : 1), 1);
}
