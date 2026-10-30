import { z } from "zod";

import { albumOptionsSchema, pageSchema } from "@/types/album";

/** What the PDF worker injects into /print for each page or spread. */
export const printPayloadSchema = z.object({
  format: z.string(),
  theme: z.string(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  options: albumOptionsSchema,
  page: pageSchema,
  photos: z.record(z.string(), z.object({ src: z.string().url() })),
  runningTitle: z.string().optional(),
  folio: z.string().optional(),
});
export type PrintPayload = z.infer<typeof printPayloadSchema>;

export type PrintResult = { widthMm: number; heightMm: number };

declare global {
  interface Window {
    /** Renders one sheet and resolves once fonts and images are fully loaded. */
    __pbRender?: (payload: unknown) => Promise<PrintResult>;
  }
}
