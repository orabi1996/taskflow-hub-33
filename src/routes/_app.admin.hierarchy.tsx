import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronRight, Loader2, Network, Save, ShieldCheck, Users2 } from "lucide-react";
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

function HierarchyPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: profs }, { data: rls }, { data: poss }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, job_title, manager_id, job_position_id").order("full_name"),
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
        full_name: p.full_name,
        email: p.email,
        job_title: p.job_title,
        manager_id: p.manager_id,
        job_position_id: p.job_position_id,
        roles: rmap.get(p.id) ?? [],
        level: p.job_position_id ? lmap.get(p.job_position_id) ?? null : null,
      }));
      setPeople(list);
      // Expand top-level by default
      setExpanded(new Set(list.filter((x) => !x.manager_id).map((x) => x.id)));
    } catch (e) {
      logError(e, { scope: "loadHierarchy" });
      toast.error("تعذّر تحميل البيانات");
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
    () => people.filter((p) => p.roles.some((r) => ["admin", "general_manager", "manager"].includes(r))),
    [people]
  );

  const isDescendant = (ancestorId: string, candidateId: string): boolean => {
    // candidate is descendant of ancestor?
    let stack = [ancestorId];
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
    const { error } = await supabase.from("profiles").update({ manager_id: managerId }).eq("id", personId);
    setSavingId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تحديث السلسلة الإدارية");
    setPeople((prev) => prev.map((p) => (p.id === personId ? { ...p, manager_id: managerId } : p)));
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const renderNode = (person: Person, depth: number) => {
    const kids = childrenMap.get(person.id) ?? [];
    const isOpen = expanded.has(person.id);
    const primaryRole = person.roles[0] ?? "employee";
    return (
      <div key={person.id}>
        <div
          className="flex items-center gap-2 py-2 px-2 rounded-md hover:bg-accent/30 border-b"
          style={{ paddingInlineStart: `${depth * 24 + 8}px` }}
        >
          {kids.length > 0 ? (
            <button onClick={() => toggle(person.id)} className="text-muted-foreground hover:text-foreground">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{person.full_name}</span>
              <Badge variant="secondary" className="text-xs">{ROLE_LABEL[primaryRole]}</Badge>
              {person.level != null && (
                <Badge variant="outline" className="text-xs">مستوى {person.level}</Badge>
              )}
              {person.job_title && <span className="text-xs text-muted-foreground">— {person.job_title}</span>}
            </div>
            {person.email && <div className="text-xs text-muted-foreground">{person.email}</div>}
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">المدير الأعلى:</Label>
            <Select
              value={person.manager_id ?? "__none__"}
              onValueChange={(v) => setManager(person.id, v === "__none__" ? null : v)}
            >
              <SelectTrigger className="h-8 w-[200px]">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— بدون —</SelectItem>
                {managers
                  .filter((m) => m.id !== person.id && !isDescendant(person.id, m.id))
                  .map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name} {m.level != null ? `(م${m.level})` : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {savingId === person.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
        {isOpen && kids.map((k) => renderNode(k, depth + 1))}
      </div>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageHeader
          icon={Network}
          title="السلم الوظيفي والتسلسل الإداري"
          description="إدارة شجرة المدراء — كل مدير أعلى يرث صلاحية رؤية بيانات مرؤوسي مرؤوسيه (مهام، عملاء، مشاريع)."
        />

        <div className="flex items-center gap-2">
          <Link to="/admin"><Button variant="outline">قائمة الموظفين</Button></Link>
          <Link to="/settings/smtp"><Button variant="outline">إعدادات SMTP</Button></Link>
        </div>
      </div>

      <Card className="p-4 bg-muted/30 border-dashed">
        <div className="flex items-start gap-3 text-sm">
          <Users2 className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <div className="font-semibold mb-1">كيف يعمل توريث الصلاحيات؟</div>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>المدير المباشر يرى ويعدل بيانات مرؤوسيه.</li>
              <li>المدير الأعلى (مدير المدير) يرث رؤية كل البيانات: المهام، تاريخ المهام، المرفقات، العملاء، والمشاريع.</li>
              <li>التوريث يمتد عبر كل المستويات حتى أعلى الهرم تلقائياً.</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            جارٍ التحميل...
          </div>
        ) : roots.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">لا يوجد موظفون.</div>
        ) : (
          <div className="divide-y">
            {roots.map((r) => renderNode(r, 0))}
          </div>
        )}
      </Card>
    </div>
  );
}
