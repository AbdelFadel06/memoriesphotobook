import { z } from "zod";

import { ApiError, apiRequest } from "./api";
import { getAccessToken } from "./auth";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
export const PHOTO_MAX_BYTES = 30 * 1024 * 1024;
export const PHOTOS_PER_ALBUM = 300;

export const photoSchema = z.object({
  id: z.number(),
  album: z.number().nullable(),
  status: z.enum(["pending", "ready", "failed"]),
  width: z.number().nullable(),
  height: z.number().nullable(),
  orientation: z.string(),
  taken_at: z.string().nullable(),
  dominant_colors: z.array(z.string()),
  quality: z.string(),
  thumb_url: z.string().url().nullable(),
  preview_url: z.string().url().nullable(),
  created_at: z.string(),
});
export type Photo = z.infer<typeof photoSchema>;

const presignSchema = z.object({
  photo_id: z.number(),
  upload_url: z.string().url(),
  headers: z.record(z.string(), z.string()),
});

const auth = () => ({ token: getAccessToken() });

/** Browsers often leave HEIC files without a MIME type: fall back on the extension. */
export function photoType(file: File): string {
  if (file.type) return file.type === "image/heif" ? "image/heic" : file.type;
  return /\.(heic|heif)$/i.test(file.name) ? "image/heic" : "";
}

export function presignPhoto(file: File, format: string) {
  return apiRequest("POST", "photos/presign", presignSchema, {
    ...auth(),
    body: { content_type: photoType(file), size: file.size, format, filename: file.name },
  });
}

export function confirmPhoto(photoId: number): Promise<Photo> {
  return apiRequest("POST", "photos/confirm", photoSchema, {
    ...auth(),
    body: { photo_id: photoId },
  });
}

export async function fetchPhotos(ids: number[]): Promise<Photo[]> {
  if (ids.length === 0) return [];
  const page = await apiRequest(
    "GET",
    `photos?ids=${ids.join(",")}&page_size=${ids.length}`,
    z.object({ results: z.array(photoSchema) }),
    auth(),
  );
  return page.results;
}

/** Direct PUT to storage with progress (fetch cannot report upload progress). */
export function putToStorage(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, "upload_failed", "L'envoi de la photo a échoué."));
    xhr.onerror = () =>
      reject(new ApiError(0, "network", "Connexion interrompue pendant l'envoi."));
    xhr.send(file);
  });
}
