import { NextResponse } from "next/server";
import { requireUser, route } from "@/lib/api";

export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({ user });
});
