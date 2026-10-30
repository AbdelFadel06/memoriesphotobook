import type { PrintFormat } from "@/types/layouts";

export type Rect = { x: number; y: number; w: number; h: number };

/** Trim size (final cut) of a page or a spread, in mm. */
export function trimSize(format: PrintFormat, spread: boolean) {
  return { width: format.widthMm * (spread ? 2 : 1), height: format.heightMm };
}

/** Sheet size including bleed on every side, in mm. */
export function sheetSize(format: PrintFormat, spread: boolean) {
  const trim = trimSize(format, spread);
  return { width: trim.width + 2 * format.bleedMm, height: trim.height + 2 * format.bleedMm };
}

/**
 * Elements touching a trim edge are pushed into the bleed so no white line
 * appears after cutting. Returned values are % of the trim box.
 */
export function bleedRect(rect: Rect, format: PrintFormat, spread: boolean): Rect {
  const trim = trimSize(format, spread);
  const bx = (format.bleedMm / trim.width) * 100;
  const by = (format.bleedMm / trim.height) * 100;
  const left = rect.x <= 0 ? -bx : rect.x;
  const top = rect.y <= 0 ? -by : rect.y;
  const right = rect.x + rect.w >= 100 ? 100 + bx : rect.x + rect.w;
  const bottom = rect.y + rect.h >= 100 ? 100 + by : rect.y + rect.h;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function objectPosition(focus: readonly [number, number] | undefined): string {
  const [fx, fy] = focus ?? [0.5, 0.5];
  return `${round(fx * 100)}% ${round(fy * 100)}%`;
}

/** Converts a rect from % of the trim box to mm. */
export function rectToMm(rect: Rect, format: PrintFormat, spread: boolean): Rect {
  const trim = trimSize(format, spread);
  return {
    x: (rect.x / 100) * trim.width,
    y: (rect.y / 100) * trim.height,
    w: (rect.w / 100) * trim.width,
    h: (rect.h / 100) * trim.height,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
