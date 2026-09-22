import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsView } from "@/components/settings/settings-view";
import { getCurrentUser, toUserDTO } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <SettingsView user={toUserDTO(user)} />;
}
