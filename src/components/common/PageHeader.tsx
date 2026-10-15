import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArabicTextReveal } from "@/motion";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}

/** Unified page heading used across all app screens with Thmanyah typography hierarchy (RTL). */
export function PageHeader({ title, description, icon: Icon, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-1">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs transition-transform duration-300 hover:scale-105 motion-safe:hover:-translate-y-0.5">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display tracking-tight text-foreground truncate">
            <ArabicTextReveal as="span">{title}</ArabicTextReveal>
          </h1>
          {description && (
            <p className="text-muted-foreground mt-1 text-sm font-reading leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap font-ui w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">{actions}</div>}
    </div>
  );
}
