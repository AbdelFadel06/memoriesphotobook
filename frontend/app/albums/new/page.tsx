import type { Metadata } from "next";

import NewAlbumWizard from "./NewAlbumWizard";

export const metadata: Metadata = { title: "Nouvel album · Memories" };

export default function NewAlbumPage() {
  return <NewAlbumWizard />;
}
