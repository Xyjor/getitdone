import { db } from "@/lib/db";
import { ApiError, notFound, parseBody, requireUser, route } from "@/lib/api";
import { reorderSchema } from "@/lib/validations";

/**
 * POST /api/tasks/reorder { listId, orderedIds }
 * Saves a new order for tasks in a list (after drag-and-drop).
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { listId, orderedIds } = await parseBody(req, reorderSchema);

  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new ApiError(400, "orderedIds must not contain duplicates");
  }

  const list = await db.list.findFirst({ where: { id: listId, userId: user.id } });
  if (!list) throw notFound("List");

  const owned = await db.task.count({
    where: { id: { in: orderedIds }, listId, userId: user.id },
  });
  if (owned !== orderedIds.length) {
    throw new ApiError(400, "Some tasks do not belong to this list");
  }

  await db.$transaction(
    orderedIds.map((id, position) => db.task.update({ where: { id }, data: { position } })),
  );

  return new Response(null, { status: 204 });
});
