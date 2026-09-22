import { NextResponse } from "next/server";
import { requireUser, route } from "@/lib/api";
import { toUserDTO } from "@/lib/auth/session";

export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({ user: toUserDTO(user) });
});
