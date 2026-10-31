import { formatLabel } from "@/lib/format";
import { themes } from "@/lib/layouts";

import { StepTitle } from "./WizardShell";

export default function ReviewStep({
  title,
  onTitle,
  formatId,
  themeId,
  accent,
  photoCount,
  lowQuality,
  error,
}: {
  title: string;
  onTitle: (title: string) => void;
  formatId: string;
  themeId: string;
  accent: string;
  photoCount: number;
  lowQuality: number;
  error: string | null;
}) {
  return (
    <>
      <StepTitle
        title="Tout est prêt"
        subtitle="Donnez un titre à votre album, nous nous occupons de la mise en page."
      />

      <div className="mt-8 max-w-xl">
        <label htmlFor="album-title" className="block px-5 font-semibold text-neutral-900">
          Titre de l&apos;album <span className="font-normal text-neutral-500">(facultatif)</span>
        </label>
        <input
          id="album-title"
          value={title}
          maxLength={200}
          onChange={(event) => onTitle(event.target.value)}
          placeholder="Par exemple : Bénin 2026"
          className="mt-2 h-14 w-full rounded-full border border-neutral-300 px-5 text-lg text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/10"
        />
        <p className="mt-2 px-5 text-sm text-neutral-500">Il apparaîtra sur la couverture.</p>
      </div>

      <dl className="mt-10 grid max-w-xl grid-cols-2 gap-px overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-200 sm:grid-cols-3">
        <Summary label="Format" value={formatLabel(formatId)} />
        <Summary label="Photos" value={String(photoCount)} />
        <Summary
          label="Style"
          value={
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-4 rounded-full ring-1 ring-black/10"
                style={{ background: accent }}
              />
              {themes[themeId].name}
            </span>
          }
        />
      </dl>

      {lowQuality > 0 && (
        <p className="mt-6 max-w-xl rounded-2xl bg-orange-50 px-5 py-4 text-orange-900">
          {lowQuality === 1
            ? "1 photo est un peu petite : elle ne sera pas utilisée en pleine page."
            : `${lowQuality} photos sont un peu petites : elles ne seront pas utilisées en pleine page.`}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-6 max-w-xl px-5 text-red-600">
          {error}
        </p>
      )}
    </>
  );
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white px-5 py-4">
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="mt-1 font-semibold text-neutral-900">{value}</dd>
    </div>
  );
}
