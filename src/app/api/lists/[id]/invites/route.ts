import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, parseBody, requireUser, route } from "@/lib/api";
import { requireListRole } from "@/lib/access";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { inviteSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

const MAX_PEOPLE_PER_LIST = 20; // members + pending invites
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * POST /api/lists/:id/invites { email, role }: owner only.
 * No email is sent: the invite shows up in the invitee's app (now, or after they sign up with
 * that address). The response is the same whether or not the email has an account, so this
 * endpoint can't be used to find out who is registered.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { email, role } = await parseBody(req, inviteSchema);
  await requireListRole(user.id, id, "OWNER");
  await rateLimit(`invite:${user.id}`, LIMITS.invitesPerUser);

  if (email === user.email) throw new ApiError(400, "You already own this list");

  const alreadyMember = await db.listMember.findFirst({ where: { listId: id, user: { email } } });
  if (alreadyMember) throw new ApiError(400, "That person already has access to this list");

  const existing = await db.listInvite.findUnique({ where: { listId_email: { listId: id, email } } });
  if (!existing) {
    const [memberCount, inviteCount] = await Promise.all([
      db.listMember.count({ where: { listId: id } }),
      db.listInvite.count({ where: { listId: id, expiresAt: { gt: new Date() } } }),
    ]);
    if (memberCount + inviteCount >= MAX_PEOPLE_PER_LIST) {
      throw new ApiError(400, `A list can be shared with at most ${MAX_PEOPLE_PER_LIST} people`);
    }
  }

  // Re-inviting updates the role and restarts the expiry instead of creating a duplicate.
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await db.listInvite.upsert({
    where: { listId_email: { listId: id, email } },
    create: { listId: id, email, role, invitedById: user.id, expiresAt },
    update: { role, invitedById: user.id, expiresAt },
  });

  return NextResponse.json({ message: "Invitation sent" }, { status: 201 });
});
