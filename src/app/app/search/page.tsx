import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TaskView } from "@/components/tasks/task-view";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/app/search">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  if (!query) redirect("/app/today");
  return <TaskView key={query} mode={{ kind: "search", q: query }} />;
}
