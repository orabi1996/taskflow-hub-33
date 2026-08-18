import { Card } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  accent?: "primary" | "info" | "success" | "warning" | "destructive";
}

const TONE: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  primary: "text-primary bg-primary/10",
  info: "text-info bg-info/10",
  success: "text-success bg-success/10",
  warning: "text-warning-foreground bg-warning/15",
  destructive: "text-destructive bg-destructive/10",
};

export function KpiCard({ label, value, hint, icon: Icon, accent = "primary" }: KpiCardProps) {
  return (
    <Card className="p-5 hover-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1 truncate">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${TONE[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
