import { PageRender } from "@/components/page-render";
import { getFormat, getTemplate, getTheme, templates } from "@/lib/layouts";
import type { AlbumOptions, Page } from "@/types/album";

/** First page of an album rendered with the same component as the editor and the PDF. */
export default function AlbumCover({
  page,
  formatId,
  themeId,
  accent,
  options,
  photos,
}: {
  page: Page;
  formatId: string;
  themeId: string;
  accent: string;
  options: AlbumOptions;
  photos: Record<string, { src: string }>;
}) {
  if (!templates[page.layout]) return null;
  const format = getFormat(formatId);
  const landscape = format.widthMm >= format.heightMm;
  const sources = Object.fromEntries(
    Object.entries(photos).map(([id, photo]) => [Number(id), photo]),
  );

  return (
    // The page is fitted in the box by its longest side, like a book on a table.
    <div
      className={landscape ? "w-[84%]" : "h-[84%]"}
      style={landscape ? undefined : { aspectRatio: `${format.widthMm} / ${format.heightMm}` }}
    >
      <div className="overflow-hidden rounded-[3px] shadow-[0_10px_30px_-12px_rgb(0_0_0/0.45),0_2px_6px_rgb(0_0_0/0.08)]">
        <PageRender
          page={page}
          template={getTemplate(page.layout)}
          theme={getTheme(themeId)}
          format={format}
          accent={accent}
          options={options}
          photos={sources}
          mode="screen"
          showGuides={false}
        />
      </div>
    </div>
  );
}
