"use client";

import { LoaderCircle } from "lucide-react";

import Dialog from "@/components/ui/Dialog";
import type { AlbumSummary } from "@/lib/albums";

export default function DeleteDialog({
  album,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  album: AlbumSummary | null;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={album !== null}
      onClose={onClose}
      title="Supprimer cet album ?"
      description={
        album
          ? `« ${album.title || "Album sans titre"} » disparaîtra de votre liste, avec ses photos.`
          : undefined
      }
    >
      {error && (
        <p role="alert" className="-mt-2 mb-4 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-12 rounded-full border border-neutral-300 px-6 font-medium text-neutral-900 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-900"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          aria-busy={pending}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-red-600 px-6 font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-60"
        >
          {pending && <LoaderCircle aria-hidden className="size-5 animate-spin" />}
          Supprimer
        </button>
      </div>
    </Dialog>
  );
}
