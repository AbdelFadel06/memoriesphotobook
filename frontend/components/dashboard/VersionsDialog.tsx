"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";

import Dialog from "@/components/ui/Dialog";
import { fetchVersions, restoreVersion, type AlbumSummary } from "@/lib/albums";
import { dateTime, pagesLabel } from "@/lib/format";

/** History of an album; restoring creates a new version, the past is never rewritten. */
export default function VersionsDialog({
  album,
  onClose,
}: {
  album: AlbumSummary | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const versions = useQuery({
    queryKey: ["albums", album?.id, "versions"],
    queryFn: () => fetchVersions(album!.id),
    enabled: album !== null,
  });
  const restore = useMutation({
    mutationFn: (number: number) => restoreVersion(album!.id, number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["albums"] });
      onClose();
    },
  });

  return (
    <Dialog
      open={album !== null}
      onClose={() => {
        restore.reset();
        onClose();
      }}
      title="Versions précédentes"
      description="Chaque enregistrement est conservé. Restaurer une version la remet en premier, sans effacer les autres."
    >
      {versions.isPending ? (
        <div aria-busy="true" aria-label="Chargement" className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-neutral-100" />
          ))}
        </div>
      ) : versions.isError ? (
        <p role="alert" className="text-red-600">
          {versions.error.message}
        </p>
      ) : (
        <ol className="-mx-2 max-h-80 overflow-y-auto">
          {versions.data.map((version, index) => (
            <li
              key={version.number}
              className="flex items-center justify-between gap-4 rounded-2xl px-2 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-neutral-900">
                  {index === 0 ? "Version actuelle" : `Version ${version.number}`}
                </p>
                <p className="text-sm text-neutral-500">
                  {dateTime(version.created_at)} · {pagesLabel(version.page_count)}
                </p>
              </div>
              {index > 0 && (
                <button
                  type="button"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(version.number)}
                  className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-neutral-300 px-4 text-sm font-medium text-neutral-900 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-900 disabled:opacity-50"
                >
                  {restore.isPending && restore.variables === version.number && (
                    <LoaderCircle aria-hidden className="size-4 animate-spin" />
                  )}
                  Restaurer
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {restore.isError && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {restore.error.message}
        </p>
      )}
    </Dialog>
  );
}
