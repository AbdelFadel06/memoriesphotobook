"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import FormatPicker from "@/components/wizard/FormatPicker";
import PhotoUploader, { orderItems, type PhotoOrder } from "@/components/wizard/PhotoUploader";
import ReviewStep from "@/components/wizard/ReviewStep";
import ThemePicker, { type AccentMode } from "@/components/wizard/ThemePicker";
import WizardShell from "@/components/wizard/WizardShell";
import { createAlbum } from "@/lib/albums";
import { dominantAccent } from "@/lib/colors";
import { getFormat, themes } from "@/lib/layouts";
import { qualityFor } from "@/lib/quality";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useUploader } from "@/lib/useUploader";
import type { AlbumOptions } from "@/types/album";

const DEFAULT_OPTIONS: AlbumOptions = { verticalTitle: true, line: true, captions: true };

/** New album in 4 steps, one decision per screen: format → photos → style → review. */
export default function NewAlbumWizard() {
  const router = useRouter();
  const me = useCurrentUser();
  const [step, setStep] = useState(0);
  const [formatId, setFormatId] = useState("square_21");
  const [order, setOrder] = useState<PhotoOrder>("date");
  const [theme, setTheme] = useState("galerie_claire");
  const [accentMode, setAccentMode] = useState<AccentMode>("theme");
  const [customAccent, setCustomAccent] = useState("#3b3b3b");
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [title, setTitle] = useState("");
  const uploader = useUploader(formatId);

  const ready = orderItems(uploader.items, order).filter((i) => i.status === "ready" && i.photo);
  const readyPhotos = ready.map((item) => item.photo!);
  const photosAccent = dominantAccent(readyPhotos.map((photo) => photo.dominant_colors));
  const accentFor = (themeId: string) =>
    accentMode === "photos" && photosAccent
      ? photosAccent
      : accentMode === "custom"
        ? customAccent
        : themes[themeId].defaultAccent;
  const format = getFormat(formatId);
  const lowQuality = readyPhotos.filter(
    (p) => p.width && p.height && qualityFor(p.width, p.height, format) === "bad",
  ).length;

  const create = useMutation({
    mutationFn: () =>
      createAlbum({
        title: title.trim(),
        format: formatId,
        theme,
        accent: accentFor(theme),
        options,
        photo_ids: readyPhotos.map((photo) => photo.id),
        order,
      }),
    onSuccess: (album) => router.replace(`/albums/${album.id}/edit`),
  });

  // Leaving while photos are still uploading would lose them.
  useEffect(() => {
    if (!uploader.busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploader.busy]);

  function close() {
    if (
      uploader.items.length > 0 &&
      !window.confirm("Quitter la création ? Les photos ajoutées ne seront pas mises en album.")
    )
      return;
    router.push("/dashboard");
  }

  const next = [
    { disabled: false, label: "Continuer", note: null },
    {
      disabled: ready.length === 0 || uploader.busy,
      label: "Continuer",
      note: uploader.busy ? "Patientez, vos photos sont en cours d'envoi…" : null,
    },
    { disabled: false, label: "Continuer", note: null },
    { disabled: ready.length === 0, label: "Créer mon album", note: null },
  ][step];

  if (me.isPending || me.unauthorized) {
    return <div aria-busy="true" aria-label="Chargement" className="h-dvh bg-white" />;
  }

  return (
    <WizardShell
      step={step}
      onClose={close}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      onNext={() => (step === 3 ? create.mutate() : setStep((s) => s + 1))}
      nextLabel={create.isPending ? "Mise en page de vos photos…" : next.label}
      nextDisabled={next.disabled}
      pending={create.isPending}
      footerNote={next.note}
    >
      {step === 0 && <FormatPicker value={formatId} onChange={setFormatId} />}
      {step === 1 && (
        <PhotoUploader
          items={uploader.items}
          formatId={formatId}
          order={order}
          onOrder={setOrder}
          onAdd={(files) => uploader.add(files, uploader.items.length)}
          onRetry={uploader.retry}
          onRemove={uploader.remove}
        />
      )}
      {step === 2 && (
        <ThemePicker
          formatId={formatId}
          theme={theme}
          onTheme={setTheme}
          accentMode={accentMode}
          onAccentMode={setAccentMode}
          customAccent={customAccent}
          onCustomAccent={setCustomAccent}
          photosAccent={photosAccent}
          accentFor={accentFor}
          options={options}
          onOptions={setOptions}
          previewPhotos={readyPhotos
            .filter((photo) => photo.preview_url)
            .slice(0, 2)
            .map((photo) => ({ src: photo.preview_url! }))}
          title={title}
        />
      )}
      {step === 3 && (
        <ReviewStep
          title={title}
          onTitle={setTitle}
          formatId={formatId}
          themeId={theme}
          accent={accentFor(theme)}
          photoCount={ready.length}
          lowQuality={lowQuality}
          error={create.error?.message ?? null}
        />
      )}
    </WizardShell>
  );
}
