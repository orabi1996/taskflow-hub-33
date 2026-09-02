import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Target, ClipboardCheck, Award, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";

export const Route = createFileRoute("/_app/performance")({
  component: PerformanceLayout,
});

function PerformanceLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs = [
    { to: "/performance", label: "الأهداف (OKRs)", icon: Target, exact: true },
    { to: "/performance/reviews", label: "تقييم الأداء", icon: ClipboardCheck, exact: false },
    { to: "/performance/kudos", label: "التقدير", icon: Award, exact: false },
  ];

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="space-y-6">
      <PageHeader title="الأداء" description="الأهداف والمراجعات والتقدير" icon={TrendingUp} />

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map((t) => {
          const active = isActive(t.to, t.exact);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                active ? "bg-primary text-primary-foreground" : "hover:bg-accent/40"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>

      <Outlet />
    </div>
  );
}
