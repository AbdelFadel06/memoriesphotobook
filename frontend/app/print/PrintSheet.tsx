"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { PageRender, sheetSize } from "@/components/page-render";
import { getFormat, getTemplate, getTheme } from "@/lib/layouts";
import { printPayloadSchema, type PrintPayload, type PrintResult } from "@/lib/print";

type Pending = {
  payload: PrintPayload;
  resolve: (result: PrintResult) => void;
  reject: (error: Error) => void;
};

/** Print surface driven by the PDF worker through window.__pbRender. */
export default function PrintSheet() {
  const [pending, setPending] = useState<Pending | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.__pbRender = (raw) =>
      new Promise<PrintResult>((resolve, reject) => {
        const parsed = printPayloadSchema.safeParse(raw);
        if (!parsed.success) {
          reject(new Error(`invalid payload: ${parsed.error.message}`));
          return;
        }
        setPending({ payload: parsed.data, resolve, reject });
      });
    return () => {
      delete window.__pbRender;
    };
  }, []);

  useLayoutEffect(() => {
    if (!pending || !root.current) return;
    const { payload, resolve, reject } = pending;
    const images = Array.from(root.current.querySelectorAll("img"));
    Promise.all(images.map((img) => img.decode()))
      .then(() => document.fonts.ready)
      .then(() => {
        const template = getTemplate(payload.page.layout);
        const size = sheetSize(getFormat(payload.format), template.spread);
        resolve({ widthMm: size.width, heightMm: size.height });
      })
      .catch(() => reject(new Error("an image could not be loaded")));
  }, [pending]);

  if (!pending) return null;
  const { payload } = pending;
  const template = getTemplate(payload.page.layout);
  const format = getFormat(payload.format);
  const size = sheetSize(format, template.spread);
  const photos = Object.fromEntries(
    Object.entries(payload.photos).map(([id, photo]) => [Number(id), photo]),
  );

  return (
    <div ref={root}>
      <style>{`@page { size: ${size.width}mm ${size.height}mm; margin: 0; }`}</style>
      <PageRender
        key={payload.page.id}
        page={payload.page}
        template={template}
        theme={getTheme(payload.theme)}
        format={format}
        accent={payload.accent}
        options={payload.options}
        photos={photos}
        runningTitle={payload.runningTitle}
        folio={payload.folio}
        mode="print"
      />
    </div>
  );
}
