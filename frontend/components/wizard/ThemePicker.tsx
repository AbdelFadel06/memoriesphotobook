"use client";

import { Check, ChevronDown } from "lucide-react";

import { PageRender, type PhotoSource } from "@/components/page-render";
import { getFormat, getTemplate, themes } from "@/lib/layouts";
import type { AlbumOptions, Page } from "@/types/album";

import { StepTitle } from "./WizardShell";

export type AccentMode = "theme" | "photos" | "custom";

const OPTION_LABELS: Record<keyof AlbumOptions, { label: string; hint: string }> = {
  verticalTitle: { label: "Titre vertical", hint: "Le titre de l'album en marge des pages" },
  line: { label: "Fine ligne", hint: "Un trait discret au-dessus des titres" },
  captions: { label: "Légendes", hint: "Un texte sous les photos" },
};

export default function ThemePicker({
  formatId,
  theme,
  onTheme,
  accentMode,
  onAccentMode,
  customAccent,
  onCustomAccent,
  photosAccent,
  accentFor,
  options,
  onOptions,
  previewPhotos,
  title,
}: {
  formatId: string;
  theme: string;
  onTheme: (theme: string) => void;
  accentMode: AccentMode;
  onAccentMode: (mode: AccentMode) => void;
  customAccent: string;
  onCustomAccent: (color: string) => void;
  photosAccent: string | null;
  accentFor: (themeId: string) => string;
  options: AlbumOptions;
  onOptions: (options: AlbumOptions) => void;
  previewPhotos: PhotoSource[];
  title: string;
}) {
  const format = getFormat(formatId);
  const photos: Record<number, PhotoSource> = Object.fromEntries(
    previewPhotos.map((photo, index) => [index + 1, photo]),
  );
  // Sample pages built from the user's own photos. Texts are only examples, never saved.
  const pages: Page[] = [
    {
      id: "cover",
      layout: "cover_block",
      slots: [
        { slot: "photo1", photoId: photos[1] ? 1 : null },
        { slot: "title", text: title || "Mon album" },
        { slot: "subtitle", text: "Nos plus beaux souvenirs" },
      ],
    },
    {
      id: "inside",
      layout: "photo_caption",
      slots: [
        { slot: "photo1", photoId: photos[2] ? 2 : photos[1] ? 1 : null },
        { slot: "title", text: "Un beau moment" },
        { slot: "caption", text: "Quelques mots pour raconter ce souvenir." },
      ],
    },
  ];

  return (
    <>
      <StepTitle
        title="Choisissez un style"
        subtitle="Voici votre album avec vos propres photos."
      />

      <fieldset className="mt-8">
        <legend className="sr-only">Thème de l&apos;album</legend>
        <div className="grid gap-5 md:grid-cols-2">
          {Object.values(themes).map((item) => {
            const selected = item.id === theme;
            return (
              <label
                key={item.id}
                className={`relative cursor-pointer rounded-3xl border-2 p-4 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900 sm:p-5 ${
                  selected
                    ? "border-neutral-900 bg-neutral-50"
                    : "border-neutral-200 hover:border-neutral-400"
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={item.id}
                  checked={selected}
                  onChange={() => onTheme(item.id)}
                  className="sr-only"
                />
                <div
                  aria-hidden
                  className="grid grid-cols-2 gap-2 rounded-2xl bg-neutral-200/60 p-3 sm:gap-3 sm:p-4"
                >
                  {pages.map((page) => (
                    <div
                      key={page.id}
                      className="self-center overflow-hidden rounded-[2px] shadow-md"
                    >
                      <PageRender
                        page={page}
                        template={getTemplate(page.layout)}
                        theme={item}
                        format={format}
                        accent={accentFor(item.id)}
                        options={options}
                        photos={photos}
                        runningTitle={title || "Mon album"}
                        folio="2"
                        mode="screen"
                        showGuides={false}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-semibold text-neutral-900">{item.name}</span>
                  {selected && (
                    <span className="grid size-6 place-items-center rounded-full bg-neutral-900 text-white">
                      <Check aria-hidden className="size-4" strokeWidth={2.5} />
                    </span>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-10">
        <legend className="font-semibold text-neutral-900">Couleur d&apos;accent</legend>
        <div className="mt-4 flex flex-wrap gap-3">
          <AccentChoice
            label="Couleur du thème"
            color={themes[theme].defaultAccent}
            checked={accentMode === "theme"}
            onSelect={() => onAccentMode("theme")}
          />
          {photosAccent && (
            <AccentChoice
              label="Couleur dominante de mes photos"
              color={photosAccent}
              checked={accentMode === "photos"}
              onSelect={() => onAccentMode("photos")}
            />
          )}
          <label
            className={`flex h-12 cursor-pointer items-center gap-3 rounded-full border-2 pr-5 pl-2 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900 ${
              accentMode === "custom"
                ? "border-neutral-900"
                : "border-neutral-200 hover:border-neutral-400"
            }`}
          >
            <input
              type="color"
              value={customAccent}
              onChange={(event) => {
                onCustomAccent(event.target.value);
                onAccentMode("custom");
              }}
              aria-label="Choisir une couleur"
              className="size-8 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
            />
            <span className="font-medium text-neutral-900">Choisir une couleur</span>
          </label>
        </div>
      </fieldset>

      <details className="group mt-8 rounded-3xl border border-neutral-200">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-3xl px-5 py-4 font-semibold text-neutral-900 focus-visible:outline-2 focus-visible:outline-neutral-900 [&::-webkit-details-marker]:hidden">
          Personnaliser
          <ChevronDown aria-hidden className="size-5 transition group-open:rotate-180" />
        </summary>
        <div className="space-y-1 px-5 pb-4">
          {(Object.keys(OPTION_LABELS) as (keyof AlbumOptions)[]).map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center justify-between gap-4 py-3"
            >
              <span>
                <span className="block font-medium text-neutral-900">
                  {OPTION_LABELS[key].label}
                </span>
                <span className="block text-sm text-neutral-500">{OPTION_LABELS[key].hint}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={options[key]}
                onChange={(event) => onOptions({ ...options, [key]: event.target.checked })}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="relative h-7 w-12 shrink-0 rounded-full bg-neutral-300 transition peer-checked:bg-neutral-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-neutral-900 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
              />
            </label>
          ))}
        </div>
      </details>
    </>
  );
}

function AccentChoice({
  label,
  color,
  checked,
  onSelect,
}: {
  label: string;
  color: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex h-12 cursor-pointer items-center gap-3 rounded-full border-2 pr-5 pl-2 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900 ${
        checked ? "border-neutral-900" : "border-neutral-200 hover:border-neutral-400"
      }`}
    >
      <input type="radio" name="accent" checked={checked} onChange={onSelect} className="sr-only" />
      <span
        aria-hidden
        className="size-8 rounded-full ring-1 ring-black/10"
        style={{ background: color }}
      />
      <span className="font-medium text-neutral-900">{label}</span>
    </label>
  );
}
