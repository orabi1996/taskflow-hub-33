import { Card } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";
import { AnimatedCounter } from "@/lib/motion";

interface KpiCardProps {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  accent?: "primary" | "info" | "success" | "warning" | "destructive";
}

const TONE: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  primary: "text-primary bg-primary/10 border-primary/20",
  info: "text-info bg-info/10 border-info/20",
  success: "text-success bg-success/10 border-success/20",
  warning: "text-warning-foreground bg-warning/15 border-warning/25",
  destructive: "text-destructive bg-destructive/10 border-destructive/20",
};

export function KpiCard({ label, value, hint, icon: Icon, accent = "primary" }: KpiCardProps) {
  const isNumeric = typeof value === "number";

  return (
    <Card className="p-5 hover-lift hover-glow transition-all duration-300 border border-border/70 relative overflow-hidden group">
      {/* Subtle background ambient corner glow */}
      <div className="absolute top-0 end-0 w-24 h-24 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-full pointer-events-none transition-opacity duration-300 opacity-60 group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground font-ui font-medium">{label}</div>
          <div className="text-2xl lg:text-3xl font-bold mt-1.5 truncate text-foreground font-display tracking-tight">
            {isNumeric ? <AnimatedCounter value={value} /> : value}
          </div>
          {hint && <div className="text-xs text-muted-foreground mt-1.5 font-ui">{hint}</div>}
        </div>
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-300 group-hover:scale-105 ${TONE[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
