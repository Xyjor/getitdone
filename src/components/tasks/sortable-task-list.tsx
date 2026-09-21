"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { useReorderTasks } from "@/hooks/use-tasks";
import type { TaskDTO } from "@/lib/types";
import { TaskItem } from "./task-item";

type Props = { listId: string; tasks: TaskDTO[]; today: string };

/** Open tasks of one list, reorderable with mouse, touch or keyboard (Space, arrows, Space). */
export function SortableTaskList({ listId, tasks, today }: Props) {
  const reorder = useReorderTasks(listId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = tasks.map((t) => t.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    reorder.mutate(next.filter((id) => !id.startsWith("temp-")));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: "To reorder, press Space. Use the arrow keys to move, Space to drop, Escape to cancel.",
        },
      }}
    >
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {tasks.map((task) => (
            <SortableTask key={task.id} task={task} today={today} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableTask({ task, today }: { task: TaskDTO; today: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: task.id.startsWith("temp-"),
  });

  return (
    <TaskItem
      ref={setNodeRef}
      task={task}
      today={today}
      isDragging={isDragging}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}
