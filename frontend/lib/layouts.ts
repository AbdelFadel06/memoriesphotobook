// Typed, validated access to shared/layouts (copied into generated/ by scripts/sync-layouts.mjs).
import formatsJson from "@/generated/layouts/formats.json";
import indexJson from "@/generated/layouts/index.json";
import coverBlock from "@/generated/layouts/templates/cover_block.json";
import fullBleed from "@/generated/layouts/templates/full_bleed.json";
import photoCaption from "@/generated/layouts/templates/photo_caption.json";
import spreadFull from "@/generated/layouts/templates/spread_full.json";
import textPage from "@/generated/layouts/templates/text_page.json";
import twoSideBySide from "@/generated/layouts/templates/two_side_by_side.json";
import blocCouleur from "@/generated/layouts/themes/bloc_couleur.json";
import galerieClaire from "@/generated/layouts/themes/galerie_claire.json";
import {
  formatsFileSchema,
  templateSchema,
  themeSchema,
  type PrintFormat,
  type Template,
  type Theme,
} from "@/types/layouts";

const formatsFile = formatsFileSchema.parse(formatsJson);

export const formats: Record<string, PrintFormat> = Object.fromEntries(
  Object.entries(formatsFile.formats).map(([id, spec]) => [
    id,
    {
      id,
      ...spec,
      bleedMm: formatsFile.bleedMm,
      safetyMm: formatsFile.safetyMm,
      gutterMm: formatsFile.gutterMm,
    },
  ]),
);

export const templates: Record<string, Template> = Object.fromEntries(
  [coverBlock, fullBleed, photoCaption, twoSideBySide, spreadFull, textPage].map((raw) => {
    const template = templateSchema.parse(raw);
    return [template.id, template];
  }),
);

export const themes: Record<string, Theme> = Object.fromEntries(
  [galerieClaire, blocCouleur].map((raw) => {
    const theme = themeSchema.parse(raw);
    return [theme.id, theme];
  }),
);

// Guards against a JSON added to shared/layouts but not imported above.
for (const id of indexJson.templates) {
  if (!templates[id]) throw new Error(`Template ${id} listed in index.json is not imported`);
}
for (const id of indexJson.themes) {
  if (!themes[id]) throw new Error(`Theme ${id} listed in index.json is not imported`);
}

export function getFormat(id: string): PrintFormat {
  const format = formats[id];
  if (!format) throw new Error(`Unknown format ${id}`);
  return format;
}

export function getTemplate(id: string): Template {
  const template = templates[id];
  if (!template) throw new Error(`Unknown template ${id}`);
  return template;
}

export function getTheme(id: string): Theme {
  const theme = themes[id];
  if (!theme) throw new Error(`Unknown theme ${id}`);
  return theme;
}
