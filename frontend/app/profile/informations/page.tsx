import type { Metadata } from "next";

import InformationsView from "./InformationsView";

export const metadata: Metadata = { title: "Informations personnelles · Memories" };

export default function InformationsPage() {
  return <InformationsView />;
}
