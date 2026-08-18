import { useMemo } from "react";
import { DndContext, type DragEndEvent, PointerSensor, useDroppable, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, PauseCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export type TaskStatus = "completed" | "pending" | "postponed" | "cancelled";

export interface KanbanTask {
  id: string;
  title: string;
  status: TaskStatus;
  start_at: string;
  end_at: string | null;
  project?: { name: string } | null;
}

const COLUMNS: { id: TaskStatus; label: string; icon: typeof Clock; cls: string }[] = [
  { id: "pending", label: "قيد التنفيذ", icon: Clock, cls: "border-info/30 bg-info/5" },
  { id: "completed", label: "منتهية", icon: CheckCircle2, cls: "border-success/30 bg-success/5" },
  { id: "postponed", label: "مؤجلة", icon: PauseCircle, cls: "border-warning/30 bg-warning/5" },
  { id: "cancelled", label: "ملغاة", icon: XCircle, cls: "border-destructive/30 bg-destructive/5" },
];

interface KanbanBoardProps {
  tasks: KanbanTask[];
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onTaskClick?: (task: KanbanTask) => void;
}

export function KanbanBoard({ tasks, onStatusChange, onTaskClick }: KanbanBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, KanbanTask[]> = { pending: [], completed: [], postponed: [], cancelled: [] };
    for (const t of tasks) map[t.status]?.push(t);
    return map;
  }, [tasks]);

  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const taskId = String(e.active.id);
    const newStatus = String(e.over.id) as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== newStatus) onStatusChange(taskId, newStatus);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => (
          <Column key={col.id} {...col} tasks={grouped[col.id]} onTaskClick={onTaskClick} />
        ))}
      </div>
    </DndContext>
  );
}

function Column({
  id, label, icon: Icon, cls, tasks, onTaskClick,
}: {
  id: TaskStatus; label: string; icon: typeof Clock; cls: string; tasks: KanbanTask[];
  onTaskClick?: (task: KanbanTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <Card
      ref={setNodeRef}
      className={`p-3 border-2 transition-colors ${cls} ${isOver ? "ring-2 ring-primary/40" : ""} min-h-[300px]`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <DraggableCard key={t.id} task={t} onClick={() => onTaskClick?.(t)} />
        ))}
        {tasks.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-6">لا توجد مهام</div>
        )}
      </div>
    </Card>
  );
}

function DraggableCard({ task, onClick }: { task: KanbanTask; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => { if (!isDragging) onClick(); e.stopPropagation(); }}
      className={`bg-card border rounded-md p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        isDragging ? "opacity-60 shadow-lg" : ""
      }`}
    >
      <div className="font-medium text-sm line-clamp-2">{task.title}</div>
      {task.project && (
        <Badge variant="outline" className="font-normal text-[10px] mt-1.5">{task.project.name}</Badge>
      )}
      <div className="text-[11px] text-muted-foreground mt-2">
        {format(new Date(task.start_at), "d MMM HH:mm", { locale: ar })}
      </div>
    </div>
  );
}
