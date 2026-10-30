import type { Metadata } from "next";

import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Inscription · Memories" };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
