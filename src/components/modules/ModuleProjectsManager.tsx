// List/edit projects linked to a single module (reverse direction of ProjectModulesManager).
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, Pencil, Check, X, FolderKanban, ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { BulkLinkProjectsToModuleDialog } from "@/components/projects/BulkLinkProjectsToModuleDialog";

interface Row {
  id: string;
  project_id: string;
  scope: "full" | "partial";
  scope_notes: string | null;
  project: { id: string; name: string; is_active: boolean } | null;
}

interface Props {
  moduleId: string;
  moduleName: string;
  canMutate: boolean;
}

export function ModuleProjectsManager({ moduleId, moduleName, canMutate }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScope, setEditScope] = useState<"full" | "partial">("full");
  const [editNotes, setEditNotes] = useState("");
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"all" | "full" | "partial">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (scopeFilter !== "all" && r.scope !== scopeFilter) return false;
      if (statusFilter === "active" && !r.project?.is_active) return false;
      if (statusFilter === "inactive" && r.project?.is_active) return false;
      if (q && !(r.project?.name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, scopeFilter, statusFilter]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("project_modules")
      .select("id, project_id, scope, scope_notes, project:projects(id, name, is_active)")
      .eq("module_id", moduleId)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setRows(((data ?? []) as unknown) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [moduleId]);

  const remove = async (id: string) => {
    if (!confirm("إلغاء ربط هذا المشروع بالنظام؟")) return;
    const { error } = await supabase.from("project_modules").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((p) => p.filter((r) => r.id !== id));
  };

  const startEdit = (r: Row) => {
    setEditingId(r.id);
    setEditScope(r.scope);
    setEditNotes(r.scope_notes ?? "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase
      .from("project_modules")
      .update({
        scope: editScope,
        scope_notes: editScope === "partial" ? editNotes.trim() || null : null,
      })
      .eq("id", editingId);
    if (error) { toast.error(error.message); return; }
    toast.success("تم التحديث");
    setEditingId(null);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-semibold flex items-center gap-2">
          <FolderKanban className="h-4 w-4" /> المشاريع المرتبطة ({filtered.length}/{rows.length})
        </div>
        {canMutate && (
          <BulkLinkProjectsToModuleDialog
            initialModuleId={moduleId}
            onDone={load}
            trigger={
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> ربط مشاريع
              </Button>
            }
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث باسم المشروع..."
          className="h-9"
        />
        <Select value={scopeFilter} onValueChange={(v) => setScopeFilter(v as typeof scopeFilter)}>
          <SelectTrigger className="h-9 md:w-36"><SelectValue placeholder="النطاق" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل النطاقات</SelectItem>
            <SelectItem value="full">كامل فقط</SelectItem>
            <SelectItem value="partial">جزء فقط</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-9 md:w-36"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="inactive">معطّل</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-md">
          {rows.length === 0
            ? `لا توجد مشاريع مرتبطة بنظام "${moduleName}" بعد.`
            : "لا توجد نتائج مطابقة للتصفية."}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id} className="p-3 rounded-md border hover:bg-muted/30 transition-colors">
              {editingId === r.id ? (
                <div className="space-y-2">
                  <div className="font-medium text-sm">{r.project?.name}</div>
                  <Select value={editScope} onValueChange={(v) => setEditScope(v as "full" | "partial")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">النظام كامل</SelectItem>
                      <SelectItem value="partial">جزء فقط</SelectItem>
                    </SelectContent>
                  </Select>
                  {editScope === "partial" && (
                    <Input
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="حدد الجزء المأخوذ"
                      maxLength={300}
                    />
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}><Check className="h-4 w-4 ms-1" />حفظ</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4 ms-1" />إلغاء
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <FolderKanban className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {r.project?.name ?? "(مشروع محذوف)"}
                      </span>
                      <Badge variant={r.scope === "full" ? "default" : "secondary"} className="text-xs">
                        {r.scope === "full" ? "كامل" : "جزء"}
                      </Badge>
                      {r.project && !r.project.is_active && (
                        <Badge variant="outline" className="text-xs">معطّل</Badge>
                      )}
                    </div>
                    {r.scope === "partial" && r.scope_notes && (
                      <p className="text-xs text-muted-foreground mt-1">{r.scope_notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="فتح المشاريع">
                      <Link to="/projects"><ExternalLink className="h-3.5 w-3.5" /></Link>
                    </Button>
                    {canMutate && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => startEdit(r)} className="h-7 w-7">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(r.id)} className="h-7 w-7">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
