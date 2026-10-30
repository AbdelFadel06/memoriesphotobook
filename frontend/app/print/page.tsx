import type { Metadata } from "next";

import PrintSheet from "./PrintSheet";

export const metadata: Metadata = { title: "Impression", robots: { index: false } };

export default function PrintPage() {
  return <PrintSheet />;
}
