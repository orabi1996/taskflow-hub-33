// Bulk-UNLINK a single module from multiple projects.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Layers, Loader2, Search, Unlink } from "lucide-react";
import { toast } from "sonner";

interface ModuleOpt { id: string; name: string; code: string | null; }
interface LinkRow {
  id: string;
  project_id: string;
  scope: "full" | "partial";
  project: { id: string; name: string } | null;
}

interface Props {
  trigger: React.ReactNode;
  onDone?: () => void;
}

export function BulkUnlinkModuleFromProjectsDialog({ trigger, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState<ModuleOpt[]>([]);
  const [moduleId, setModuleId] = useState<string>("");
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loadingMods, setLoadingMods] = useState(false);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load modules when opened
  useEffect(() => {
    if (!open) return;
    setLoadingMods(true);
    supabase
      .from("company_modules")
      .select("id, name, code")
      .eq("is_active", true)
      .order("sort_order")
      .order("name")
      .then(({ data }) => {
        setModules((data ?? []) as ModuleOpt[]);
        setLoadingMods(false);
      });
  }, [open]);

  // Load linked projects for chosen module
  useEffect(() => {
    setSelected(new Set());
    if (!moduleId) { setLinks([]); return; }
    setLoadingLinks(true);
    supabase
      .from("project_modules")
      .select("id, project_id, scope, project:projects(id, name)")
      .eq("module_id", moduleId)
      .then(({ data }) => {
        setLinks(((data ?? []) as unknown) as LinkRow[]);
        setLoadingLinks(false);
      });
  }, [moduleId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? links.filter((l) => (l.project?.name ?? "").toLowerCase().includes(q)) : links;
  }, [links, search]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const toggleAll = () => {
    if (filtered.every((l) => selected.has(l.id))) {
      const n = new Set(selected);
      filtered.forEach((l) => n.delete(l.id));
      setSelected(n);
    } else {
      const n = new Set(selected);
      filtered.forEach((l) => n.add(l.id));
      setSelected(n);
    }
  };

  const submit = async () => {
    if (selected.size === 0) { toast.error("اختر مشروعًا واحدًا على الأقل"); return; }
    if (!confirm(`إلغاء ربط هذا النظام عن ${selected.size} مشروع؟`)) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("project_modules")
      .delete()
      .in("id", Array.from(selected));
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم إلغاء الربط عن ${selected.size} مشروع`);
    setOpen(false);
    setModuleId("");
    setSelected(new Set());
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlink className="h-4 w-4" /> إلغاء ربط نظام عن مشاريع متعددة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>النظام *</Label>
            <Select value={moduleId} onValueChange={setModuleId} disabled={loadingMods}>
              <SelectTrigger>
                <SelectValue placeholder={loadingMods ? "جارٍ التحميل…" : "اختر النظام"} />
              </SelectTrigger>
              <SelectContent>
                {modules.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}{m.code ? ` (${m.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {moduleId && (
            <div>
              <div className="flex items-center justify-between mb-2 gap-2">
                <Label>المشاريع المرتبطة ({selected.size}/{filtered.length} مختار)</Label>
                {filtered.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
                    {filtered.every((l) => selected.has(l.id)) ? "إلغاء الكل" : "تحديد الكل"}
                  </Button>
                )}
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
                {loadingLinks ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">جارٍ التحميل…</div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {links.length === 0 ? "لا يوجد أي مشروع مرتبط بهذا النظام." : "لا توجد نتائج."}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filtered.map((l) => (
                      <label
                        key={l.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/40 cursor-pointer"
                      >
                        <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                        <span className="text-sm flex-1 truncate">{l.project?.name ?? "(محذوف)"}</span>
                        <Badge variant={l.scope === "full" ? "default" : "secondary"} className="text-xs">
                          {l.scope === "full" ? "كامل" : "جزء"}
                        </Badge>
                      </label>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {!moduleId && (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-md">
              <Layers className="h-5 w-5 mx-auto mb-2 opacity-50" />
              اختر نظامًا لعرض المشاريع المرتبطة به
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={submitting || selected.size === 0}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
            إلغاء الربط ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
