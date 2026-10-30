import { z } from "zod";

export const optionKeySchema = z.enum(["verticalTitle", "line", "captions"]);
export type OptionKey = z.infer<typeof optionKeySchema>;

const percent = z.number().min(0).max(100);
const rect = { x: percent, y: percent, w: percent, h: percent };

export const textRoleSchema = z.enum(["title", "subtitle", "caption", "paragraph"]);
export type TextRole = z.infer<typeof textRoleSchema>;

export const slotSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("photo"), ...rect }),
  z.object({
    type: z.literal("text"),
    role: textRoleSchema,
    align: z.enum(["left", "center", "right"]).optional(),
    option: optionKeySchema.optional(),
    ...rect,
  }),
]);
export type Slot = z.infer<typeof slotSchema>;

export const decorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("block"), color: z.enum(["accent", "text"]), ...rect }),
  z.object({ type: z.literal("line"), option: optionKeySchema.optional(), ...rect }),
  z.object({ type: z.literal("runningTitle"), option: optionKeySchema.optional(), ...rect }),
  z.object({ type: z.literal("folio"), ...rect }),
]);
export type Decor = z.infer<typeof decorSchema>;

export const orientationSchema = z.enum(["portrait", "landscape", "square"]);

export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  photos: z.number().int().min(0),
  spread: z.boolean(),
  strength: z.enum(["strong", "calm"]),
  accepts: z.array(orientationSchema),
  slots: z.record(z.string(), slotSchema),
  decor: z.array(decorSchema),
});
export type Template = z.infer<typeof templateSchema>;

const typeStyleSchema = z.object({
  font: z.enum(["display", "body"]),
  /** Font size in % of the page width, so text scales with the page. */
  size: z.number().positive(),
  weight: z.number().int(),
  lineHeight: z.number().positive().optional(),
  /** Letter spacing in em. */
  letterSpacing: z.number().optional(),
  transform: z.enum(["uppercase", "none"]).optional(),
});
export type TypeStyle = z.infer<typeof typeStyleSchema>;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const themeSchema = z.object({
  id: z.string(),
  name: z.string(),
  defaultAccent: hex,
  colors: z.object({
    background: hex,
    text: hex,
    muted: hex,
    onAccent: hex,
    photoBackdrop: hex,
  }),
  fonts: z.object({ display: z.string(), body: z.string() }),
  typography: z.object({
    title: typeStyleSchema,
    subtitle: typeStyleSchema,
    caption: typeStyleSchema,
    paragraph: typeStyleSchema,
    runningTitle: typeStyleSchema,
    folio: typeStyleSchema,
  }),
});
export type Theme = z.infer<typeof themeSchema>;

export const formatsFileSchema = z.object({
  bleedMm: z.number().positive(),
  safetyMm: z.number().positive(),
  gutterMm: z.number().positive(),
  formats: z.record(z.string(), z.object({ widthMm: z.number(), heightMm: z.number() })),
});

export type PrintFormat = {
  id: string;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  safetyMm: number;
  gutterMm: number;
};
