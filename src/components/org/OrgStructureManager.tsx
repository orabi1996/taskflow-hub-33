import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  Briefcase,
  Loader2,
  Building2,
} from "lucide-react";
import { toast } from "sonner";

interface Department {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
}

interface JobPosition {
  id: string;
  department_id: string;
  title: string;
  description: string | null;
  level: number;
  sort_order: number;
  is_active: boolean;
}

interface TreeNode extends Department {
  children: TreeNode[];
}

const ROOT = "__root__";

function buildTree(items: Department[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  items.forEach((it) => map.set(it.id, { ...it, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (arr: TreeNode[]) => {
    arr.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    arr.forEach((c) => sortRec(c.children));
  };
  sortRec(roots);
  return roots;
}

export function OrgStructureManager({ canManage }: { canManage: boolean }) {
  const [depts, setDepts] = useState<Department[]>([]);
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  // dialogs
  const [deptDialog, setDeptDialog] = useState<{
    open: boolean;
    editing: Department | null;
    parentId: string | null;
  }>({ open: false, editing: null, parentId: null });
  const [posDialog, setPosDialog] = useState<{
    open: boolean;
    editing: JobPosition | null;
    deptId: string | null;
  }>({ open: false, editing: null, deptId: null });
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);
  const [deletePos, setDeletePos] = useState<JobPosition | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: d, error: dErr }, { data: p, error: pErr }] = await Promise.all([
      supabase.from("departments").select("*").order("sort_order"),
      supabase.from("job_positions").select("*").order("sort_order"),
    ]);
    if (dErr) toast.error(dErr.message);
    if (pErr) toast.error(pErr.message);
    setDepts(d ?? []);
    setPositions(p ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const tree = useMemo(() => buildTree(depts), [depts]);
  const positionsByDept = useMemo(() => {
    const m = new Map<string, JobPosition[]>();
    positions.forEach((p) => {
      const arr = m.get(p.department_id) ?? [];
      arr.push(p);
      m.set(p.department_id, arr);
    });
    return m;
  }, [positions]);

  const selectedDeptObj = depts.find((d) => d.id === selectedDept) ?? null;
  const selectedPositions = selectedDept ? (positionsByDept.get(selectedDept) ?? []) : [];

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const hasChildren = node.children.length > 0;
    const isOpen = expanded.has(node.id);
    const isSelected = selectedDept === node.id;
    const posCount = positionsByDept.get(node.id)?.length ?? 0;
    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/60 transition-colors ${
            isSelected ? "bg-primary/10 text-primary" : ""
          }`}
          style={{ paddingInlineStart: `${depth * 16 + 8}px` }}
          onClick={() => setSelectedDept(node.id)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggle(node.id);
            }}
            className="h-5 w-5 inline-flex items-center justify-center text-muted-foreground"
          >
            {hasChildren ? (
              isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            ) : (
              <span className="h-3.5 w-3.5 inline-block" />
            )}
          </button>
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium truncate flex-1">{node.name}</span>
          {posCount > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              {posCount}
            </Badge>
          )}
          {!node.is_active && <Badge variant="outline" className="text-[10px] h-5 px-1.5">معطل</Badge>}
        </div>
        {hasChildren && isOpen && (
          <div>{node.children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  // ===== Save Department =====
  const saveDept = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim() || null;
    const parentRaw = String(fd.get("parent_id") ?? ROOT);
    const parent_id = parentRaw === ROOT ? null : parentRaw;
    const sort_order = Number(fd.get("sort_order") ?? 0);
    const is_active = fd.get("is_active") === "on";

    if (name.length < 2) {
      toast.error("اسم القسم قصير جدًا");
      return;
    }

    if (deptDialog.editing) {
      const { error } = await supabase
        .from("departments")
        .update({ name, description, parent_id, sort_order, is_active })
        .eq("id", deptDialog.editing.id);
      if (error) return toast.error(error.message);
      toast.success("تم التحديث");
    } else {
      const { error } = await supabase
        .from("departments")
        .insert({ name, description, parent_id, sort_order, is_active });
      if (error) return toast.error(error.message);
      toast.success("تم إنشاء القسم");
    }
    setDeptDialog({ open: false, editing: null, parentId: null });
    load();
  };

  // ===== Save Position =====
  const savePos = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!posDialog.deptId && !posDialog.editing) return;
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim() || null;
    const level = Number(fd.get("level") ?? 1);
    const sort_order = Number(fd.get("sort_order") ?? 0);
    const is_active = fd.get("is_active") === "on";

    if (title.length < 2) {
      toast.error("المسمى الوظيفي قصير جدًا");
      return;
    }

    if (posDialog.editing) {
      const { error } = await supabase
        .from("job_positions")
        .update({ title, description, level, sort_order, is_active })
        .eq("id", posDialog.editing.id);
      if (error) return toast.error(error.message);
      toast.success("تم التحديث");
    } else {
      const { error } = await supabase
        .from("job_positions")
        .insert({
          department_id: posDialog.deptId!,
          title,
          description,
          level,
          sort_order,
          is_active,
        });
      if (error) return toast.error(error.message);
      toast.success("تم إنشاء المنصب");
    }
    setPosDialog({ open: false, editing: null, deptId: null });
    load();
  };

  const handleDeleteDept = async () => {
    if (!deleteDept) return;
    const { error } = await supabase.from("departments").delete().eq("id", deleteDept.id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    if (selectedDept === deleteDept.id) setSelectedDept(null);
    setDeleteDept(null);
    load();
  };

  const handleDeletePos = async () => {
    if (!deletePos) return;
    const { error } = await supabase.from("job_positions").delete().eq("id", deletePos.id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    setDeletePos(null);
    load();
  };

  // Flatten dept list for parent select (exclude self+descendants when editing)
  const parentOptions = useMemo(() => {
    const exclude = new Set<string>();
    if (deptDialog.editing) {
      const collect = (id: string) => {
        exclude.add(id);
        depts.filter((d) => d.parent_id === id).forEach((c) => collect(c.id));
      };
      collect(deptDialog.editing.id);
    }
    const flat: { id: string; label: string }[] = [];
    const walk = (nodes: TreeNode[], depth: number) => {
      nodes.forEach((n) => {
        if (!exclude.has(n.id)) {
          flat.push({ id: n.id, label: `${"— ".repeat(depth)}${n.name}` });
        }
        walk(n.children, depth + 1);
      });
    };
    walk(tree, 0);
    return flat;
  }, [tree, depts, deptDialog.editing]);

  if (loading) {
    return <div className="text-center text-muted-foreground py-12">جارٍ التحميل...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
      {/* Tree */}
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2 px-2">
          <div className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">شجرة الأقسام</h3>
          </div>
          {canManage && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeptDialog({ open: true, editing: null, parentId: null })}
              title="قسم جذر جديد"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        {tree.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            لا توجد أقسام بعد.
            {canManage && (
              <div className="mt-3">
                <Button
                  size="sm"
                  onClick={() => setDeptDialog({ open: true, editing: null, parentId: null })}
                >
                  <Plus className="h-4 w-4 ms-1" /> أضف القسم الأول
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            {tree.map((n) => renderNode(n, 0))}
          </div>
        )}
      </Card>

      {/* Detail */}
      <Card className="p-5">
        {!selectedDeptObj ? (
          <div className="text-center text-muted-foreground py-16">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p>اختر قسمًا من الشجرة لعرض تفاصيله ومناصبه.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold truncate">{selectedDeptObj.name}</h2>
                {selectedDeptObj.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedDeptObj.description}</p>
                )}
              </div>
              {canManage && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDeptDialog({ open: true, editing: null, parentId: selectedDeptObj.id })
                    }
                  >
                    <Plus className="h-3.5 w-3.5 ms-1" /> قسم فرعي
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDeptDialog({ open: true, editing: selectedDeptObj, parentId: null })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5 ms-1" /> تعديل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteDept(selectedDeptObj)}
                  >
                    <Trash2 className="h-3.5 w-3.5 ms-1" /> حذف
                  </Button>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">المناصب الوظيفية</h3>
                  <Badge variant="secondary">{selectedPositions.length}</Badge>
                </div>
                {canManage && (
                  <Button
                    size="sm"
                    onClick={() =>
                      setPosDialog({ open: true, editing: null, deptId: selectedDeptObj.id })
                    }
                  >
                    <Plus className="h-3.5 w-3.5 ms-1" /> منصب جديد
                  </Button>
                )}
              </div>

              {selectedPositions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">لا توجد مناصب بعد لهذا القسم.</p>
              ) : (
                <div className="space-y-2">
                  {selectedPositions
                    .slice()
                    .sort((a, b) => a.level - b.level || a.sort_order - b.sort_order)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-3 rounded-md border hover:bg-muted/30"
                      >
                        <Badge variant="outline" className="shrink-0">
                          مستوى {p.level}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{p.title}</div>
                          {p.description && (
                            <div className="text-xs text-muted-foreground truncate">{p.description}</div>
                          )}
                        </div>
                        {!p.is_active && <Badge variant="outline">معطل</Badge>}
                        {canManage && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setPosDialog({ open: true, editing: p, deptId: p.department_id })
                              }
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeletePos(p)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Department Dialog */}
      <Dialog
        open={deptDialog.open}
        onOpenChange={(v) => !v && setDeptDialog({ open: false, editing: null, parentId: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deptDialog.editing ? "تعديل القسم" : deptDialog.parentId ? "قسم فرعي جديد" : "قسم جديد"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveDept} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="d-name">اسم القسم *</Label>
              <Input id="d-name" name="name" required maxLength={120} defaultValue={deptDialog.editing?.name ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-desc">الوصف</Label>
              <Textarea
                id="d-desc"
                name="description"
                rows={2}
                maxLength={500}
                defaultValue={deptDialog.editing?.description ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-parent">القسم الأب</Label>
              <Select
                name="parent_id"
                defaultValue={deptDialog.editing?.parent_id ?? deptDialog.parentId ?? ROOT}
              >
                <SelectTrigger id="d-parent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT}>— قسم رئيسي —</SelectItem>
                  {parentOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="d-sort">الترتيب</Label>
                <Input
                  id="d-sort"
                  name="sort_order"
                  type="number"
                  defaultValue={deptDialog.editing?.sort_order ?? 0}
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-center justify-between rounded-md border px-3 py-2 w-full">
                  <Label htmlFor="d-active" className="cursor-pointer">نشط</Label>
                  <Switch id="d-active" name="is_active" defaultChecked={deptDialog.editing?.is_active ?? true} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">حفظ</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Position Dialog */}
      <Dialog
        open={posDialog.open}
        onOpenChange={(v) => !v && setPosDialog({ open: false, editing: null, deptId: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{posDialog.editing ? "تعديل المنصب" : "منصب جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={savePos} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="p-title">المسمى الوظيفي *</Label>
              <Input
                id="p-title"
                name="title"
                required
                maxLength={120}
                defaultValue={posDialog.editing?.title ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-desc">الوصف</Label>
              <Textarea
                id="p-desc"
                name="description"
                rows={2}
                maxLength={500}
                defaultValue={posDialog.editing?.description ?? ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-level">المستوى</Label>
                <Input
                  id="p-level"
                  name="level"
                  type="number"
                  min={1}
                  defaultValue={posDialog.editing?.level ?? 1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-sort">الترتيب</Label>
                <Input
                  id="p-sort"
                  name="sort_order"
                  type="number"
                  defaultValue={posDialog.editing?.sort_order ?? 0}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="p-active" className="cursor-pointer">نشط</Label>
              <Switch id="p-active" name="is_active" defaultChecked={posDialog.editing?.is_active ?? true} />
            </div>
            <DialogFooter>
              <Button type="submit">حفظ</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmations */}
      <AlertDialog open={!!deleteDept} onOpenChange={(v) => !v && setDeleteDept(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف القسم</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف "{deleteDept?.name}" وجميع أقسامه الفرعية ومناصبه. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteDept(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletePos} onOpenChange={(v) => !v && setDeletePos(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المنصب</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف منصب "{deletePos?.title}". لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeletePos(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
