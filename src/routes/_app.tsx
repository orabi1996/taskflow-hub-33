import { Link, Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureAuthSessionFromCookies } from "@/lib/auth-session";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Briefcase, LogOut, ListChecks, FolderKanban, Users2, BarChart3, ShieldCheck,
  UserCircle, FolderHeart, Settings as SettingsIcon, Search, Menu, Clock, LayoutDashboard, TrendingUp,
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


function AppLayout() {
  const { profile, roles, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isManager = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));
  const isAdmin = roles.includes("admin");
  const isAdminOrGM = roles.some((r) => ["admin", "general_manager"].includes(r));
  const isSupport = (roles as string[]).includes("support");
  const canSettings = isAdmin || isSupport;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const navLinks = (
    <>
      <NavLink
        to="/dashboard"
        icon={isAdminOrGM ? LayoutDashboard : ListChecks}
        label={isAdminOrGM ? "لوحة التحكم" : "مهامي"}
        onClick={() => setMobileOpen(false)}
      />
      <NavLink to="/time" icon={Clock} label="الوقت" onClick={() => setMobileOpen(false)} />
      <NavLink to="/my-projects" icon={FolderHeart} label="مشاريعي" onClick={() => setMobileOpen(false)} />
      <NavLink to="/performance" icon={TrendingUp} label="الأداء" onClick={() => setMobileOpen(false)} />

      {isManager && (
        <>
          <NavLink to="/team" icon={Users2} label="الفريق" onClick={() => setMobileOpen(false)} />
          <NavLink to="/projects" icon={FolderKanban} label="المشاريع" onClick={() => setMobileOpen(false)} />
          <NavLink to="/reports" icon={BarChart3} label="التقارير" onClick={() => setMobileOpen(false)} />
        </>
      )}
      {isAdminOrGM && (
        <NavLink to="/admin/overview" icon={Activity} label="مركز القيادة" onClick={() => setMobileOpen(false)} />
      )}
      {isAdmin && (
        <NavLink to="/admin" icon={ShieldCheck} label="الموظفون" onClick={() => setMobileOpen(false)} />
      )}
      {canSettings && (
        <NavLink to="/settings" icon={SettingsIcon} label="الإعدادات" onClick={() => setMobileOpen(false)} />
      )}
    </>
  );

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
    <div className="min-h-screen app-ambient relative">
      <CommandPalette />
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle>القائمة</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 mt-6">{navLinks}</nav>
              </SheetContent>
            </Sheet>

            <div className="shrink-0" title="C-SmarX — من Classera">
              <img src={brandEmblem} alt="Classera | C-SmarX" className="h-8 w-auto" />
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 min-w-0 overflow-x-auto">{navLinks}</nav>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex gap-2 text-muted-foreground"
              onClick={triggerCmdK}
              title="بحث (Ctrl/Cmd + K)"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">بحث...</span>
              <kbd className="hidden lg:inline px-1.5 py-0.5 text-[10px] rounded bg-muted">⌘K</kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={triggerCmdK}
              title="بحث"
            >
              <Search className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <AiAssistant />
            <NotificationsBell />
            <Link to="/profile" className="hidden sm:flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-[var(--transition-smooth)] text-end" activeProps={{ className: "bg-secondary" }}>
              <UserCircle className="h-5 w-5 text-muted-foreground" />
              <div className="hidden lg:block">
                <div className="text-sm font-medium">{profile?.full_name || "مستخدم"}</div>
                <div className="text-xs text-muted-foreground">{profile?.job_title || roles[0] || ""}</div>
              </div>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="خروج">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8 relative z-10 animate-fade-in">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({
  to, icon: Icon, label, onClick,
}: {
  to: string; icon: typeof ListChecks; label: string; onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="nav-link px-3 py-2 rounded-md text-sm font-medium hover:bg-accent/40 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
      activeProps={{ "data-active": "true" } as any}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
