import type { Metadata } from "next";
import { TaskView } from "@/components/tasks/task-view";
import { accessibleListsWhere } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function generateMetadata({
  params,
}: PageProps<"/app/lists/[id]">): Promise<Metadata> {
  const { id } = await params;
  const user = await getCurrentUser();
  const list = user
    ? await db.list.findFirst({
        where: { id, ...accessibleListsWhere(user.id) },
        select: { name: true },
      })
    : null;
  return { title: list?.name ?? "List not found" };
}

export default async function ListPage({ params }: PageProps<"/app/lists/[id]">) {
  const { id } = await params;
  return <TaskView key={id} mode={{ kind: "list", listId: id }} />;
}
