import type { Metadata } from "next";

import ProfileView from "./ProfileView";

export const metadata: Metadata = { title: "Mon profil · Memories" };

export default function ProfilePage() {
  return <ProfileView />;
}
