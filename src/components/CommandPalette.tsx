import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  ListChecks, Users2, FolderKanban, UserCircle, BarChart3, ShieldCheck,
  Settings as SettingsIcon, FolderHeart, Bell, Target, Activity,
} from "lucide-react";

interface SearchResults {
  tasks: { id: string; title: string }[];
  projects: { id: string; name: string }[];
  clients: { id: string; name: string; project_id: string }[];
  employees: { id: string; full_name: string }[];
  objectives: { id: string; title: string }[];
}

const empty: SearchResults = { tasks: [], projects: [], clients: [], employees: [], objectives: [] };

function ShortcutRow({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 text-sm text-muted-foreground">
      <span>{label}</span>
      <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">{keys}</kbd>
    </div>
  );
}


export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(empty);
  const navigate = useNavigate();
  const { roles } = useAuth();
  const isManager = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));
  const isAdmin = roles.includes("admin");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(empty);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setResults(empty);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const term = `%${q}%`;
      const [tasksRes, projectsRes, clientsRes, employeesRes, objectivesRes] = await Promise.all([
        supabase.from("tasks").select("id, title").ilike("title", term).limit(5),
        supabase.from("projects").select("id, name").ilike("name", term).limit(5),
        supabase.from("clients").select("id, name, project_id").ilike("name", term).limit(5),
        isManager
          ? supabase.from("profiles").select("id, full_name").ilike("full_name", term).limit(5)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("objectives").select("id, title").ilike("title", term).limit(5),
      ]);
      if (cancelled) return;
      setResults({
        tasks: (tasksRes.data as any[]) ?? [],
        projects: (projectsRes.data as any[]) ?? [],
        clients: (clientsRes.data as any[]) ?? [],
        employees: (employeesRes.data as any[]) ?? [],
        objectives: (objectivesRes.data as any[]) ?? [],
      });
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, isManager]);

  const go = (path: string) => {
    setOpen(false);
    navigate({ to: path });
  };

  const hasResults =
    results.tasks.length + results.projects.length + results.clients.length +
      results.employees.length + results.objectives.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="ابحث عن مهمة، مشروع، عميل أو موظف..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.length < 2 && (
          <>
            <CommandGroup heading="التنقل السريع">
              <CommandItem onSelect={() => go("/dashboard")}>
                <ListChecks className="h-4 w-4 ms-2" /> لوحة التحكم
              </CommandItem>
              <CommandItem onSelect={() => go("/my-projects")}>
                <FolderHeart className="h-4 w-4 ms-2" /> مشاريعي
              </CommandItem>
              <CommandItem onSelect={() => go("/alerts")}>
                <Bell className="h-4 w-4 ms-2" /> التنبيهات
              </CommandItem>
              <CommandItem onSelect={() => go("/profile")}>
                <UserCircle className="h-4 w-4 ms-2" /> ملفي الشخصي
              </CommandItem>
              {isManager && (
                <>
                  <CommandItem onSelect={() => go("/team")}>
                    <Users2 className="h-4 w-4 ms-2" /> الفريق
                  </CommandItem>
                  <CommandItem onSelect={() => go("/projects")}>
                    <FolderKanban className="h-4 w-4 ms-2" /> المشاريع
                  </CommandItem>
                  <CommandItem onSelect={() => go("/reports")}>
                    <BarChart3 className="h-4 w-4 ms-2" /> التقارير
                  </CommandItem>
                </>
              )}
              <CommandItem onSelect={() => go("/performance")}>
                <Target className="h-4 w-4 ms-2" /> الأداء والأهداف
              </CommandItem>
              {isAdmin && (
                <>
                  <CommandItem onSelect={() => go("/admin/overview")}>
                    <Activity className="h-4 w-4 ms-2" /> مركز القيادة
                  </CommandItem>
                  <CommandItem onSelect={() => go("/admin")}>
                    <ShieldCheck className="h-4 w-4 ms-2" /> الموظفون
                  </CommandItem>
                  <CommandItem onSelect={() => go("/settings")}>
                    <SettingsIcon className="h-4 w-4 ms-2" /> الإعدادات
                  </CommandItem>
                </>
              )}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="اختصارات لوحة المفاتيح">
              <ShortcutRow label="فتح البحث السريع" keys="Ctrl / ⌘ + K" />
              <ShortcutRow label="إغلاق النافذة الحالية" keys="Esc" />
              <ShortcutRow label="التنقل بين النتائج" keys="↑ / ↓" />
              <ShortcutRow label="فتح النتيجة المحددة" keys="Enter" />
            </CommandGroup>
          </>
        )}


        {query.length >= 2 && !hasResults && (
          <CommandEmpty>لا توجد نتائج لـ "{query}"</CommandEmpty>
        )}

        {results.tasks.length > 0 && (
          <CommandGroup heading="المهام">
            {results.tasks.map((t) => (
              <CommandItem key={t.id} onSelect={() => go("/dashboard")}>
                <ListChecks className="h-4 w-4 ms-2" /> {t.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="المشاريع">
              {results.projects.map((p) => (
                <CommandItem key={p.id} onSelect={() => go(isManager ? "/projects" : "/my-projects")}>
                  <FolderKanban className="h-4 w-4 ms-2" /> {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {results.clients.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="العملاء">
              {results.clients.map((c) => (
                <CommandItem key={c.id} onSelect={() => go(`/my-projects/${c.project_id}/clients`)}>
                  <Users2 className="h-4 w-4 ms-2" /> {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {results.objectives.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="الأهداف">
              {results.objectives.map((o) => (
                <CommandItem key={o.id} onSelect={() => go("/performance")}>
                  <Target className="h-4 w-4 ms-2" /> {o.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {results.employees.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="الموظفون">
              {results.employees.map((e) => (
                <CommandItem key={e.id} onSelect={() => go("/team")}>
                  <UserCircle className="h-4 w-4 ms-2" /> {e.full_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
