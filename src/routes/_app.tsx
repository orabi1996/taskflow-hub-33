import { Link, Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ensureAuthSessionFromCookies } from "@/lib/auth-session";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarRail, SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LogOut, ListChecks, FolderKanban, Users2, BarChart3, ShieldCheck,
  UserCircle, FolderHeart, Settings as SettingsIcon, Search, Clock, LayoutDashboard, TrendingUp, Activity,
} from "lucide-react";
import { NotificationsBell } from "@/components/NotificationsBell";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AiAssistant } from "@/components/AiAssistant";
import brandEmblemAsset from "@/assets/classera-smarx-emblem.png.asset.json";

const brandEmblem = brandEmblemAsset.url;

export const Route = createFileRoute("/_app")({
  // Session lives in browser storage/cookies, so the gate must run client-side only.
  ssr: false,
  beforeLoad: async () => {
    const session = await ensureAuthSessionFromCookies();
    if (!session) throw redirect({ to: "/auth" });
    // Admins can revoke a user's system access from Settings → Employees.
    const { data: prof } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", session.user.id)
      .maybeSingle();
    if (prof && prof.is_active === false) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
  },
  component: AppLayout,
});

type NavItem = { to: string; icon: typeof ListChecks; label: string };

function AppLayout() {
  const { profile, roles, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isManager = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));
  const isAdmin = roles.includes("admin");
  const isAdminOrGM = roles.some((r) => ["admin", "general_manager"].includes(r));
  const isSupport = (roles as string[]).includes("support");
  const canSettings = isAdmin || isSupport;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const mainItems: NavItem[] = [
    {
      to: "/dashboard",
      icon: isAdminOrGM ? LayoutDashboard : ListChecks,
      label: isAdminOrGM ? "لوحة التحكم" : "مهامي",
    },
    { to: "/time", icon: Clock, label: "الوقت" },
    { to: "/my-projects", icon: FolderHeart, label: "مشاريعي" },
    { to: "/performance", icon: TrendingUp, label: "الأداء" },
  ];

  const manageItems: NavItem[] = [
    ...(isManager
      ? [
          { to: "/team", icon: Users2, label: "الفريق" },
          { to: "/projects", icon: FolderKanban, label: "المشاريع" },
          { to: "/reports", icon: BarChart3, label: "التقارير" },
        ]
      : []),
    ...(isAdminOrGM ? [{ to: "/admin/overview", icon: Activity, label: "مركز القيادة" }] : []),
    ...(isAdmin ? [{ to: "/admin", icon: ShieldCheck, label: "الموظفون" }] : []),
    ...(canSettings ? [{ to: "/settings", icon: SettingsIcon, label: "الإعدادات" }] : []),
  ];

  const triggerCmdK = () => {
    const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
    window.dispatchEvent(event);
  };

  // Avoid flashing the employee-shaped UI before roles are known.
  if (authLoading) {
    return (
      <div className="min-h-screen app-ambient flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <CommandPalette />

      <Sidebar side="right" collapsible="icon" variant="inset">
        <SidebarHeader className="p-3">
          <div className="text-xs font-medium text-muted-foreground group-data-[collapsible=icon]:hidden">
            التنقّل
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>العمل اليومي</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map((item) => (
                  <SidebarNavItem key={item.to} item={item} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {manageItems.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>الإدارة</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {manageItems.map((item) => (
                    <SidebarNavItem key={item.to} item={item} />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="ملفي الشخصي">
                <Link to="/profile" activeProps={{ "data-active": "true" } as any}>
                  <UserCircle />
                  <div className="min-w-0 text-start">
                    <div className="truncate text-sm font-medium">{profile?.full_name || "مستخدم"}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {profile?.job_title || roles[0] || ""}
                    </div>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleSignOut} tooltip="تسجيل الخروج">
                <LogOut />
                <span>تسجيل الخروج</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="app-ambient min-h-screen">
        <header className="sticky top-0 z-30 h-14 flex items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md sm:px-5">
          <SidebarTrigger className="shrink-0" />
          <Link
            to="/dashboard"
            className="flex items-center shrink-0 ms-1 me-2"
            title="C-SmarX — من Classera"
          >
            <img src={brandEmblem} alt="Classera | C-SmarX" className="h-8 w-auto" />
          </Link>
          <div className="flex-1 min-w-0">
            <Button
              variant="outline"
              size="sm"
              className="hidden w-full max-w-sm justify-start gap-2 text-muted-foreground sm:inline-flex"
              onClick={triggerCmdK}
              title="بحث (Ctrl/Cmd + K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span>بحث سريع...</span>
              <kbd className="ms-auto rounded bg-muted px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </Button>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={triggerCmdK} title="بحث">
              <Search className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <AiAssistant />
            <NotificationsBell />
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 sm:py-8 relative z-10 animate-fade-in">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function SidebarNavItem({ item }: { item: NavItem }) {
  const { icon: Icon, label, to } = item;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={label}>
        <Link to={to} activeProps={{ "data-active": "true" } as any}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

