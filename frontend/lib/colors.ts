/** Picks a usable accent among the photos' dominant colours: saturated, neither too dark nor too light. */
export function dominantAccent(colorLists: string[][]): string | null {
  let best: { color: string; score: number } | null = null;
  for (const colors of colorLists) {
    for (const color of colors) {
      const hsl = toHsl(color);
      if (!hsl) continue;
      const [, s, l] = hsl;
      if (l < 0.2 || l > 0.7 || s < 0.15) continue;
      const score = s * (1 - Math.abs(l - 0.45));
      if (!best || score > best.score) best = { color: color.toLowerCase(), score };
    }
  }
  return best?.color ?? null;
}

function toHsl(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return null;
  const [r, g, b] = match.slice(1).map((v) => parseInt(v, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
