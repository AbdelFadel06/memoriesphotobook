import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getFormat, getTemplate, getTheme, templates, themes } from "@/lib/layouts";
import type { AlbumOptions, Page } from "@/types/album";
import type { Template } from "@/types/layouts";

import PageRender, { type PageRenderProps } from "./PageRender";

const ALL_OPTIONS: AlbumOptions = { verticalTitle: true, line: true, captions: true };

function samplePage(template: Template): Page {
  let photoId = 1;
  return {
    id: `p-${template.id}`,
    layout: template.id,
    slots: Object.entries(template.slots).map(([slot, def]) =>
      def.type === "photo"
        ? { slot, photoId: photoId++, focus: [0.5, 0.3] as [number, number] }
        : { slot, text: `Texte ${slot}` },
    ),
  };
}

const photos = {
  1: { src: "https://img.test/1.jpg", alt: "Photo 1" },
  2: { src: "https://img.test/2.jpg", alt: "Photo 2" },
};

function renderPage(overrides: Partial<PageRenderProps> & { template: Template }) {
  return render(
    <PageRender
      page={samplePage(overrides.template)}
      theme={getTheme("galerie_claire")}
      format={getFormat("A4_portrait")}
      accent="#3b3b3b"
      options={ALL_OPTIONS}
      photos={photos}
      runningTitle="Bénin 2026"
      folio="12"
      mode="print"
      {...overrides}
    />,
  );
}

describe.each(["A4_portrait", "square_21"])("format %s", (formatId) => {
  describe.each(Object.keys(themes))("theme %s", (themeId) => {
    it.each(Object.keys(templates))("template %s matches snapshot", (templateId) => {
      const { container } = renderPage({
        template: getTemplate(templateId),
        theme: getTheme(themeId),
        format: getFormat(formatId),
      });
      expect(container.innerHTML).toMatchSnapshot();
    });
  });
});

describe("PageRender", () => {
  it("sizes the print sheet with bleed and the trim box inside it", () => {
    const { container } = renderPage({ template: getTemplate("photo_caption") });
    const sheet = container.querySelector<HTMLElement>(".pb-sheet")!;
    const trim = container.querySelector<HTMLElement>(".pb-trim")!;
    expect(sheet.style.width).toBe("216mm");
    expect(sheet.style.height).toBe("303mm");
    expect(trim.style.left).toBe("3mm");
    expect(trim.style.width).toBe("210mm");
  });

  it("renders nothing for empty text and reserves no space", () => {
    const template = getTemplate("photo_caption");
    const page: Page = {
      id: "p",
      layout: template.id,
      slots: [
        { slot: "photo1", photoId: 1 },
        { slot: "title", text: "   " },
      ],
    };
    const { container } = renderPage({ template, page });
    expect(container.querySelector('[data-slot="title"]')).toBeNull();
    expect(container.querySelector('[data-slot="caption"]')).toBeNull();
  });

  it("hides optional elements when their option is off", () => {
    const { container } = renderPage({
      template: getTemplate("photo_caption"),
      options: { verticalTitle: false, line: false, captions: false },
    });
    expect(container.querySelector(".pb-running-title")).toBeNull();
    expect(container.querySelector(".pb-line")).toBeNull();
    expect(container.querySelector('[data-slot="caption"]')).toBeNull();
    expect(container.querySelector('[data-slot="title"]')).not.toBeNull();
  });

  it("positions photos from the focus point and keeps alt text", () => {
    const { getByAltText } = renderPage({ template: getTemplate("photo_caption") });
    const img = getByAltText("Photo 1");
    expect(img.style.objectPosition).toBe("50% 30%");
  });

  it("shows guides on screen only", () => {
    const template = getTemplate("spread_full");
    const screen = renderPage({ template, mode: "screen" });
    expect(screen.container.querySelector(".pb-guide-gutter")).not.toBeNull();
    const print = renderPage({ template, mode: "print" });
    expect(print.container.querySelector(".pb-guides")).toBeNull();
  });

  it("uses the accent colour", () => {
    const { container } = renderPage({ template: getTemplate("cover_block"), accent: "#ff0000" });
    const sheet = container.querySelector<HTMLElement>(".pb-sheet")!;
    expect(sheet.style.getPropertyValue("--pb-accent")).toBe("#ff0000");
  });
});
