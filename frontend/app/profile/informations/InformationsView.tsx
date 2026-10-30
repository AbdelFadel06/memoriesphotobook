"use client";

import { ProfileForm } from "@/components/profile/ProfileForms";
import SubPage from "@/components/profile/SubPage";

export default function InformationsView() {
  return (
    <SubPage
      title="Informations personnelles"
      intro="Le nom affiché et l'adresse e-mail utilisée pour vous connecter."
    >
      {(user) => <ProfileForm user={user} />}
    </SubPage>
  );
}
