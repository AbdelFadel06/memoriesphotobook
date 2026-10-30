import { memo, type CSSProperties } from "react";

import {
  isPhotoFill,
  isTextFill,
  type AlbumOptions,
  type Page,
  type SlotFill,
} from "@/types/album";
import type { Decor, PrintFormat, Slot, Template, Theme, TypeStyle } from "@/types/layouts";

import { bleedRect, objectPosition, sheetSize, trimSize, type Rect } from "./geometry";

export type PhotoSource = { src: string; alt?: string };
export type RenderMode = "screen" | "print";

export type PageRenderProps = {
  page: Page;
  template: Template;
  theme: Theme;
  format: PrintFormat;
  accent: string;
  options: AlbumOptions;
  photos: Readonly<Record<number, PhotoSource>>;
  /** Micro-texts: running title (album title) and page number. Empty = not rendered. */
  runningTitle?: string;
  folio?: string;
  mode: RenderMode;
  /** Screen only: safety margin and binding guides. */
  showGuides?: boolean;
};

/**
 * Renders ONE page or spread from the album JSON. Pure component shared by the
 * editor, the preview and the PDF worker: positions are % of the trim box and
 * font sizes are relative to the page width, so the output is identical at any scale.
 */
function PageRender({
  page,
  template,
  theme,
  format,
  accent,
  options,
  photos,
  runningTitle = "",
  folio = "",
  mode,
  showGuides = true,
}: PageRenderProps) {
  const spread = template.spread;
  const trim = trimSize(format, spread);
  const sheet = sheetSize(format, spread);
  const fills = new Map(page.slots.map((fill) => [fill.slot, fill]));
  const enabled = (option?: keyof AlbumOptions) => !option || options[option];

  const sheetStyle: CSSProperties =
    mode === "print"
      ? { width: `${sheet.width}mm`, height: `${sheet.height}mm` }
      : { aspectRatio: `${trim.width} / ${trim.height}` };
  const trimStyle: CSSProperties =
    mode === "print"
      ? {
          left: `${format.bleedMm}mm`,
          top: `${format.bleedMm}mm`,
          width: `${trim.width}mm`,
          height: `${trim.height}mm`,
        }
      : { inset: 0 };

  return (
    <div
      className={`pb-sheet pb-${mode}`}
      data-layout={template.id}
      style={{ ...sheetStyle, ...themeVars(theme, accent) }}
    >
      <div
        className="pb-trim"
        style={{ ...trimStyle, "--pb-pages": spread ? 2 : 1 } as CSSProperties}
      >
        {template.decor.map((decor, index) =>
          "option" in decor && !enabled(decor.option) ? null : (
            <DecorItem
              key={index}
              decor={decor}
              theme={theme}
              format={format}
              spread={spread}
              runningTitle={runningTitle}
              folio={folio}
            />
          ),
        )}
        {Object.entries(template.slots).map(([name, slot]) => {
          if (slot.type === "text" && !enabled(slot.option)) return null;
          return (
            <SlotItem
              key={name}
              name={name}
              slot={slot}
              fill={fills.get(name)}
              theme={theme}
              format={format}
              spread={spread}
              photos={photos}
              mode={mode}
            />
          );
        })}
        {mode === "screen" && showGuides && <Guides format={format} spread={spread} />}
      </div>
    </div>
  );
}

export default memo(PageRender);

function SlotItem({
  name,
  slot,
  fill,
  theme,
  format,
  spread,
  photos,
  mode,
}: {
  name: string;
  slot: Slot;
  fill: SlotFill | undefined;
  theme: Theme;
  format: PrintFormat;
  spread: boolean;
  photos: Readonly<Record<number, PhotoSource>>;
  mode: RenderMode;
}) {
  if (slot.type === "photo") {
    const photoFill = fill && isPhotoFill(fill) ? fill : undefined;
    const source = photoFill?.photoId != null ? photos[photoFill.photoId] : undefined;
    return (
      <div className="pb-photo" data-slot={name} style={position(bleedRect(slot, format, spread))}>
        {source && (
          // eslint-disable-next-line @next/next/no-img-element -- exact print sizing, no optimisation
          <img
            src={source.src}
            alt={source.alt ?? ""}
            loading={mode === "print" ? "eager" : "lazy"}
            decoding="async"
            style={{ objectPosition: objectPosition(photoFill?.focus) }}
          />
        )}
      </div>
    );
  }

  const text = fill && isTextFill(fill) ? fill.text.trim() : "";
  if (!text) return null;
  return (
    <div
      className="pb-text"
      data-slot={name}
      style={{
        ...position(slot),
        ...typeStyle(theme.typography[slot.role]),
        color: slot.role === "title" ? "var(--pb-text)" : "var(--pb-muted)",
        textAlign: slot.align ?? "left",
      }}
    >
      {text}
    </div>
  );
}

function DecorItem({
  decor,
  theme,
  format,
  spread,
  runningTitle,
  folio,
}: {
  decor: Decor;
  theme: Theme;
  format: PrintFormat;
  spread: boolean;
  runningTitle: string;
  folio: string;
}) {
  switch (decor.type) {
    case "block":
      return (
        <div
          className="pb-block"
          style={{
            ...position(bleedRect(decor, format, spread)),
            background: decor.color === "accent" ? "var(--pb-accent)" : "var(--pb-text)",
          }}
        />
      );
    case "line":
      return <div className="pb-line" style={position(decor)} />;
    case "runningTitle":
      if (!runningTitle.trim()) return null;
      return (
        <div
          className="pb-running-title"
          style={{ ...position(decor), ...typeStyle(theme.typography.runningTitle) }}
        >
          {runningTitle.trim()}
        </div>
      );
    case "folio":
      if (!folio.trim()) return null;
      return (
        <div
          className="pb-folio"
          style={{ ...position(decor), ...typeStyle(theme.typography.folio) }}
        >
          {folio.trim()}
        </div>
      );
  }
}

function Guides({ format, spread }: { format: PrintFormat; spread: boolean }) {
  const trim = trimSize(format, spread);
  const sx = (format.safetyMm / trim.width) * 100;
  const sy = (format.safetyMm / trim.height) * 100;
  const gutter = (format.gutterMm / trim.width) * 100;
  return (
    <div className="pb-guides" aria-hidden="true">
      <div
        className="pb-guide-safety"
        style={position({ x: sx, y: sy, w: 100 - 2 * sx, h: 100 - 2 * sy })}
      />
      {spread && (
        <div
          className="pb-guide-gutter"
          style={position({ x: 50 - gutter, y: 0, w: 2 * gutter, h: 100 })}
        />
      )}
    </div>
  );
}

function position(rect: Rect): CSSProperties {
  return { left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` };
}

function typeStyle(style: TypeStyle): CSSProperties {
  return {
    fontFamily: `var(--pb-font-${style.font})`,
    // size is % of ONE page width; the trim box spans --pb-pages pages.
    fontSize: `calc(${style.size}cqw / var(--pb-pages))`,
    fontWeight: style.weight,
    lineHeight: style.lineHeight ?? 1.3,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}em` : undefined,
    textTransform: style.transform === "uppercase" ? "uppercase" : undefined,
  };
}

function themeVars(theme: Theme, accent: string): CSSProperties {
  return {
    "--pb-bg": theme.colors.background,
    "--pb-text": theme.colors.text,
    "--pb-muted": theme.colors.muted,
    "--pb-accent": accent,
    "--pb-on-accent": theme.colors.onAccent,
    "--pb-backdrop": theme.colors.photoBackdrop,
    "--pb-font-display": `"${theme.fonts.display}", serif`,
    "--pb-font-body": `"${theme.fonts.body}", sans-serif`,
  } as CSSProperties;
}
