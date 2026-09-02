import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, BellOff, FolderKanban, RotateCcw } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ar } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/alerts")({
  component: AlertsPage,
});

interface ProjectRow {
  id: string;
  name: string;
  contract_end_date: string | null;
  alert_days_before: number;
  owner_id: string | null;
  health_status: "green" | "yellow" | "red";
}

interface Dismissal {
  project_id: string;
  dismissed_for_end_date: string | null;
}

function AlertsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [dismissals, setDismissals] = useState<Record<string, Dismissal>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "expired" | "soon">("all");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: ps }, { data: ds }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, contract_end_date, alert_days_before, owner_id, health_status")
        .not("contract_end_date", "is", null),
      supabase.from("project_alert_dismissals" as any).select("project_id, dismissed_for_end_date").eq("user_id", user.id),
    ]);
    setProjects((ps ?? []) as ProjectRow[]);
    const map: Record<string, Dismissal> = {};
    ((ds ?? []) as unknown as Dismissal[]).forEach((d) => { map[d.project_id] = d; });
    setDismissals(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const rows = useMemo(() => {
    return projects
      .map((p) => {
        if (!p.contract_end_date) return null;
        const days = differenceInDays(new Date(p.contract_end_date), new Date());
        const threshold = p.alert_days_before ?? 30;
        let level: "expired" | "soon" | "ok" = "ok";
        if (days < 0) level = "expired";
        else if (days <= threshold) level = "soon";
        if (level === "ok") return null;
        const dis = dismissals[p.id];
        const dismissed = dis && dis.dismissed_for_end_date === p.contract_end_date;
        return { p, level, days, dismissed: !!dismissed };
      })
      .filter(Boolean) as Array<{ p: ProjectRow; level: "expired" | "soon"; days: number; dismissed: boolean }>;
  }, [projects, dismissals]);

  const filtered = rows
    .filter((r) => (filter === "all" ? true : r.level === filter))
    .sort((a, b) => a.days - b.days);

  const dismiss = async (projectId: string, endDate: string | null) => {
    if (!user) return;
    const { error } = await supabase.from("project_alert_dismissals" as any).upsert({
      project_id: projectId, user_id: user.id, dismissed_for_end_date: endDate,
    }, { onConflict: "project_id,user_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("تم تصفير التنبيه حتى تجديد العقد");
    load();
  };

  const restore = async (projectId: string) => {
    if (!user) return;
    await supabase.from("project_alert_dismissals" as any).delete().eq("project_id", projectId).eq("user_id", user.id);
    toast.success("تم إعادة التنبيه");
    load();
  };

  const counts = {
    all: rows.length,
    expired: rows.filter((r) => r.level === "expired").length,
    soon: rows.filter((r) => r.level === "soon").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="تنبيهات العقود"
        description="جميع المشاريع التي اقترب أو انتهى عقدها"
        icon={AlertTriangle}
        actions={
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">الكل ({counts.all})</TabsTrigger>
              <TabsTrigger value="expired">منتهي ({counts.expired})</TabsTrigger>
              <TabsTrigger value="soon">قريب ({counts.soon})</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {loading ? (
        <Card className="overflow-hidden"><ListSkeleton rows={4} /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={BellOff}
            title="لا توجد تنبيهات في هذه الفئة"
            description="ستظهر هنا المشاريع التي يقترب موعد انتهاء عقدها."
          />
        </Card>

      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(({ p, level, days, dismissed }) => (
            <Card key={p.id} className={`p-4 ${dismissed ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <FolderKanban className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      ينتهي: {p.contract_end_date && format(new Date(p.contract_end_date), "d MMM yyyy", { locale: ar })}
                    </div>
                  </div>
                </div>
                <Badge variant={level === "expired" ? "destructive" : "secondary"} className="shrink-0 text-[10px]">
                  {level === "expired" ? `منتهي منذ ${Math.abs(days)} يوم` : `${days} يوم متبقية`}
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-2 pt-3 border-t">
                <Button size="sm" variant="outline" asChild>
                  <Link to="/my-projects">فتح المشروع</Link>
                </Button>
                {dismissed ? (
                  <Button size="sm" variant="ghost" onClick={() => restore(p.id)}>
                    <RotateCcw className="h-3.5 w-3.5 ms-1" /> إعادة التنبيه
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => dismiss(p.id, p.contract_end_date)}>
                    <BellOff className="h-3.5 w-3.5 ms-1" /> تصفير حتى التجديد
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
