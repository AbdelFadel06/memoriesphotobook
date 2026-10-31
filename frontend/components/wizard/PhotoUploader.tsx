"use client";

import { CircleAlert, ImagePlus, LoaderCircle, RotateCw, X } from "lucide-react";
import { useState, type DragEvent } from "react";

import { getFormat } from "@/lib/layouts";
import { PHOTO_TYPES } from "@/lib/photos";
import { QUALITY_MESSAGES, qualityFor } from "@/lib/quality";
import type { Rejection, UploadItem } from "@/lib/useUploader";

import { StepTitle } from "./WizardShell";

export type PhotoOrder = "date" | "manual";

/** Display order: by shooting date (photos without date last), or as added. */
export function orderItems(items: UploadItem[], order: PhotoOrder): UploadItem[] {
  if (order === "manual") return [...items].sort((a, b) => a.addedAt - b.addedAt);
  return [...items].sort((a, b) => {
    const da = a.photo?.taken_at ? Date.parse(a.photo.taken_at) : Infinity;
    const db = b.photo?.taken_at ? Date.parse(b.photo.taken_at) : Infinity;
    return da === db ? a.addedAt - b.addedAt : da - db;
  });
}

export default function PhotoUploader({
  items,
  formatId,
  order,
  onOrder,
  onAdd,
  onRetry,
  onRemove,
}: {
  items: UploadItem[];
  formatId: string;
  order: PhotoOrder;
  onOrder: (order: PhotoOrder) => void;
  onAdd: (files: File[]) => Rejection[];
  onRetry: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<Rejection[]>([]);
  const format = getFormat(formatId);
  const ready = items.filter((item) => item.status === "ready").length;
  const inProgress = items.filter((i) => i.status !== "ready" && i.status !== "failed").length;

  function add(files: FileList | null) {
    if (!files?.length) return;
    setRejected(onAdd(Array.from(files)));
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    add(event.dataTransfer.files);
  }

  return (
    <>
      <StepTitle
        title="Ajoutez vos photos"
        subtitle="Elles seront placées automatiquement. Vous pourrez tout ajuster ensuite."
      />

      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-8 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 text-center transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900 ${
          items.length ? "py-8" : "py-16 sm:py-20"
        } ${dragging ? "border-neutral-900 bg-neutral-50" : "border-neutral-300 hover:border-neutral-500"}`}
      >
        <input
          type="file"
          multiple
          accept={[...PHOTO_TYPES, ".heic", ".heif"].join(",")}
          onChange={(event) => {
            add(event.target.files);
            event.target.value = "";
          }}
          className="sr-only"
        />
        <ImagePlus aria-hidden className="size-10 text-neutral-500" strokeWidth={1.5} />
        <span className="mt-3 text-lg font-semibold text-neutral-900">Glissez vos photos ici</span>
        <span className="mt-1 text-neutral-500">
          ou{" "}
          <span className="font-medium text-neutral-900 underline underline-offset-4">
            parcourez vos fichiers
          </span>
        </span>
        <span className="mt-3 text-sm text-neutral-400">
          JPEG, PNG, WebP ou HEIC · 30 Mo maximum par photo
        </span>
      </label>

      {rejected.length > 0 && (
        <div role="alert" className="mt-4 text-sm text-red-600">
          <p>
            {rejected.length} fichier{rejected.length > 1 ? "s ont été ignorés" : " a été ignoré"} :
          </p>
          <ul className="mt-1 list-inside list-disc">
            {rejected.slice(0, 5).map((r) => (
              <li key={r.name}>
                {r.name} ({r.reason})
              </li>
            ))}
          </ul>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
            <p className="text-neutral-700" aria-live="polite">
              <span className="font-semibold text-neutral-900">{ready}</span> photo
              {ready > 1 ? "s" : ""} prête
              {ready > 1 ? "s" : ""}
              {inProgress > 0 && (
                <span className="text-neutral-500"> · {inProgress} en cours d&apos;envoi</span>
              )}
            </p>
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              Ordre
              <select
                value={order}
                onChange={(event) => onOrder(event.target.value as PhotoOrder)}
                className="h-10 rounded-full border border-neutral-300 bg-white px-4 text-neutral-900 focus-visible:outline-2 focus-visible:outline-neutral-900"
              >
                <option value="date">Par date de prise de vue</option>
                <option value="manual">Dans l&apos;ordre d&apos;ajout</option>
              </select>
            </label>
          </div>

          <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {orderItems(items, order).map((item) => (
              <PhotoTile
                key={item.key}
                item={item}
                quality={
                  item.photo?.width && item.photo.height
                    ? qualityFor(item.photo.width, item.photo.height, format)
                    : "ok"
                }
                onRetry={() => onRetry(item.key)}
                onRemove={() => onRemove(item.key)}
              />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function PhotoTile({
  item,
  quality,
  onRetry,
  onRemove,
}: {
  item: UploadItem;
  quality: "ok" | "low" | "bad";
  onRetry: () => void;
  onRemove: () => void;
}) {
  const src = item.photo?.thumb_url ?? item.localUrl;
  const warning = item.status === "ready" && quality !== "ok" ? QUALITY_MESSAGES[quality] : null;

  return (
    <li className="group relative aspect-square overflow-hidden rounded-2xl bg-neutral-100">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob or signed thumbnail
        <img
          src={src}
          alt={item.file.name}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <span className="grid size-full place-items-center p-2 text-center text-xs text-neutral-500">
          {item.file.name}
        </span>
      )}

      {(item.status === "queued" || item.status === "uploading") && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
          <div
            role="progressbar"
            aria-label={`Envoi de ${item.file.name}`}
            aria-valuenow={Math.round(item.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 overflow-hidden rounded-full bg-white/30"
          >
            <div
              className="h-full bg-white transition-[width]"
              style={{ width: `${item.progress * 100}%` }}
            />
          </div>
        </div>
      )}
      {item.status === "processing" && (
        <div className="absolute inset-0 grid place-items-center bg-white/50">
          <LoaderCircle aria-label="Préparation" className="size-6 animate-spin text-neutral-900" />
        </div>
      )}
      {item.status === "failed" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-950/75 p-2 text-center text-xs text-white">
          <CircleAlert aria-hidden className="size-5" />
          <span className="line-clamp-3">{item.error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1 rounded-full bg-white px-3 py-1 font-medium text-neutral-900 focus-visible:outline-2 focus-visible:outline-white"
          >
            <RotateCw aria-hidden className="size-3.5" /> Réessayer
          </button>
        </div>
      )}
      {warning && (
        <span
          title={warning}
          className={`absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold leading-tight text-white shadow ${
            quality === "bad" ? "bg-red-600" : "bg-orange-500"
          }`}
        >
          <CircleAlert aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{warning}</span>
        </span>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Retirer ${item.file.name}`}
        className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-white/90 text-neutral-900 opacity-100 shadow transition focus-visible:outline-2 focus-visible:outline-neutral-900 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <X aria-hidden className="size-4" strokeWidth={2.5} />
      </button>
    </li>
  );
}
