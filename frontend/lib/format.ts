/** User-facing names of the print formats: no technical terms. */
const FORMAT_LABELS: Record<string, string> = {
  A4_portrait: "A4 portrait",
  A5_portrait: "A5 portrait",
  square_21: "Carré 21 cm",
  A4_landscape: "A4 paysage",
};

export function formatLabel(id: string): string {
  return FORMAT_LABELS[id] ?? id;
}

export function pagesLabel(count: number): string {
  return `${count} page${count > 1 ? "s" : ""}`;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** « il y a 3 heures », « hier », « à l'instant ». */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const seconds = (new Date(iso).getTime() - now.getTime()) / 1000;
  const format = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return "à l'instant";
}

export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(
    new Date(iso),
  );
}
