import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowRight, FolderKanban, AlertCircle } from "lucide-react";

const ProjectMilestonesManager = lazy(() => import("@/components/projects/ProjectMilestonesManager").then(m => ({ default: m.ProjectMilestonesManager })));
const ProjectMembersManager = lazy(() => import("@/components/projects/ProjectMembersManager").then(m => ({ default: m.ProjectMembersManager })));
const ProjectCommentsThread = lazy(() => import("@/components/projects/ProjectCommentsThread").then(m => ({ default: m.ProjectCommentsThread })));
const ProjectActivityFeed = lazy(() => import("@/components/projects/ProjectActivityFeed").then(m => ({ default: m.ProjectActivityFeed })));
const ProjectModulesManager = lazy(() => import("@/components/projects/ProjectModulesManager").then(m => ({ default: m.ProjectModulesManager })));

const TabFallback = () => <Skeleton className="h-32 w-full" />;

export const Route = createFileRoute("/_app/projects/$projectId")({
  component: ProjectDetailPage,
});

interface Project {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  health_status: string;
  owner_id: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_value: number | null;
  currency: string | null;
}

function ProjectDetailSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in" data-testid="project-skeleton">
      <Skeleton className="h-5 w-64" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-md" />
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const { user, roles } = useAuth();
  const isManager = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string>("");
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // reset previous content immediately on projectId change
    setProject(null);
    setOwnerName("");
    setIsMember(false);
    setError(null);
    setLoading(true);

    (async () => {
      const { data, error: err } = await supabase
        .from("projects")
        .select(
          "id, name, description, is_active, health_status, owner_id, contract_start_date, contract_end_date, contract_value, currency",
        )
        .eq("id", projectId)
        .maybeSingle();
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setError("not_found");
        setLoading(false);
        return;
      }
      setProject(data as Project);
      const tasks: PromiseLike<unknown>[] = [];
      if (data.owner_id) {
        tasks.push(
          supabase.from("profiles").select("full_name").eq("id", data.owner_id).maybeSingle().then(({ data: o }) => {
            if (!cancelled) setOwnerName(o?.full_name || "");
          }),
        );
      }
      if (user?.id) {
        tasks.push(
          supabase
            .from("project_members")
            .select("role")
            .eq("project_id", projectId)
            .eq("user_id", user.id)
            .maybeSingle()
            .then(({ data: m }) => {
              if (!cancelled) setIsMember(!!m);
            }),
        );
      }
      await Promise.all(tasks);
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, user?.id]);

  const canManage = isManager || project?.owner_id === user?.id;

  if (loading) return <ProjectDetailSkeleton />;

  if (error || !project) {
    const isNotFound = error === "not_found" || !project;
    return (
      <Card className="p-8 text-center animate-fade-in" data-testid="project-error">
        <AlertCircle className="h-10 w-10 mx-auto text-destructive/70 mb-3" />
        <p className="text-muted-foreground">
          {isNotFound ? "المشروع غير موجود" : `حدث خطأ أثناء التحميل: ${error}`}
        </p>
        <div className="flex gap-2 justify-center mt-4">
          <Button variant="outline" onClick={() => navigate({ to: "/projects" })}>
            عودة للمشاريع
          </Button>
          {!isNotFound && (
            <Button onClick={() => router.invalidate()}>إعادة المحاولة</Button>
          )}
        </div>
      </Card>
    );
  }

  const healthLabels: Record<string, string> = { green: "صحي", yellow: "تحذير", red: "حرج" };
  const healthVariants: Record<string, "default" | "secondary" | "destructive"> = {
    green: "secondary",
    yellow: "default",
    red: "destructive",
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="project-detail-page">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">الرئيسية</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/projects">المشاريع</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="truncate max-w-[200px]">{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/projects">
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <FolderKanban className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{project.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={healthVariants[project.health_status] || "secondary"}>
              {healthLabels[project.health_status] || project.health_status}
            </Badge>
            {project.is_active ? <Badge variant="secondary">نشط</Badge> : <Badge variant="outline">معطّل</Badge>}
            {ownerName && <span className="text-xs text-muted-foreground">المسؤول: {ownerName}</span>}
            {isMember && !isManager && <Badge variant="outline">عضو في الفريق</Badge>}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/projects/$projectId/dashboard" params={{ projectId }}>
            لوحة المشروع
          </Link>
        </Button>
      </div>

      {project.description && (
        <Card className="p-4 animate-scale-in">
          <p className="text-sm whitespace-pre-wrap">{project.description}</p>
        </Card>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="overview" className="flex-1">نظرة عامة</TabsTrigger>
          <TabsTrigger value="milestones" className="flex-1">المراحل</TabsTrigger>
          <TabsTrigger value="members" className="flex-1">الفريق</TabsTrigger>
          <TabsTrigger value="comments" className="flex-1">التعليقات</TabsTrigger>
          <TabsTrigger value="activity" className="flex-1">النشاط</TabsTrigger>
          <TabsTrigger value="modules" className="flex-1">الأنظمة</TabsTrigger>
        </TabsList>

        <TabsContent
          value="overview"
          forceMount
          className="pt-4 space-y-3 data-[state=inactive]:hidden data-[state=active]:animate-fade-in"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">قيمة العقد</div>
              <div className="text-lg font-bold mt-1">
                {project.contract_value ? `${project.contract_value.toLocaleString("ar")} ${project.currency || ""}` : "—"}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">بداية العقد</div>
              <div className="text-lg font-bold mt-1">{project.contract_start_date || "—"}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">نهاية العقد</div>
              <div className="text-lg font-bold mt-1">{project.contract_end_date || "—"}</div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="milestones" forceMount className="pt-4 data-[state=inactive]:hidden data-[state=active]:animate-fade-in">
          <Suspense fallback={<TabFallback />}>
            <ProjectMilestonesManager projectId={projectId} canManage={canManage} />
          </Suspense>
        </TabsContent>

        <TabsContent value="members" forceMount className="pt-4 data-[state=inactive]:hidden data-[state=active]:animate-fade-in">
          <Suspense fallback={<TabFallback />}>
            <ProjectMembersManager projectId={projectId} canManage={canManage} />
          </Suspense>
        </TabsContent>

        <TabsContent value="comments" forceMount className="pt-4 data-[state=inactive]:hidden data-[state=active]:animate-fade-in">
          <Suspense fallback={<TabFallback />}>
            <ProjectCommentsThread projectId={projectId} currentUserId={user?.id || null} />
          </Suspense>
        </TabsContent>

        <TabsContent value="activity" forceMount className="pt-4 data-[state=inactive]:hidden data-[state=active]:animate-fade-in">
          <Suspense fallback={<TabFallback />}>
            <ProjectActivityFeed projectId={projectId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="modules" forceMount className="pt-4 data-[state=inactive]:hidden data-[state=active]:animate-fade-in">
          <Suspense fallback={<TabFallback />}>
            <ProjectModulesManager projectId={projectId} canMutate={canManage} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
