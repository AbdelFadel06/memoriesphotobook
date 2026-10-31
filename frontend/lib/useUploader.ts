"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

import { ApiError } from "./api";
import {
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  PHOTOS_PER_ALBUM,
  confirmPhoto,
  fetchPhotos,
  photoType,
  presignPhoto,
  putToStorage,
  type Photo,
} from "./photos";

const PARALLEL = 3;
const NETWORK_ATTEMPTS = 3;
const POLL_MS = 1500;
const BROWSER_PREVIEWABLE = new Set(["image/jpeg", "image/png", "image/webp"]);

export type UploadStatus = "queued" | "uploading" | "processing" | "ready" | "failed";

export type UploadItem = {
  key: string;
  file: File;
  /** Local preview while the server thumbnail does not exist yet (not for HEIC). */
  localUrl: string | null;
  status: UploadStatus;
  progress: number;
  photo: Photo | null;
  photoId: number | null;
  error: string | null;
  addedAt: number;
};

type Action =
  | { type: "add"; items: UploadItem[] }
  | { type: "update"; key: string; changes: Partial<UploadItem> }
  | { type: "photos"; photos: Photo[] }
  | { type: "remove"; key: string };

function reducer(items: UploadItem[], action: Action): UploadItem[] {
  switch (action.type) {
    case "add":
      return [...items, ...action.items];
    case "update":
      return items.map((item) => (item.key === action.key ? { ...item, ...action.changes } : item));
    case "photos": {
      const byId = new Map(action.photos.map((photo) => [photo.id, photo]));
      return items.map((item) => {
        const photo = item.photoId != null ? byId.get(item.photoId) : undefined;
        if (!photo || item.status !== "processing") return item;
        if (photo.status === "ready") return { ...item, status: "ready", photo };
        if (photo.status === "failed")
          return { ...item, status: "failed", error: "Ce fichier n'est pas une photo lisible." };
        return item;
      });
    }
    case "remove":
      return items.filter((item) => item.key !== action.key);
  }
}

export type Rejection = { name: string; reason: string };

/**
 * Upload queue: presign → direct PUT to storage (progress) → confirm → poll until processed.
 * At most 3 uploads at a time; network failures are retried before giving up.
 */
export function useUploader(format: string) {
  const [items, dispatch] = useReducer(reducer, []);
  const started = useRef(new Set<string>());
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  }, [format]);

  const add = useCallback((files: File[], currentCount: number): Rejection[] => {
    const rejected: Rejection[] = [];
    const accepted: UploadItem[] = [];
    for (const file of files) {
      const type = photoType(file);
      if (!(PHOTO_TYPES as readonly string[]).includes(type)) {
        rejected.push({ name: file.name, reason: "format non pris en charge" });
      } else if (file.size > PHOTO_MAX_BYTES) {
        rejected.push({ name: file.name, reason: "plus de 30 Mo" });
      } else if (currentCount + accepted.length >= PHOTOS_PER_ALBUM) {
        rejected.push({ name: file.name, reason: `limite de ${PHOTOS_PER_ALBUM} photos` });
      } else {
        accepted.push({
          key: crypto.randomUUID(),
          file,
          localUrl: BROWSER_PREVIEWABLE.has(type) ? URL.createObjectURL(file) : null,
          status: "queued",
          progress: 0,
          photo: null,
          photoId: null,
          error: null,
          addedAt: Date.now() + accepted.length,
        });
      }
    }
    if (accepted.length) dispatch({ type: "add", items: accepted });
    return rejected;
  }, []);

  const run = useCallback(async (item: UploadItem) => {
    const update = (changes: Partial<UploadItem>) =>
      dispatch({ type: "update", key: item.key, changes });
    update({ status: "uploading", progress: 0, error: null });
    try {
      const presigned = await presignPhoto(item.file, formatRef.current);
      update({ photoId: presigned.photo_id });
      for (let attempt = 1; ; attempt++) {
        try {
          await putToStorage(presigned.upload_url, item.file, presigned.headers, (progress) =>
            update({ progress }),
          );
          break;
        } catch (error) {
          const retryable =
            error instanceof ApiError && (error.status === 0 || error.status >= 500);
          if (!retryable || attempt >= NETWORK_ATTEMPTS) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
      await confirmPhoto(presigned.photo_id);
      update({ status: "processing", progress: 1 });
    } catch (error) {
      update({
        status: "failed",
        error: error instanceof Error ? error.message : "L'envoi a échoué.",
      });
    }
  }, []);

  // Start queued uploads while fewer than PARALLEL are running.
  useEffect(() => {
    const running = items.filter((item) => item.status === "uploading").length;
    const queued = items.filter(
      (item) => item.status === "queued" && !started.current.has(item.key),
    );
    for (const item of queued.slice(0, Math.max(0, PARALLEL - running))) {
      started.current.add(item.key);
      void run(item);
    }
  }, [items, run]);

  // Poll the server while photos are being processed.
  const processingIds = items
    .filter((item) => item.status === "processing" && item.photoId != null)
    .map((item) => item.photoId!)
    .join(",");
  useEffect(() => {
    if (!processingIds) return;
    const timer = window.setInterval(async () => {
      try {
        dispatch({
          type: "photos",
          photos: await fetchPhotos(processingIds.split(",").map(Number)),
        });
      } catch {
        // Temporary network issue: the next tick tries again.
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [processingIds]);

  // Release local previews.
  const urls = useRef(new Map<string, string>());
  useEffect(() => {
    for (const item of items) if (item.localUrl) urls.current.set(item.key, item.localUrl);
  }, [items]);
  useEffect(() => {
    const map = urls.current;
    return () => map.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const retry = useCallback((key: string) => {
    started.current.delete(key);
    dispatch({ type: "update", key, changes: { status: "queued", error: null, progress: 0 } });
  }, []);

  const remove = useCallback((key: string) => {
    const url = urls.current.get(key);
    if (url) URL.revokeObjectURL(url);
    urls.current.delete(key);
    dispatch({ type: "remove", key });
  }, []);

  const busy = items.some(
    (item) =>
      item.status === "queued" || item.status === "uploading" || item.status === "processing",
  );
  return { items, add, retry, remove, busy };
}
