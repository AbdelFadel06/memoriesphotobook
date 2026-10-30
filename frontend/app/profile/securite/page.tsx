import type { Metadata } from "next";

import SecurityView from "./SecurityView";

export const metadata: Metadata = { title: "Mot de passe et sécurité · Memories" };

export default function SecurityPage() {
  return <SecurityView />;
}
