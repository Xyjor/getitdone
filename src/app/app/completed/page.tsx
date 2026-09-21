import type { Metadata } from "next";
import { TaskView } from "@/components/tasks/task-view";

export const metadata: Metadata = { title: "Completed" };

export default function CompletedPage() {
  return <TaskView mode={{ kind: "completed" }} />;
}
