import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Unified empty state block with Thmanyah typography hierarchy and calm micro-interactions. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      {Icon && (
        <span className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 motion-safe:hover:scale-105 shadow-sm">
          <Icon className="h-7 w-7" />
        </span>
      )}
      <p className="font-display font-bold text-base sm:text-lg text-foreground tracking-normal">{title}</p>
      {description && <p className="font-ui text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
