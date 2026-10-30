"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { BookImage, LoaderCircle } from "lucide-react";
import { useState } from "react";

import AlbumCard from "@/components/dashboard/AlbumCard";
import DeleteDialog from "@/components/dashboard/DeleteDialog";
import VersionsDialog from "@/components/dashboard/VersionsDialog";
import AppHeader from "@/components/layout/AppHeader";
import {
  cursorFrom,
  deleteAlbum,
  fetchAlbums,
  type AlbumPage,
  type AlbumSummary,
} from "@/lib/albums";
import { useCurrentUser } from "@/lib/useCurrentUser";

const ALBUMS_KEY = ["albums", "list"] as const;

/** Album history: covers rendered with page-render, open / versions / delete. */
export default function DashboardView() {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const [versionsOf, setVersionsOf] = useState<AlbumSummary | null>(null);
  const [toDelete, setToDelete] = useState<AlbumSummary | null>(null);

  const list = useInfiniteQuery({
    queryKey: ALBUMS_KEY,
    queryFn: ({ pageParam }) => fetchAlbums(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => cursorFrom(last.next),
    enabled: me.isSuccess,
  });

  const remove = useMutation({
    mutationFn: (album: AlbumSummary) => deleteAlbum(album.id),
    onSuccess: (_, album) => {
      // Drop it from the cached pages right away, then resync quietly.
      queryClient.setQueryData<InfiniteData<AlbumPage>>(ALBUMS_KEY, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                results: page.results.filter((a) => a.id !== album.id),
              })),
            }
          : data,
      );
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ALBUMS_KEY });
    },
  });

  const albums = list.data?.pages.flatMap((page) => page.results) ?? [];
  const loading = me.isPending || me.unauthorized || (me.isSuccess && list.isPending);
  const error = me.isError && !me.unauthorized ? me.error : list.error;

  return (
    <div className="min-h-dvh bg-white">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          Mes albums
        </h1>
        <p className="mt-1 text-neutral-500">Du plus récent au plus ancien.</p>

        <div className="mt-8">
          {loading ? (
            <Grid>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} aria-hidden>
                  <div className="aspect-square animate-pulse rounded-3xl bg-neutral-100" />
                  <div className="mt-3 h-4 w-2/3 animate-pulse rounded-full bg-neutral-100" />
                  <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-neutral-100" />
                </div>
              ))}
              <span className="sr-only">Chargement de vos albums…</span>
            </Grid>
          ) : error ? (
            <div role="alert" className="py-16 text-center">
              <p className="text-red-600">{error.message}</p>
              <button
                type="button"
                onClick={() => (me.isError ? me.refetch() : list.refetch())}
                className="mt-4 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              >
                Réessayer
              </button>
            </div>
          ) : albums.length === 0 ? (
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-neutral-300 px-6 py-20 text-center">
              <BookImage aria-hidden className="size-12 text-neutral-400" strokeWidth={1.5} />
              <p className="mt-4 text-lg font-medium text-neutral-900">
                Vous n&apos;avez pas encore d&apos;album
              </p>
              <p className="mt-1 text-neutral-500">La création d&apos;album arrive très bientôt.</p>
            </div>
          ) : (
            <>
              <Grid>
                {albums.map((album) => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    onVersions={() => setVersionsOf(album)}
                    onDelete={() => {
                      remove.reset();
                      setToDelete(album);
                    }}
                  />
                ))}
              </Grid>
              {list.hasNextPage && (
                <div className="mt-10 flex justify-center">
                  <button
                    type="button"
                    onClick={() => list.fetchNextPage()}
                    disabled={list.isFetchingNextPage}
                    className="flex h-12 items-center gap-2 rounded-full border border-neutral-300 px-6 font-medium text-neutral-900 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-900 disabled:opacity-60"
                  >
                    {list.isFetchingNextPage && (
                      <LoaderCircle aria-hidden className="size-5 animate-spin" />
                    )}
                    Afficher plus d&apos;albums
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <VersionsDialog album={versionsOf} onClose={() => setVersionsOf(null)} />
      <DeleteDialog
        album={toDelete}
        pending={remove.isPending}
        error={remove.error?.message ?? null}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  );
}
