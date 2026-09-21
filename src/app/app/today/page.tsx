import type { Metadata } from "next";
import { TaskView } from "@/components/tasks/task-view";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return <TaskView mode={{ kind: "today" }} />;
}
