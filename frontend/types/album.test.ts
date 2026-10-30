import { expect, it } from "vitest";

import { albumSchema } from "./album";

const valid = {
  schemaVersion: 1,
  format: "A4_portrait",
  theme: "galerie_claire",
  accent: "#3b3b3b",
  options: { verticalTitle: true, line: true, captions: true },
  pages: [
    {
      id: "p1",
      layout: "cover_block",
      slots: [
        { slot: "photo1", photoId: 12, focus: [0.5, 0.3] },
        { slot: "title", text: "Bénin 2026" },
      ],
    },
    { id: "p2", spread: true, layout: "spread_full", slots: [{ slot: "photo1", photoId: 14 }] },
  ],
};

it("accepts the reference album JSON", () => {
  expect(albumSchema.parse(valid)).toEqual(valid);
});

it("rejects instead of guessing", () => {
  expect(albumSchema.safeParse({ ...valid, schemaVersion: 2 }).success).toBe(false);
  expect(albumSchema.safeParse({ ...valid, accent: "red" }).success).toBe(false);
  const badFocus = structuredClone(valid);
  badFocus.pages[0].slots[0] = { slot: "photo1", photoId: 12, focus: [2, 0] };
  expect(albumSchema.safeParse(badFocus).success).toBe(false);
});
