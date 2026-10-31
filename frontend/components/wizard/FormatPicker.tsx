import { Check } from "lucide-react";

import { formats } from "@/lib/layouts";

import { StepTitle } from "./WizardShell";

const CHOICES = [
  { id: "square_21", name: "Carré", size: "21 × 21 cm", hint: "Le plus polyvalent" },
  { id: "A4_portrait", name: "Portrait", size: "21 × 29,7 cm", hint: "Le grand classique" },
  { id: "A4_landscape", name: "Paysage", size: "29,7 × 21 cm", hint: "Idéal pour les panoramas" },
  {
    id: "A5_portrait",
    name: "Petit portrait",
    size: "14,8 × 21 cm",
    hint: "Compact, facile à offrir",
  },
] as const;

export default function FormatPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (format: string) => void;
}) {
  return (
    <>
      <StepTitle
        title="Quelle forme pour votre livre ?"
        subtitle="Vous pourrez revenir sur ce choix tant que l'album n'est pas créé."
      />
      <fieldset className="mt-10">
        <legend className="sr-only">Format du livre</legend>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {CHOICES.map((choice) => {
            const format = formats[choice.id];
            const selected = choice.id === value;
            // Silhouette scaled so the largest side is 100 px.
            const scale = 100 / Math.max(format.widthMm, format.heightMm);
            return (
              <label
                key={choice.id}
                className={`relative flex cursor-pointer flex-col items-center rounded-3xl border-2 p-5 text-center transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-neutral-900 sm:p-6 ${
                  selected
                    ? "border-neutral-900 bg-neutral-50"
                    : "border-neutral-200 hover:border-neutral-400"
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value={choice.id}
                  checked={selected}
                  onChange={() => onChange(choice.id)}
                  className="sr-only"
                />
                {selected && (
                  <span className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-neutral-900 text-white">
                    <Check aria-hidden className="size-4" strokeWidth={2.5} />
                  </span>
                )}
                <span className="grid h-28 place-items-center">
                  <span
                    aria-hidden
                    className="rounded-[3px] bg-white shadow-[0_8px_20px_-8px_rgb(0_0_0/0.4)] ring-1 ring-black/10"
                    style={{ width: format.widthMm * scale, height: format.heightMm * scale }}
                  />
                </span>
                <span className="mt-4 font-semibold text-neutral-900">{choice.name}</span>
                <span className="text-sm text-neutral-500">{choice.size}</span>
                <span className="mt-2 text-sm text-neutral-600">{choice.hint}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </>
  );
}
