import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Network,
  ShieldCheck,
  Users2,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crown,
  Layers,
  Building2,
  UserCheck,
  FolderTree,
  ListFilter,
  UserCog,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { logError } from "@/lib/log-error";

export const Route = createFileRoute("/_app/admin/hierarchy")({
  component: HierarchyPage,
});

type AppRole = "admin" | "general_manager" | "manager" | "employee";

interface Person {
  id: string;
  full_name: string;
  email: string | null;
  job_title: string | null;
  department: string | null;
  manager_id: string | null;
  job_position_id: string | null;
  roles: AppRole[];
  level: number | null;
}

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "أدمن",
  general_manager: "مدير عام",
  manager: "مدير",
  employee: "موظف",
};

const ROLE_COLOR_CLASS: Record<AppRole, { bg: string; text: string; border: string }> = {
  admin: {
    bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/40",
  },
  general_manager: {
    bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/40",
  },
  manager: {
    bg: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    text: "text-teal-600 dark:text-teal-400",
    border: "border-teal-500/40",
  },
  employee: {
    bg: "bg-muted text-muted-foreground border-border",
    text: "text-muted-foreground",
    border: "border-border",
  },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`;
  }
  return parts[0]?.slice(0, 2) ?? "";
}

function HierarchyPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"tree" | "list">("tree");
  const [zoomLevel, setZoomLevel] = useState(1);

  // Dialog for reassigning manager
  const [selectedPersonForManager, setSelectedPersonForManager] = useState<Person | null>(null);
  const [pendingManagerId, setPendingManagerId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: profs }, { data: rls }, { data: poss }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email, job_title, department, manager_id, job_position_id")
          .order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("job_positions").select("id, level"),
      ]);

      const rmap = new Map<string, AppRole[]>();
      (rls ?? []).forEach((r: any) => {
        const a = rmap.get(r.user_id) ?? [];
        a.push(r.role);
        rmap.set(r.user_id, a);
      });

      const lmap = new Map<string, number>();
      (poss ?? []).forEach((p: any) => lmap.set(p.id, p.level));

      const list: Person[] = (profs ?? []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name || "بدون اسم",
        email: p.email,
        job_title: p.job_title,
        department: p.department,
        manager_id: p.manager_id,
        job_position_id: p.job_position_id,
        roles: rmap.get(p.id) ?? [],
        level: p.job_position_id ? lmap.get(p.job_position_id) ?? null : null,
      }));

      setPeople(list);
      // By default expand top 2 levels
      const topIds = list.filter((x) => !x.manager_id).map((x) => x.id);
      const secondLevelIds = list
        .filter((x) => x.manager_id && topIds.includes(x.manager_id))
        .map((x) => x.id);
      setExpanded(new Set([...topIds, ...secondLevelIds]));
    } catch (e) {
      logError(e, { scope: "loadHierarchy" });
      toast.error("تعذّر تحميل بيانات الهيكل الإداري");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  const childrenMap = useMemo(() => {
    const m = new Map<string | null, Person[]>();
    people.forEach((p) => {
      const arr = m.get(p.manager_id) ?? [];
      arr.push(p);
      m.set(p.manager_id, arr);
    });
    return m;
  }, [people]);

  const managers = useMemo(
    () =>
      people.filter((p) =>
        p.roles.some((r) => ["admin", "general_manager", "manager"].includes(r))
      ),
    [people]
  );

  const isDescendant = (ancestorId: string, candidateId: string): boolean => {
    const stack = [ancestorId];
    const visited = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const kids = childrenMap.get(cur) ?? [];
      for (const k of kids) {
        if (k.id === candidateId) return true;
        stack.push(k.id);
      }
    }
    return false;
  };

  const setManager = async (personId: string, managerId: string | null) => {
    if (managerId && (managerId === personId || isDescendant(personId, managerId))) {
      toast.error("لا يمكن اختيار مرؤوس كمدير (تسلسل دائري).");
      return;
    }
    setSavingId(personId);
    const { error } = await supabase
      .from("profiles")
      .update({ manager_id: managerId })
      .eq("id", personId);
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تحديث السلسلة الإدارية بنجاح");
    setPeople((prev) =>
      prev.map((p) => (p.id === personId ? { ...p, manager_id: managerId } : p))
    );
    setSelectedPersonForManager(null);
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const expandAll = () => {
    setExpanded(new Set(people.map((p) => p.id)));
  };

  const collapseAll = () => {
    setExpanded(new Set(people.filter((p) => !p.manager_id).map((p) => p.id)));
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = people.length;
    const leaderCount = managers.length;
    const unassigned = people.filter((p) => !p.manager_id && !p.roles.includes("admin") && !p.roles.includes("general_manager")).length;

    // Calculate maximum depth
    let maxDepth = 0;
    const calculateDepth = (id: string, currentDepth: number) => {
      maxDepth = Math.max(maxDepth, currentDepth);
      const kids = childrenMap.get(id) ?? [];
      for (const k of kids) {
        calculateDepth(k.id, currentDepth + 1);
      }
    };
    const roots = people.filter((p) => !p.manager_id);
    roots.forEach((r) => calculateDepth(r.id, 1));

    return { total, leaderCount, unassigned, maxDepth: maxDepth || 1 };
  }, [people, managers, childrenMap]);

  // Search filter
  const isMatch = (person: Person): boolean => {
    if (!searchQuery.trim()) return false;
    const query = searchQuery.trim().toLowerCase();
    return (
      person.full_name.toLowerCase().includes(query) ||
      Boolean(person.email?.toLowerCase().includes(query)) ||
      Boolean(person.job_title?.toLowerCase().includes(query)) ||
      Boolean(person.department?.toLowerCase().includes(query))
    );
  };

  if (!isAdmin) {
    return (
      <Card className="p-12 text-center">
        <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">هذه الصفحة متاحة للأدمن فقط.</p>
      </Card>
    );
  }

  const roots = people.filter((p) => !p.manager_id);

  // Render Visual Org Chart Node
  const renderVisualNode = (person: Person) => {
    const kids = childrenMap.get(person.id) ?? [];
    const isExpanded = expanded.has(person.id);
    const primaryRole = person.roles[0] ?? "employee";
    const roleStyle = ROLE_COLOR_CLASS[primaryRole] ?? ROLE_COLOR_CLASS.employee;
    const matched = isMatch(person);

    return (
      <div key={person.id} className="flex flex-col items-center select-none">
        {/* Node Card */}
        <div
          className={`relative z-10 w-64 rounded-xl border p-3 bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/50 text-right ${
            matched
              ? "ring-2 ring-primary ring-offset-2 border-primary bg-primary/5"
              : "border-border/80"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {/* Initials Badge */}
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold font-display text-sm border ${roleStyle.bg}`}
            >
              {getInitials(person.full_name)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-sm truncate text-foreground">
                  {person.full_name}
                </span>
                {primaryRole === "admin" && (
                  <Crown className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                )}
              </div>

              <p className="text-xs text-muted-foreground truncate">
                {person.job_title || "عضو فريق"}
              </p>

              {person.department && (
                <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                  {person.department}
                </p>
              )}
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t flex items-center justify-between gap-1 text-[11px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${roleStyle.bg}`}>
                {ROLE_LABEL[primaryRole]}
              </Badge>
              {person.level != null && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  مستوى {person.level}
                </Badge>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              title="تغيير المدير المباشر"
              onClick={() => {
                setSelectedPersonForManager(person);
                setPendingManagerId(person.manager_id);
              }}
            >
              <UserCog className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Subordinates Expand/Collapse Indicator */}
          {kids.length > 0 && (
            <button
              onClick={() => toggle(person.id)}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 flex h-6 px-2 items-center justify-center gap-1 rounded-full border bg-background text-[11px] font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground transition-transform active:scale-95"
            >
              <span>{kids.length}</span>
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}
        </div>

        {/* Children Tree Rendering */}
        {kids.length > 0 && isExpanded && (
          <div className="relative pt-6 flex flex-col items-center">
            {/* Vertical connector line from parent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-border" />

            {/* Children container with horizontal connector */}
            <div className="relative flex gap-8 pt-4">
              {/* Horizontal top bar spanning children */}
              {kids.length > 1 && (
                <div
                  className="absolute top-0 bg-border h-0.5"
                  style={{
                    left: `calc(${100 / (kids.length * 2)}%)`,
                    right: `calc(${100 / (kids.length * 2)}%)`,
                  }}
                />
              )}

              {kids.map((child) => (
                <div key={child.id} className="relative flex flex-col items-center">
                  {/* Connector line down to child */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-border" />
                  {renderVisualNode(child)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Detailed List Node
  const renderListNode = (person: Person, depth: number) => {
    const kids = childrenMap.get(person.id) ?? [];
    const isOpen = expanded.has(person.id);
    const primaryRole = person.roles[0] ?? "employee";
    const roleStyle = ROLE_COLOR_CLASS[primaryRole] ?? ROLE_COLOR_CLASS.employee;
    const matched = isMatch(person);

    return (
      <div key={person.id} className="transition-colors">
        <div
          className={`flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-accent/40 border-b border-border/50 text-sm ${
            matched ? "bg-primary/10 border-primary/30" : ""
          }`}
          style={{ paddingInlineStart: `${depth * 28 + 12}px` }}
        >
          {kids.length > 0 ? (
            <button
              onClick={() => toggle(person.id)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-6" />
          )}

          <div className="flex-1 min-w-0 flex items-center gap-3">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold font-display text-xs border ${roleStyle.bg}`}
            >
              {getInitials(person.full_name)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground truncate">{person.full_name}</span>
                <Badge variant="outline" className={`text-xs px-1.5 py-0 border ${roleStyle.bg}`}>
                  {ROLE_LABEL[primaryRole]}
                </Badge>
                {person.level != null && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    مستوى {person.level}
                  </Badge>
                )}
                {person.job_title && (
                  <span className="text-xs text-muted-foreground truncate">— {person.job_title}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                {person.email && <span>{person.email}</span>}
                {person.department && <span>• {person.department}</span>}
                {kids.length > 0 && <span>• {kids.length} مرؤوسين</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
              المدير الأعلى:
            </Label>
            <Select
              value={person.manager_id ?? "__none__"}
              onValueChange={(v) => setManager(person.id, v === "__none__" ? null : v)}
            >
              <SelectTrigger className="h-8 w-[180px] sm:w-[210px] text-xs">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— بدون مدير مباشر —</SelectItem>
                {managers
                  .filter((m) => m.id !== person.id && !isDescendant(person.id, m.id))
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name} {m.level != null ? `(م${m.level})` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {savingId === person.id && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        {isOpen && kids.map((k) => renderListNode(k, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageHeader
          icon={Network}
          title="السلم الوظيفي والهيكل التنظيمي"
          description="إدارة شجرة القيادات والمدراء — كل مدير أعلى يرث صلاحية رؤية وإدارة بيانات مرؤوسي مرؤوسيه."
        />

        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/admin">
            <Button variant="outline" size="sm">قائمة الموظفين</Button>
          </Link>
          <Link to="/settings/smtp">
            <Button variant="outline" size="sm">إعدادات SMTP</Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Users2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">إجمالي الكادر</p>
              <p className="text-xl font-bold font-display text-foreground">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">القيادات والمدراء</p>
              <p className="text-xl font-bold font-display text-foreground">{stats.leaderCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">عمق الهيكل الإداري</p>
              <p className="text-xl font-bold font-display text-foreground">{stats.maxDepth} مستويات</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-ui">بحاجة لمدير مباشر</p>
              <p className="text-xl font-bold font-display text-foreground">{stats.unassigned}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main View Tabs & Toolbar */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/40 p-2 rounded-xl border border-border/60">
          <TabsList className="bg-background">
            <TabsTrigger value="tree" className="gap-2 text-xs">
              <FolderTree className="h-4 w-4" />
              مخطط الشجرة التفاعلي
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2 text-xs">
              <ListFilter className="h-4 w-4" />
              العرض التسلسلي المفصل
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Box */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث عن موظف أو مسمى..."
                className="h-8 pr-8 text-xs bg-background"
              />
            </div>

            {/* Expand / Collapse Controls */}
            <Button variant="outline" size="sm" onClick={expandAll} className="h-8 text-xs">
              توسيع الكل
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll} className="h-8 text-xs">
              طي الكل
            </Button>

            {/* Tree Zoom Controls (Only in Tree Tab) */}
            {activeTab === "tree" && (
              <div className="flex items-center border rounded-lg bg-background p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setZoomLevel((z) => Math.min(z + 0.15, 1.6))}
                  title="تكبير"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] font-mono px-1.5 text-muted-foreground">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setZoomLevel((z) => Math.max(z - 0.15, 0.4))}
                  title="تصغير"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setZoomLevel(1)}
                  title="إعادة الضبط"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* TAB 1: Visual Interactive Org Chart */}
        <TabsContent value="tree" className="m-0 focus-visible:outline-none">
          <Card className="overflow-hidden border border-border/80 bg-dot-pattern">
            {loading ? (
              <div className="p-16 text-center text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin mx-auto mb-3 text-primary" />
                جارٍ رسم الهيكل الإداري...
              </div>
            ) : roots.length === 0 ? (
              <div className="p-16 text-center text-muted-foreground">لا يوجد موظفون في النظام.</div>
            ) : (
              <div className="overflow-auto min-h-[560px] max-h-[75vh] p-8 flex justify-center items-start cursor-grab active:cursor-grabbing">
                <div
                  className="transition-transform duration-150 origin-top flex flex-col items-center gap-12"
                  style={{ transform: `scale(${zoomLevel})` }}
                >
                  <div className="flex gap-16 items-start justify-center">
                    {roots.map((root) => renderVisualNode(root))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB 2: Detailed List View */}
        <TabsContent value="list" className="m-0 focus-visible:outline-none">
          <Card className="overflow-hidden border border-border/80">
            {loading ? (
              <div className="p-16 text-center text-muted-foreground">
                <Loader2 className="h-7 w-7 animate-spin mx-auto mb-3 text-primary" />
                جارٍ تحميل القائمة...
              </div>
            ) : roots.length === 0 ? (
              <div className="p-16 text-center text-muted-foreground">لا يوجد موظفون.</div>
            ) : (
              <div className="divide-y divide-border/60 p-2">
                {roots.map((r) => renderListNode(r, 0))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reassign Manager Dialog */}
      <Dialog
        open={Boolean(selectedPersonForManager)}
        onOpenChange={(open) => !open && setSelectedPersonForManager(null)}
      >
        <DialogContent className="sm:max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-display">تعيين المدير المباشر</DialogTitle>
            <DialogDescription>
              تحديد أو تعديل المدير المباشر للموظف:{" "}
              <span className="font-semibold text-foreground">
                {selectedPersonForManager?.full_name}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label className="text-xs">اختر المدير المباشر:</Label>
              <Select
                value={pendingManagerId ?? "__none__"}
                onValueChange={(val) => setPendingManagerId(val === "__none__" ? null : val)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر المدير..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— بدون مدير مباشر (أعلى الهرم) —</SelectItem>
                  {selectedPersonForManager &&
                    managers
                      .filter(
                        (m) =>
                          m.id !== selectedPersonForManager.id &&
                          !isDescendant(selectedPersonForManager.id, m.id)
                      )
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name} {m.level != null ? `(مستوى ${m.level})` : ""}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border">
              💡 ملاحظة: عند تعيين المدير، يرث هذا المدير ومدرائه في المستويات الأعلى تلقائياً صلاحية متابعة مهام ومشاريع هذا الموظف.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSelectedPersonForManager(null)}
              disabled={Boolean(savingId)}
            >
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (selectedPersonForManager) {
                  setManager(selectedPersonForManager.id, pendingManagerId);
                }
              }}
              disabled={Boolean(savingId)}
              className="gap-2"
            >
              {savingId && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ التعيين
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
