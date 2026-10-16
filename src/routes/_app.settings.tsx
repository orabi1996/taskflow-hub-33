import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings as SettingsIcon,
  ShieldAlert,
  ArrowRight,
  LayoutGrid,
  ChevronLeft,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { SETTINGS_CATEGORIES, SettingCategory, SettingItem } from "@/lib/settings-config";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const { roles } = useAuth();
  const navigate = useNavigate();
  const isAdmin = roles.includes("admin");
  const isSupport = (roles as string[]).includes("support");
  const canAccess = isAdmin || isSupport;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!canAccess) {
    return (
      <Card className="p-8 text-center max-w-md mx-auto">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive mb-3" />
        <div className="font-semibold mb-1 font-display">صلاحيات غير كافية</div>
        <div className="text-sm text-muted-foreground font-ui">
          صفحة الإعدادات متاحة للإداري والدعم الفني فقط.
        </div>
      </Card>
    );
  }

  const isIndex = pathname === "/settings" || pathname === "/settings/";

  // Filter categories and items visible to this user
  const visibleCategories = SETTINGS_CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter((it) => !it.adminOnly || isAdmin),
  })).filter((cat) => (!cat.adminOnly || isAdmin) && cat.items.length > 0);

  // Find active category based on current pathname
  const activeCategory = visibleCategories.find((cat) =>
    cat.items.some((it) => pathname === it.to || pathname.startsWith(it.to + "/"))
  );

  // Find active item
  const activeItem = activeCategory?.items.find(
    (it) => pathname === it.to || pathname.startsWith(it.to + "/")
  );

  return (
    <div className="space-y-6">
      {/* If on a sub-route, show the grouped navigation bar */}
      {!isIndex && (
        <div className="space-y-3 pb-2 border-b">
          {/* Top Bar: Return to Hub + Quick Category Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="gap-2 text-xs font-ui bg-background/60 hover:bg-muted"
              >
                <Link to="/settings">
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>مركز الإعدادات</span>
                  <LayoutGrid className="h-3.5 w-3.5 text-primary" />
                </Link>
              </Button>

              {activeCategory && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-ui">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <activeCategory.icon className="h-3.5 w-3.5 text-primary" />
                    {activeCategory.title}
                  </span>
                  {activeItem && (
                    <>
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span className="text-primary font-semibold">{activeItem.label}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Switcher */}
            <div className="sm:hidden w-full">
              <Select
                value={pathname}
                onValueChange={(val) => {
                  navigate({ to: val });
                }}
              >
                <SelectTrigger className="w-full text-xs font-ui">
                  <SelectValue placeholder="اختر الإعداد المطلوب" />
                </SelectTrigger>
                <SelectContent>
                  {visibleCategories.map((cat) => (
                    <div key={cat.id} className="p-1">
                      <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground font-display">
                        {cat.title}
                      </div>
                      {cat.items.map((it) => (
                        <SelectItem key={it.to} value={it.to} className="text-xs font-ui">
                          {it.label}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Desktop Category Switcher Pills */}
            <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {visibleCategories.map((cat) => {
                const isCatActive = activeCategory?.id === cat.id;
                return (
                  <Link
                    key={cat.id}
                    to={cat.items[0]?.to || "/settings"}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium font-ui transition-all flex items-center gap-1.5 shrink-0 ${
                      isCatActive
                        ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                        : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <cat.icon className="h-3.5 w-3.5" />
                    <span>{cat.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Sub-item Navigation for the Active Category */}
          {activeCategory && activeCategory.items.length > 1 && (
            <div className="hidden sm:flex items-center gap-1.5 pt-1.5 border-t border-border/40 overflow-x-auto">
              <span className="text-[11px] font-bold text-muted-foreground font-display px-2">
                الأقسام:
              </span>
              {activeCategory.items.map((it) => {
                const isItemActive = pathname === it.to || pathname.startsWith(it.to + "/");
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={`px-3 py-1 rounded-md text-xs font-ui transition-all flex items-center gap-1.5 shrink-0 ${
                      isItemActive
                        ? "bg-primary/15 text-primary font-bold border border-primary/30"
                        : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <it.icon className="h-3.5 w-3.5" />
                    <span>{it.label}</span>
                    {it.badge && (
                      <Badge variant="outline" className="text-[10px] py-0 px-1 border-primary/20">
                        {it.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Main Outlet */}
      <Outlet />
    </div>
  );
}
