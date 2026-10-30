import type { Metadata } from "next";

import DashboardView from "./DashboardView";

export const metadata: Metadata = { title: "Mes albums · Memories" };

export default function DashboardPage() {
  return <DashboardView />;
}
