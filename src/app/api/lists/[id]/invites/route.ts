import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiError, forbidden, parseBody, requireUser, route } from "@/lib/api";
import { requireListRole } from "@/lib/access";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { DEMO_EMAIL_DOMAIN } from "@/lib/sample-data";
import { inviteSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

const MAX_PEOPLE_PER_LIST = 20; // members + pending invites
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * POST /api/lists/:id/invites { email, role }: owner only.
 *
 * Invites can only go to existing accounts. Sign-up doesn't verify email ownership (that would
 * need an email service), so an invite waiting for a future sign-up could be claimed by whoever
 * registers that address first. Saying "no account with that email" reveals nothing new:
 * sign-up already reports when an email is taken. No email is sent; the invite appears in the
 * invitee's app.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const { email, role } = await parseBody(req, inviteSchema);
  await requireListRole(user.id, id, "OWNER");
  await rateLimit(`invite:${user.id}`, LIMITS.invitesPerUser);

  // Anyone can create demo accounts, so they must not be able to push invites to real people.
  if (user.isDemo && !email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) {
    throw forbidden(
      "Demo accounts can't share lists with real accounts. Sign up to share for real.",
    );
  }
  if (email === user.email) throw new ApiError(400, "You already own this list");

  const invitee = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!invitee) {
    const message =
      "No GetItDone account uses this email. Ask them to sign up first, then invite them.";
    throw new ApiError(400, message, { email: [message] });
  }

  const alreadyMember = await db.listMember.findUnique({
    where: { listId_userId: { listId: id, userId: invitee.id } },
  });
  if (alreadyMember) throw new ApiError(400, "That person already has access to this list");

  const now = new Date();
  const existing = await db.listInvite.findUnique({
    where: { listId_email: { listId: id, email } },
  });
  // Only a live pending invite for this person doesn't need a new slot (re-inviting an expired
  // one does, so expired invites can't be used to get around the cap).
  if (!existing || existing.expiresAt <= now) {
    const [memberCount, inviteCount] = await Promise.all([
      db.listMember.count({ where: { listId: id } }),
      db.listInvite.count({ where: { listId: id, expiresAt: { gt: now } } }),
    ]);
    if (memberCount + inviteCount >= MAX_PEOPLE_PER_LIST) {
      throw new ApiError(400, `A list can be shared with at most ${MAX_PEOPLE_PER_LIST} people`);
    }
  }

  // Re-inviting updates the role and restarts the expiry instead of creating a duplicate.
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
  await db.listInvite.upsert({
    where: { listId_email: { listId: id, email } },
    create: { listId: id, email, role, invitedById: user.id, expiresAt },
    update: { role, invitedById: user.id, expiresAt },
  });

  return NextResponse.json({ message: "Invitation sent" }, { status: 201 });
});
