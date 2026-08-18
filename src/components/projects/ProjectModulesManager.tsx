// Manage which company modules (systems) are linked to a project, and the scope.
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, Plus, Boxes, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface Module {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
}

interface Link {
  id: string;
  module_id: string;
  scope: "full" | "partial";
  scope_notes: string | null;
  module: Module | null;
}

interface Props {
  projectId: string;
  canMutate: boolean;
}

export function ProjectModulesManager({ projectId, canMutate }: Props) {
  const [links, setLinks] = useState<Link[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [moduleId, setModuleId] = useState<string>("");
  const [scope, setScope] = useState<"full" | "partial">("full");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScope, setEditScope] = useState<"full" | "partial">("full");
  const [editNotes, setEditNotes] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: linkRows }, { data: modRows }] = await Promise.all([
      supabase
        .from("project_modules")
        .select("id, module_id, scope, scope_notes, module:company_modules(id, name, code, color)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),
      supabase
        .from("company_modules")
        .select("id, name, code, color")
        .eq("is_active", true)
        .order("sort_order")
        .order("name"),
    ]);
    setLinks((linkRows ?? []) as unknown as Link[]);
    setModules((modRows ?? []) as Module[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const addLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!moduleId) {
      toast.error("اختر النظام");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("project_modules").insert({
      project_id: projectId,
      module_id: moduleId,
      scope,
      scope_notes: scope === "partial" ? notes.trim() || null : null,
    });
    setAdding(false);
    if (error) {
      if (error.code === "23505") toast.error("هذا النظام مرتبط بالمشروع بالفعل");
      else toast.error(error.message);
      return;
    }
    setModuleId("");
    setScope("full");
    setNotes("");
    toast.success("تم ربط النظام بالمشروع");
    load();
  };

  const removeLink = async (id: string) => {
    if (!confirm("إلغاء ربط هذا النظام بالمشروع؟")) return;
    const { error } = await supabase.from("project_modules").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const startEdit = (link: Link) => {
    setEditingId(link.id);
    setEditScope(link.scope);
    setEditNotes(link.scope_notes ?? "");
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
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم التحديث");
    setEditingId(null);
    load();
  };

  const usedIds = new Set(links.map((l) => l.module_id));
  const available = modules.filter((m) => !usedIds.has(m.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Boxes className="h-4 w-4" />
        <span>الأنظمة المرتبطة بالمشروع ({links.length})</span>
      </div>

      {canMutate && (
        <form onSubmit={addLink} className="space-y-2 p-3 rounded-lg border bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
            <Select value={moduleId} onValueChange={setModuleId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر نظامًا..." />
              </SelectTrigger>
              <SelectContent>
                {available.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                    كل الأنظمة مرتبطة
                  </div>
                ) : (
                  available.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                      {m.code ? ` (${m.code})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Select value={scope} onValueChange={(v) => setScope(v as "full" | "partial")}>
              <SelectTrigger className="md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">النظام كامل</SelectItem>
                <SelectItem value="partial">جزء فقط</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === "partial" && (
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="حدد الجزء المأخوذ (مثل: وحدة الموارد البشرية فقط)"
              maxLength={300}
            />
          )}
          <Button type="submit" disabled={adding || !moduleId} size="sm" className="w-full">
            {adding ? <Loader2 className="h-4 w-4 animate-spin ms-2" /> : <Plus className="h-4 w-4 ms-2" />}
            ربط النظام بالمشروع
          </Button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6">
          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
        </div>
      ) : links.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-md">
          لا توجد أنظمة مرتبطة بهذا المشروع بعد
        </div>
      ) : (
        <ul className="space-y-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="p-3 rounded-md border hover:bg-muted/30 transition-colors"
            >
              {editingId === link.id ? (
                <div className="space-y-2">
                  <div className="font-medium text-sm">{link.module?.name}</div>
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
                  <div
                    className="h-8 w-8 rounded-md flex-shrink-0 flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: link.module?.color ?? "hsl(var(--primary))" }}
                  >
                    {link.module?.code?.slice(0, 2).toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {link.module?.name ?? "(نظام محذوف)"}
                      </span>
                      <Badge variant={link.scope === "full" ? "default" : "secondary"} className="text-xs">
                        {link.scope === "full" ? "كامل" : "جزء"}
                      </Badge>
                    </div>
                    {link.scope === "partial" && link.scope_notes && (
                      <p className="text-xs text-muted-foreground mt-1">{link.scope_notes}</p>
                    )}
                  </div>
                  {canMutate && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(link)} className="h-7 w-7">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeLink(link.id)} className="h-7 w-7">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
