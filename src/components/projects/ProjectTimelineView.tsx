import { Card } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

interface Project {
  id: string;
  name: string;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  health_status?: string;
}

const HEALTH_COLOR: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-destructive",
};

export function ProjectTimelineView({ projects }: { projects: Project[] }) {
  const items = useMemo(() => projects.filter((p) => p.contract_start_date && p.contract_end_date), [projects]);

  const range = useMemo(() => {
    if (!items.length) return null;
    const starts = items.map((p) => new Date(p.contract_start_date!).getTime());
    const ends = items.map((p) => new Date(p.contract_end_date!).getTime());
    return { min: Math.min(...starts), max: Math.max(...ends) };
  }, [items]);

  if (!items.length) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground text-sm">لا توجد مشاريع بتواريخ عقد محددة لعرضها على الخط الزمني</p>
      </Card>
    );
  }

  const totalRange = range!.max - range!.min || 1;
  const today = Date.now();
  const todayPct = ((today - range!.min) / totalRange) * 100;

  return (
    <Card className="p-4 overflow-x-auto">
      <div className="min-w-[720px] space-y-2 relative">
        {todayPct >= 0 && todayPct <= 100 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-primary z-10 pointer-events-none"
            style={{ insetInlineStart: `calc(220px + ${todayPct}% * (100% - 220px) / 100)` }}
          >
            <span className="absolute -top-5 -translate-x-1/2 text-[10px] bg-primary text-primary-foreground px-1 rounded">
              اليوم
            </span>
          </div>
        )}
        {items.map((p) => {
          const start = new Date(p.contract_start_date!).getTime();
          const end = new Date(p.contract_end_date!).getTime();
          const leftPct = ((start - range!.min) / totalRange) * 100;
          const widthPct = Math.max(2, ((end - start) / totalRange) * 100);
          return (
            <div key={p.id} className="flex items-center gap-3">
              <div className="w-[200px] shrink-0">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: p.id }}
                  className="text-sm font-medium hover:underline truncate block"
                >
                  {p.name}
                </Link>
                <div className="text-[10px] text-muted-foreground">
                  {p.contract_start_date} → {p.contract_end_date}
                </div>
              </div>
              <div className="flex-1 h-6 bg-muted/40 rounded relative">
                <div
                  className={`absolute top-0 bottom-0 rounded ${HEALTH_COLOR[p.health_status || "green"]}`}
                  style={{ insetInlineStart: `${leftPct}%`, width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
