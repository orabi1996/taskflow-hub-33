import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-muted/70 motion-safe:animate-pulse transition-opacity duration-300 after:absolute after:inset-0 after:bg-[length:200%_100%] after:bg-gradient-to-r after:from-transparent after:via-foreground/[0.05] after:to-transparent motion-safe:after:animate-[shimmer_2s_linear_infinite] motion-reduce:after:hidden",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
