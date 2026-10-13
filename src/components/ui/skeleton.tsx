import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl bg-muted/80 motion-safe:animate-pulse transition-opacity duration-300",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
