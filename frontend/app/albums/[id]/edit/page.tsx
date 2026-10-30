import type { Metadata } from "next";
import { Suspense } from "react";

import AlbumPagesView from "./AlbumPagesView";

export const metadata: Metadata = { title: "Album · Memories" };

export default function AlbumEditPage() {
  // useParams() is request data: it must stream inside a Suspense boundary.
  return (
    <Suspense
      fallback={
        <div aria-busy="true" aria-label="Chargement" className="min-h-dvh bg-neutral-100" />
      }
    >
      <AlbumPagesView />
    </Suspense>
  );
}
