import { z } from "zod";

import { albumOptionsSchema, albumSchema, pageSchema } from "@/types/album";

import { apiRequest } from "./api";
import { getAccessToken } from "./auth";

const coverSchema = z.object({
  page: pageSchema,
  options: albumOptionsSchema,
  photos: z.record(z.string(), z.object({ src: z.string().url() })),
});

export const albumSummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  format: z.string(),
  theme: z.string(),
  accent_color: z.string(),
  version: z.number(),
  page_count: z.number(),
  cover: coverSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type AlbumSummary = z.infer<typeof albumSummarySchema>;

const albumPageSchema = z.object({
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(albumSummarySchema),
});
export type AlbumPage = z.infer<typeof albumPageSchema>;

export const albumDetailSchema = albumSummarySchema.omit({ cover: true }).extend({
  content: albumSchema,
});
export type AlbumDetail = z.infer<typeof albumDetailSchema>;

const versionSchema = z.object({
  number: z.number(),
  page_count: z.number(),
  created_at: z.string(),
});
export type AlbumVersion = z.infer<typeof versionSchema>;

const auth = () => ({ token: getAccessToken() });

/** One page of the history; `cursor` is the opaque value from the previous `next` link. */
export function fetchAlbums(cursor: string | null): Promise<AlbumPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return apiRequest("GET", `albums${query}`, albumPageSchema, auth());
}

export function cursorFrom(nextUrl: string | null): string | null {
  return nextUrl ? new URL(nextUrl).searchParams.get("cursor") : null;
}

export function fetchAlbum(id: number): Promise<AlbumDetail> {
  return apiRequest("GET", `albums/${id}`, albumDetailSchema, auth());
}

export async function deleteAlbum(id: number): Promise<void> {
  await apiRequest("DELETE", `albums/${id}`, z.null(), auth());
}

export function fetchVersions(id: number): Promise<AlbumVersion[]> {
  return apiRequest("GET", `albums/${id}/versions`, z.array(versionSchema), auth());
}

export function restoreVersion(id: number, number: number): Promise<AlbumDetail> {
  return apiRequest("POST", `albums/${id}/versions/${number}/restore`, albumDetailSchema, auth());
}

const photoSchema = z.object({
  id: z.number(),
  preview_url: z.string().url().nullable(),
  thumb_url: z.string().url().nullable(),
});

/** Preview URLs of the given photos, keyed by id (for page-render). */
export async function fetchPhotoSources(ids: number[]): Promise<Record<number, { src: string }>> {
  if (ids.length === 0) return {};
  const page = await apiRequest(
    "GET",
    `photos?ids=${ids.join(",")}&page_size=${ids.length}`,
    z.object({ results: z.array(photoSchema) }),
    auth(),
  );
  return Object.fromEntries(
    page.results.filter((p) => p.preview_url).map((p) => [p.id, { src: p.preview_url! }]),
  );
}

export type NewAlbum = {
  title: string;
  format: string;
  theme: string;
  accent: string;
  options: { verticalTitle: boolean; line: boolean; captions: boolean };
  photo_ids: number[];
  order: "date" | "manual";
};

export function createAlbum(album: NewAlbum): Promise<AlbumDetail> {
  return apiRequest("POST", "albums", albumDetailSchema, { ...auth(), body: album });
}
