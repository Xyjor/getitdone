import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { getCurrentUser, toUserDTO } from "@/lib/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login"); // signature is valid, but the session was revoked or expired

  return <AppShell user={toUserDTO(user)}>{children}</AppShell>;
}
