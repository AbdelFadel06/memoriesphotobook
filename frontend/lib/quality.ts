import type { PrintFormat } from "@/types/layouts";

/** Same grading as the backend (services/imaging.quality_for), against a full page. */
export type Quality = "ok" | "low" | "bad";

const DPI_OK = 250;
const DPI_LOW = 150;

export function qualityFor(width: number, height: number, format: PrintFormat): Quality {
  const longSideInches = (Math.max(format.widthMm, format.heightMm) + 2 * format.bleedMm) / 25.4;
  const dpi = Math.max(width, height) / longSideInches;
  if (dpi >= DPI_OK) return "ok";
  if (dpi >= DPI_LOW) return "low";
  return "bad";
}

export const QUALITY_MESSAGES: Record<Exclude<Quality, "ok">, string> = {
  low: "Peut être légèrement floue en pleine page",
  bad: "Trop petite pour une pleine page",
};
