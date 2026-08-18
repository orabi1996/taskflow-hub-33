import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { FolderKanban } from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  health_status?: string;
  is_active: boolean;
  owner_id: string | null;
}

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: "green", label: "صحي", color: "bg-emerald-500/10 border-emerald-500/30" },
  { key: "yellow", label: "تحذير", color: "bg-amber-500/10 border-amber-500/30" },
  { key: "red", label: "حرج", color: "bg-destructive/10 border-destructive/30" },
];

export function ProjectKanbanBoard({
  projects,
  employeeMap,
}: {
  projects: Project[];
  employeeMap: Map<string, string>;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map((col) => {
        const items = projects.filter((p) => (p.health_status || "green") === col.key);
        return (
          <div key={col.key} className={`rounded-lg border-2 p-3 ${col.color}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{col.label}</h3>
              <Badge variant="secondary">{items.length}</Badge>
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">لا توجد مشاريع</p>
              ) : (
                items.map((p) => (
                  <Link
                    key={p.id}
                    to="/projects/$projectId"
                    params={{ projectId: p.id }}
                    className="block"
                  >
                    <Card className="p-3 hover:shadow-[var(--shadow-elegant)] transition-[var(--transition-smooth)]">
                      <div className="flex items-start gap-2">
                        <FolderKanban className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{p.name}</div>
                          {p.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-2">
                            {p.owner_id ? employeeMap.get(p.owner_id) || "غير معروف" : "بدون مسؤول"}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
