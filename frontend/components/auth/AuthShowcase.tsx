import Image from "next/image";

import { AUTH_IMAGE } from "./authImage";
import TextCarousel from "./TextCarousel";

const MESSAGES = [
  {
    title: "Mise en page automatique",
    text: "Déposez vos photos : votre album arrive déjà mis en page, il ne reste qu'à l'ajuster à votre goût.",
  },
  {
    title: "Prêt pour l'impression",
    text: "Ce que vous voyez à l'écran est exactement ce qui sera imprimé, au millimètre près.",
  },
  {
    title: "Vos souvenirs en sécurité",
    text: "Chaque modification est enregistrée. Revenez à une version précédente quand vous le souhaitez.",
  },
] as const;

/** Desktop right side: full-height album photo with a text carousel. */
export default function AuthShowcase() {
  return (
    <aside className="relative hidden h-full overflow-hidden bg-neutral-900 text-white md:block">
      {/* unoptimized: served as is, no re-compression, for the sharpest result. */}
      <Image
        src={AUTH_IMAGE.src}
        alt={AUTH_IMAGE.alt}
        fill
        unoptimized
        preload
        className="object-cover"
      />
      {/* Keeps the white text readable (AA contrast) on a light photo. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 p-10 lg:p-14">
        <TextCarousel items={MESSAGES} />
      </div>
    </aside>
  );
}
