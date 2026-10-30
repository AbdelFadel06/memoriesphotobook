import { z } from "zod";

export const SCHEMA_VERSION = 1;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const photoFillSchema = z.object({
  slot: z.string(),
  photoId: z.number().int().positive().nullable(),
  /** Crop focus point, 0–1 on each axis, used as object-position. */
  focus: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).optional(),
});

export const textFillSchema = z.object({
  slot: z.string(),
  text: z.string().max(2000),
});

export const slotFillSchema = z.union([photoFillSchema, textFillSchema]);
export type PhotoFill = z.infer<typeof photoFillSchema>;
export type TextFill = z.infer<typeof textFillSchema>;
export type SlotFill = z.infer<typeof slotFillSchema>;

export const pageSchema = z.object({
  id: z.string(),
  layout: z.string(),
  spread: z.boolean().optional(),
  slots: z.array(slotFillSchema),
});
export type Page = z.infer<typeof pageSchema>;

export const albumOptionsSchema = z.object({
  verticalTitle: z.boolean(),
  line: z.boolean(),
  captions: z.boolean(),
});
export type AlbumOptions = z.infer<typeof albumOptionsSchema>;

export const albumSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  format: z.string(),
  theme: z.string(),
  accent: hex,
  options: albumOptionsSchema,
  pages: z.array(pageSchema),
});
export type Album = z.infer<typeof albumSchema>;

export function isPhotoFill(fill: SlotFill): fill is PhotoFill {
  return "photoId" in fill;
}

export function isTextFill(fill: SlotFill): fill is TextFill {
  return "text" in fill;
}
