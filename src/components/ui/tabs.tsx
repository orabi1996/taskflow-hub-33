import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [indicatorStyle, setIndicatorStyle] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    ready: boolean;
  }>({ x: 0, y: 0, width: 0, height: 0, ready: false });

  const updateIndicator = React.useCallback(() => {
    if (!listRef.current) return;
    const activeTrigger = listRef.current.querySelector<HTMLElement>(
      '[role="tab"][data-state="active"]'
    );
    if (activeTrigger) {
      setIndicatorStyle({
        x: activeTrigger.offsetLeft,
        y: activeTrigger.offsetTop,
        width: activeTrigger.offsetWidth,
        height: activeTrigger.offsetHeight,
        ready: true,
      });
    }
  }, []);

  React.useEffect(() => {
    updateIndicator();
    if (!listRef.current) return;

    // Observe changes to data-state and size
    const observer = new MutationObserver(() => updateIndicator());
    observer.observe(listRef.current, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });

    window.addEventListener("resize", updateIndicator);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [updateIndicator]);

  return (
    <TabsPrimitive.List
      ref={(node) => {
        listRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<any>).current = node;
      }}
      className={cn(
        "relative inline-flex h-10 items-center justify-center rounded-xl bg-muted/80 p-1 text-muted-foreground font-ui shadow-inner",
        className
      )}
      {...props}
    >
      {/* Sliding Active Indicator (STEP 8) */}
      {indicatorStyle.ready && (
        <span
          className="absolute z-0 rounded-lg bg-background shadow-xs pointer-events-none transition-[transform,width,height] duration-200 ease-out motion-reduce:transition-none"
          style={{
            transform: `translate3d(${indicatorStyle.x}px, ${indicatorStyle.y}px, 0)`,
            width: `${indicatorStyle.width}px`,
            height: `${indicatorStyle.height}px`,
            insetInlineStart: 0,
            top: 0,
          }}
          aria-hidden="true"
        />
      )}
      {children}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium font-ui ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 duration-200 data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-top-1",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };

