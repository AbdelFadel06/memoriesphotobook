import Image from "next/image";

import { AUTH_IMAGE } from "./authImage";

/** Mobile top band: the same album photo as on desktop, as a full background. */
export default function MobileHero() {
  return (
    <header className="relative h-[30dvh] min-h-36 shrink-0 overflow-hidden bg-neutral-900 md:hidden">
      <Image
        src={AUTH_IMAGE.src}
        alt={AUTH_IMAGE.alt}
        fill
        unoptimized
        preload
        className="object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent"
      />
      <p className="font-brand absolute inset-x-0 bottom-10 text-center text-5xl text-white drop-shadow-[0_4px_12px_rgb(0_0_0/0.5)]">
        Memories
      </p>
    </header>
  );
}
