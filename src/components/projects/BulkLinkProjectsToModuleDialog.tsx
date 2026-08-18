// Bulk-link multiple projects to a single company module with scope.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Layers, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

interface ModuleOpt { id: string; name: string; code: string | null; }
interface ProjectOpt { id: string; name: string; }

interface Props {
  trigger: React.ReactNode;
  /** Optional: pre-fill module (used from module page). */
  initialModuleId?: string;
  /** Optional: pre-select projects (multi). */
  initialProjectIds?: string[];
  onDone?: () => void;
}

export function BulkLinkProjectsToModuleDialog({
  trigger, initialModuleId, initialProjectIds, onDone,
}: Props) {
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState<ModuleOpt[]>([]);
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [moduleId, setModuleId] = useState<string>(initialModuleId ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(initialProjectIds ?? []));
  const [scope, setScope] = useState<"full" | "partial">("full");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      supabase.from("company_modules").select("id, name, code").eq("is_active", true).order("sort_order").order("name"),
      supabase.from("projects").select("id, name").eq("is_active", true).order("name"),
    ]).then(([m, p]) => {
      setModules((m.data ?? []) as ModuleOpt[]);
      setProjects((p.data ?? []) as ProjectOpt[]);
      setLoading(false);
    });
    if (initialModuleId) setModuleId(initialModuleId);
    if (initialProjectIds) setSelected(new Set(initialProjectIds));
  }, [open, initialModuleId, initialProjectIds]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
  }, [projects, search]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    if (filteredProjects.every((p) => selected.has(p.id))) {
      const n = new Set(selected);
      filteredProjects.forEach((p) => n.delete(p.id));
      setSelected(n);
    } else {
      const n = new Set(selected);
      filteredProjects.forEach((p) => n.add(p.id));
      setSelected(n);
    }
  };

  const submit = async () => {
    if (!moduleId) { toast.error("اختر النظام"); return; }
    if (selected.size === 0) { toast.error("اختر مشروعًا واحدًا على الأقل"); return; }
    setSubmitting(true);
    // Find existing links to avoid unique constraint errors
    const { data: existing } = await supabase
      .from("project_modules")
      .select("project_id")
      .eq("module_id", moduleId)
      .in("project_id", Array.from(selected));
    const existingSet = new Set((existing ?? []).map((r) => r.project_id as string));
    const rows = Array.from(selected)
      .filter((pid) => !existingSet.has(pid))
      .map((project_id) => ({
        project_id,
        module_id: moduleId,
        scope,
        scope_notes: scope === "partial" ? notes.trim() || null : null,
      }));

    let inserted = 0;
    if (rows.length > 0) {
      const { error } = await supabase.from("project_modules").insert(rows);
      if (error) {
        setSubmitting(false);
        toast.error(error.message);
        return;
      }
      inserted = rows.length;
    }
    setSubmitting(false);
    const skipped = selected.size - inserted;
    toast.success(
      `تم الربط لـ ${inserted} مشروع${skipped ? ` · تم تخطي ${skipped} (مرتبط بالفعل)` : ""}`,
    );
    setOpen(false);
    setSelected(new Set());
    setNotes("");
    setScope("full");
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" /> ربط أنظمة بمشاريع متعددة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>النظام *</Label>
              <Select value={moduleId} onValueChange={setModuleId} disabled={!!initialModuleId}>
                <SelectTrigger><SelectValue placeholder="اختر النظام" /></SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}{m.code ? ` (${m.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>نطاق الربط</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as "full" | "partial")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">النظام كامل</SelectItem>
                  <SelectItem value="partial">جزء فقط</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {scope === "partial" && (
            <div>
              <Label>تفاصيل الجزء (يطبَّق على كل المشاريع المختارة)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثل: وحدة الموارد البشرية فقط"
                maxLength={300}
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2 gap-2">
              <Label>المشاريع ({selected.size} مختار)</Label>
              <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
                {filteredProjects.every((p) => selected.has(p.id)) ? "إلغاء الكل" : "تحديد الكل"}
              </Button>
            </div>
            <div className="relative mb-2">
              <Search className="h-3.5 w-3.5 absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن مشروع..."
                className="ps-9"
              />
            </div>
            <ScrollArea className="h-72 border rounded-md p-2">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">جارٍ التحميل…</div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد مشاريع.</div>
              ) : (
                <div className="space-y-1">
                  {filteredProjects.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/40 cursor-pointer"
                    >
                      <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                      <span className="text-sm flex-1">{p.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={submitting || !moduleId || selected.size === 0}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
            ربط ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
