import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, FolderKanban, AlertTriangle, CheckCircle, Activity } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getProjectsDashboard } from "@/lib/projects-extended.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/projects/dashboard")({
  component: DashboardPage,
});

const HEALTH_COLORS: Record<string, string> = {
  green: "hsl(var(--chart-2, 142 76% 36%))",
  yellow: "hsl(var(--chart-4, 47 100% 50%))",
  red: "hsl(var(--destructive))",
};

function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjectsDashboard()
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center text-muted-foreground py-12">جارٍ التحميل...</div>;
  if (!data) return null;

  const healthData = Object.entries(data.healthCounts).map(([k, v]) => ({ name: k, value: v as number }));
  const milestoneData = Object.entries(data.milestoneStatus).map(([k, v]) => ({ name: k, value: v as number }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/projects">
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">لوحة تحليلات المشاريع</h1>
          <p className="text-muted-foreground text-sm">نظرة شاملة على صحة وأداء المشاريع</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <FolderKanban className="h-5 w-5 text-primary" />
            <span className="text-2xl font-bold">{data.totalProjects}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-2">إجمالي المشاريع</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Activity className="h-5 w-5 text-emerald-500" />
            <span className="text-2xl font-bold">{data.activeProjects}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-2">مشاريع نشطة</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-2xl font-bold">{data.overdueProjects}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-2">مشاريع متأخرة</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <CheckCircle className="h-5 w-5 text-primary" />
            <span className="text-2xl font-bold">{data.completedMilestones}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-2">مراحل مكتملة</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-2xl font-bold">{data.dueSoonMilestones ?? 0}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-2">مراحل تستحق خلال 7 أيام</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span className="text-2xl font-bold">{data.overdueMilestones ?? 0}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-2">مراحل متأخرة</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">توزيع صحة المشاريع</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={healthData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {healthData.map((entry, i) => (
                  <Cell key={i} fill={HEALTH_COLORS[entry.name] || "hsl(var(--primary))"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">حالة المراحل</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={milestoneData}>
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">المشاريع لكل مسؤول</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.projectsPerOwner} layout="vertical">
            <XAxis type="number" fontSize={11} />
            <YAxis type="category" dataKey="name" fontSize={11} width={140} />
            <Tooltip />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">مراحل قادمة</h3>
        {data.upcomingMilestones.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">لا توجد مراحل قادمة</p>
        ) : (
          <div className="space-y-2">
            {data.upcomingMilestones.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded border">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: m.project_id }}
                  className="text-sm hover:underline"
                >
                  {m.project_name || `مرحلة #${m.id.slice(0, 8)}`}
                </Link>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{m.status}</Badge>
                  <span className="text-xs text-muted-foreground">{m.due_date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
