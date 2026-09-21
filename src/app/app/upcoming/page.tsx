import type { Metadata } from "next";
import { TaskView } from "@/components/tasks/task-view";

export const metadata: Metadata = { title: "Upcoming" };

export default function UpcomingPage() {
  return <TaskView mode={{ kind: "upcoming" }} />;
}
