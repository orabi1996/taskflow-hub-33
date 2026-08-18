import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ar } from "date-fns/locale";
import type { KanbanTask } from "./KanbanBoard";

const STATUS_DOT: Record<string, string> = {
  pending: "bg-info",
  completed: "bg-success",
  postponed: "bg-warning",
  cancelled: "bg-destructive",
};

export function CalendarView({
  tasks,
  onTaskClick,
}: {
  tasks: KanbanTask[];
  onTaskClick?: (task: KanbanTask) => void;
}) {
  const [cursor, setCursor] = useState<Date>(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 6 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 6 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, KanbanTask[]>();
    for (const t of tasks) {
      const key = format(new Date(t.start_at), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  const weekdays = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => setCursor((d) => addMonths(d, -1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="font-semibold">{format(cursor, "MMMM yyyy", { locale: ar })}</div>
        <Button variant="ghost" size="icon" onClick={() => setCursor((d) => addMonths(d, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
        {weekdays.map((d) => <div key={d} className="py-1 font-medium">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={key}
              className={`min-h-[80px] border rounded-md p-1.5 text-right text-xs transition-colors ${
                inMonth ? "bg-background" : "bg-muted/20 opacity-60"
              } ${isToday ? "border-primary border-2" : ""}`}
            >
              <div className={`font-semibold ${isToday ? "text-primary" : ""}`}>{format(day, "d")}</div>
              <div className="space-y-0.5 mt-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onTaskClick?.(t)}
                    className="w-full text-right text-[10px] truncate px-1 py-0.5 rounded hover:bg-accent/50 flex items-center gap-1"
                    title={t.title}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[t.status] ?? "bg-muted"}`} />
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">+{dayTasks.length - 3}</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
