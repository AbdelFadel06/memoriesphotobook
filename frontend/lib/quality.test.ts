import { expect, it } from "vitest";

import { getFormat } from "./layouts";
import { qualityFor } from "./quality";

it("grades like the backend (square 21 cm with bleed ≈ 8.5 in)", () => {
  const square = getFormat("square_21");
  expect(qualityFor(3000, 3000, square)).toBe("ok");
  expect(qualityFor(2100, 2100, square)).toBe("low");
  expect(qualityFor(1000, 1000, square)).toBe("bad");
});

it("depends on the chosen format", () => {
  expect(qualityFor(2600, 1950, getFormat("A5_portrait"))).toBe("ok");
  expect(qualityFor(2600, 1950, getFormat("A4_landscape"))).toBe("low");
});
