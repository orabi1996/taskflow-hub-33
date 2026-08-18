import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowRight, BarChart3, AlertCircle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_app/projects/$projectId/dashboard")({
  component: ProjectDashboardPage,
});

interface Stats {
  name: string;
  health_status: string;
  totalTasks: number;
  doneTasks: number;
  totalMilestones: number;
  doneMilestones: number;
  members: number;
}

function ProjectDashboardPage() {
  const { projectId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(
    async (mode: "initial" | "refresh") => {
      if (mode === "initial") {
        setStats(null);
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      const { data: project, error: pErr } = await supabase
        .from("projects")
        .select("id, name, health_status")
        .eq("id", projectId)
        .maybeSingle();
      if (pErr) {
        setError(pErr.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!project) {
        setError("not_found");
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const [tasksRes, milestonesRes, membersRes] = await Promise.all([
        supabase.from("tasks").select("id, status").eq("project_id", projectId),
        supabase.from("project_milestones").select("id, status").eq("project_id", projectId),
        supabase.from("project_members").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      ]);
      const tasks = (tasksRes.data as Array<{ status: string }> | null) ?? [];
      const milestones = (milestonesRes.data as Array<{ status: string }> | null) ?? [];
      setStats({
        name: project.name,
        health_status: project.health_status,
        totalTasks: tasks.length,
        doneTasks: tasks.filter((t) => t.status === "done" || t.status === "completed").length,
        totalMilestones: milestones.length,
        doneMilestones: milestones.filter((m) => m.status === "completed" || m.status === "done").length,
        members: membersRes.count ?? 0,
      });
      setLoading(false);
      setRefreshing(false);
    },
    [projectId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load("initial");
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in" data-testid="project-skeleton">
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-10 w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Card className="p-8 text-center animate-fade-in" data-testid="project-error">
        <AlertCircle className="h-10 w-10 mx-auto text-destructive/70 mb-3" />
        <p className="text-muted-foreground">
          {error === "not_found" ? "المشروع غير موجود" : `حدث خطأ: ${error}`}
        </p>
        <div className="flex gap-2 justify-center mt-4">
          <Button variant="outline" asChild>
            <Link to="/projects">عودة للمشاريع</Link>
          </Button>
          {error !== "not_found" && (
            <Button onClick={() => load("initial")}>إعادة المحاولة</Button>
          )}
        </div>
      </Card>
    );
  }

  const taskPct = stats.totalTasks ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0;
  const milestonePct = stats.totalMilestones
    ? Math.round((stats.doneMilestones / stats.totalMilestones) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="project-dashboard-page">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/projects">المشاريع</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/projects/$projectId" params={{ projectId }}>
                {stats.name}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>لوحة المشروع</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/projects/$projectId" params={{ projectId }}>
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">لوحة {stats.name}</h1>
          <p className="text-xs text-muted-foreground mt-1">نظرة سريعة على تقدم المشروع</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load("refresh")}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 animate-scale-in">
          <div className="text-xs text-muted-foreground">المهام المكتملة</div>
          <div className="text-2xl font-bold mt-1">{stats.doneTasks}/{stats.totalTasks}</div>
          <div className="text-xs text-primary mt-1">{taskPct}%</div>
        </Card>
        <Card className="p-4 animate-scale-in">
          <div className="text-xs text-muted-foreground">المراحل المكتملة</div>
          <div className="text-2xl font-bold mt-1">{stats.doneMilestones}/{stats.totalMilestones}</div>
          <div className="text-xs text-primary mt-1">{milestonePct}%</div>
        </Card>
        <Card className="p-4 animate-scale-in">
          <div className="text-xs text-muted-foreground">أعضاء الفريق</div>
          <div className="text-2xl font-bold mt-1">{stats.members}</div>
        </Card>
        <Card className="p-4 animate-scale-in">
          <div className="text-xs text-muted-foreground">الحالة الصحية</div>
          <div className="text-2xl font-bold mt-1 capitalize">{stats.health_status}</div>
        </Card>
      </div>
    </div>
  );
}
