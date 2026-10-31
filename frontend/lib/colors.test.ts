import { expect, it } from "vitest";

import { dominantAccent } from "./colors";

it("prefers a saturated mid-tone colour", () => {
  expect(
    dominantAccent([
      ["#ffffff", "#101010"],
      ["#c4512a", "#8a8a8a"],
    ]),
  ).toBe("#c4512a");
});

it("returns null when nothing is usable", () => {
  expect(dominantAccent([["#ffffff"], ["#000000", "#777777"]])).toBeNull();
});
