"use client";

import { PasswordForm } from "@/components/profile/ProfileForms";
import SubPage from "@/components/profile/SubPage";

export default function SecurityView() {
  return (
    <SubPage
      title="Mot de passe et sécurité"
      intro="Choisissez un mot de passe d'au moins 8 caractères que vous n'utilisez nulle part ailleurs."
    >
      {() => <PasswordForm />}
    </SubPage>
  );
}
