import "server-only";
import { db } from "@/lib/db";
import { notFound } from "@/lib/api";

/** An unexpired invite addressed to this email. Anyone else gets 404. */
export async function findMyInvite(inviteId: string, email: string) {
  const invite = await db.listInvite.findFirst({
    where: { id: inviteId, email, expiresAt: { gt: new Date() } },
  });
  if (!invite) throw notFound("Invite");
  return invite;
}
