import { route } from "@/lib/api";
import { deleteSession } from "@/lib/auth/session";

export const POST = route(async () => {
  await deleteSession();
  return new Response(null, { status: 204 });
});
