import { describe, expect, it } from "vitest";

import { formats, getFormat, templates } from "@/lib/layouts";

import { bleedRect, objectPosition, rectToMm, sheetSize } from "./geometry";

const A4 = getFormat("A4_portrait");

describe("sheetSize", () => {
  it.each([
    ["A4_portrait", false, 216, 303],
    ["A5_portrait", false, 154, 216],
    ["square_21", false, 216, 216],
    ["A4_landscape", false, 303, 216],
    ["A4_portrait", true, 426, 303],
  ])("%s spread=%s → %i × %i mm", (id, spread, width, height) => {
    expect(sheetSize(getFormat(id), spread)).toEqual({ width, height });
  });
});

describe("bleedRect", () => {
  it("extends edge-touching rects into the bleed", () => {
    const rect = bleedRect({ x: 0, y: 0, w: 100, h: 100 }, A4, false);
    const mm = rectToMm(rect, A4, false);
    expect(mm.x).toBeCloseTo(-3);
    expect(mm.y).toBeCloseTo(-3);
    expect(mm.w).toBeCloseTo(216);
    expect(mm.h).toBeCloseTo(303);
  });

  it("leaves inner rects untouched", () => {
    expect(bleedRect({ x: 10, y: 10, w: 50, h: 50 }, A4, false)).toEqual({
      x: 10,
      y: 10,
      w: 50,
      h: 50,
    });
  });
});

it("maps the focus point to object-position", () => {
  expect(objectPosition(undefined)).toBe("50% 50%");
  expect(objectPosition([0.25, 1])).toBe("25% 100%");
});

/** Every text element must stay inside the safety margin and out of the binding zone. */
describe.each(Object.values(formats))("templates on $id", (format) => {
  it.each(Object.values(templates))("$id keeps text safe", (template) => {
    const textRects = [
      ...Object.values(template.slots).filter((slot) => slot.type === "text"),
      ...template.decor.filter((d) => d.type === "runningTitle" || d.type === "folio"),
    ];
    for (const rect of textRects) {
      const mm = rectToMm(rect, format, template.spread);
      const width = format.widthMm * (template.spread ? 2 : 1);
      expect(mm.x).toBeGreaterThanOrEqual(format.safetyMm);
      expect(mm.y).toBeGreaterThanOrEqual(format.safetyMm);
      expect(mm.x + mm.w).toBeLessThanOrEqual(width - format.safetyMm);
      expect(mm.y + mm.h).toBeLessThanOrEqual(format.heightMm - format.safetyMm);
      if (template.spread) {
        const center = width / 2;
        const overlapsGutter =
          mm.x < center + format.gutterMm && mm.x + mm.w > center - format.gutterMm;
        expect(overlapsGutter).toBe(false);
      }
    }
  });
});
