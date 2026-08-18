import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Boxes, Plus, Pencil, Trash2, ChevronRight, ChevronDown,
  Users2, UserPlus, X, Star, GripVertical, Lock, Layers,
} from "lucide-react";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ModuleProjectsManager } from "@/components/modules/ModuleProjectsManager";

export const Route = createFileRoute("/_app/settings/modules")({
  component: ModulesPage,
});

interface Module {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  parent_id: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Profile { id: string; full_name: string; email: string | null; }

interface Assignment {
  id: string;
  user_id: string;
  module_id: string;
  role: string | null;
  is_primary: boolean;
  profile?: { full_name: string; email: string | null } | null;
}

function ModulesPage() {
  const { roles } = useAuth();
  const canEdit = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));

  const [modules, setModules] = useState<Module[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Module | null>(null);

  // Single edit/create dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Module> & { parent_id?: string | null }>({});

  // Single assign
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUser, setAssignUser] = useState<string>("");
  const [assignRole, setAssignRole] = useState<string>("");
  const [assignPrimary, setAssignPrimary] = useState(false);

  // Bulk assign (one user → many modules)
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkUser, setBulkUser] = useState<string>("");
  const [bulkRole, setBulkRole] = useState<string>("");
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkPrimary, setBulkPrimary] = useState<string>("");

  // DnD overlay highlight
  const [overTarget, setOverTarget] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const load = async () => {
    setLoading(true);
    const [m, a, p] = await Promise.all([
      supabase.from("company_modules").select("*").order("sort_order").order("name"),
      supabase.from("employee_modules").select("*"),
      supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    ]);
    if (m.error) toast.error(m.error.message);
    if (a.error) toast.error(a.error.message);
    if (p.error) toast.error(p.error.message);
    const profilesData = ((p.data ?? []) as unknown) as Profile[];
    const profileMap = new Map(profilesData.map((pr) => [pr.id, pr]));
    const rawAssignments = ((a.data ?? []) as unknown) as Assignment[];
    const enriched = rawAssignments.map((row) => ({
      ...row,
      profile: profileMap.get(row.user_id)
        ? { full_name: profileMap.get(row.user_id)!.full_name, email: profileMap.get(row.user_id)!.email }
        : null,
    }));
    setModules(((m.data ?? []) as unknown) as Module[]);
    setAssignments(enriched as Assignment[]);
    setProfiles(profilesData);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, Module[]>();
    for (const m of modules) {
      const k = m.parent_id;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    return map;
  }, [modules]);

  const assignmentsByModule = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of assignments) {
      if (!map.has(a.module_id)) map.set(a.module_id, []);
      map.get(a.module_id)!.push(a);
    }
    return map;
  }, [assignments]);

  const toggle = (id: string) => {
    const n = new Set(expanded);
    n.has(id) ? n.delete(id) : n.add(id);
    setExpanded(n);
  };

  const openCreate = (parent_id: string | null = null) => {
    if (!canEdit) return;
    setEditing({ name: "", code: "", description: "", parent_id, color: "#3b82f6", sort_order: 0, is_active: true });
    setEditOpen(true);
  };
  const openEdit = (m: Module) => {
    if (!canEdit) return;
    setEditing({ ...m });
    setEditOpen(true);
  };

  const save = async () => {
    if (!editing.name?.trim()) { toast.error("الاسم مطلوب"); return; }
    const payload = {
      name: editing.name.trim(),
      code: editing.code?.trim() || null,
      description: editing.description?.trim() || null,
      parent_id: editing.parent_id || null,
      color: editing.color || null,
      sort_order: editing.sort_order ?? 0,
      is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("company_modules").update(payload).eq("id", editing.id)
      : await supabase.from("company_modules").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ");
    setEditOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!canEdit) return;
    if (!confirm("حذف هذا النظام وكل ما يتبعه؟")) return;
    const { error } = await supabase.from("company_modules").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم الحذف"); if (selected?.id === id) setSelected(null); load(); }
  };

  const openAssign = (m: Module) => {
    if (!canEdit) return;
    setSelected(m);
    setAssignUser(""); setAssignRole(""); setAssignPrimary(false);
    setAssignOpen(true);
  };

  const assign = async () => {
    if (!selected || !assignUser) { toast.error("اختر موظفاً"); return; }
    const { error } = await supabase.from("employee_modules").insert({
      user_id: assignUser, module_id: selected.id,
      role: assignRole.trim() || null, is_primary: assignPrimary,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("تم الإسناد");
    setAssignOpen(false);
    load();
  };

  const unassign = async (id: string) => {
    if (!canEdit) return;
    const { error } = await supabase.from("employee_modules").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("أُلغي الإسناد"); load(); }
  };

  const togglePrimary = async (a: Assignment) => {
    if (!canEdit) return;
    const { error } = await supabase.from("employee_modules").update({ is_primary: !a.is_primary }).eq("id", a.id);
    if (error) toast.error(error.message); else load();
  };

  // ======= Bulk assign =======
  const openBulk = () => {
    if (!canEdit) return;
    setBulkUser(""); setBulkRole(""); setBulkSelected(new Set()); setBulkPrimary("");
    setBulkOpen(true);
  };
  const toggleBulk = (id: string) => {
    const n = new Set(bulkSelected);
    n.has(id) ? n.delete(id) : n.add(id);
    if (bulkPrimary === id && !n.has(id)) setBulkPrimary("");
    setBulkSelected(n);
  };
  const submitBulk = async () => {
    if (!bulkUser) { toast.error("اختر موظفاً"); return; }
    if (bulkSelected.size === 0) { toast.error("اختر نظاماً واحداً على الأقل"); return; }
    const existing = new Set(assignments.filter((a) => a.user_id === bulkUser).map((a) => a.module_id));
    const toInsert = Array.from(bulkSelected).filter((id) => !existing.has(id)).map((module_id) => ({
      user_id: bulkUser, module_id,
      role: bulkRole.trim() || null,
      is_primary: bulkPrimary === module_id,
    }));
    if (toInsert.length === 0) { toast.message("الموظف مسند بالفعل لكل الأنظمة المختارة"); }
    else {
      const { error } = await supabase.from("employee_modules").insert(toInsert);
      if (error) { toast.error(error.message); return; }
    }
    // If a primary was chosen and existed already, ensure flag set
    if (bulkPrimary && existing.has(bulkPrimary)) {
      await supabase.from("employee_modules")
        .update({ is_primary: true })
        .eq("user_id", bulkUser).eq("module_id", bulkPrimary);
    }
    // unset other primaries for this user if a new primary chosen
    if (bulkPrimary) {
      await supabase.from("employee_modules")
        .update({ is_primary: false })
        .eq("user_id", bulkUser).neq("module_id", bulkPrimary);
    }
    toast.success("تم الإسناد المتعدد");
    setBulkOpen(false);
    load();
  };

  // ======= DnD: reorder & reparent =======
  // Helpers to detect ancestor (prevent cycles client-side too)
  const isDescendant = (ancestorId: string, candidateId: string): boolean => {
    let cur = modules.find((m) => m.id === candidateId);
    while (cur && cur.parent_id) {
      if (cur.parent_id === ancestorId) return true;
      cur = modules.find((m) => m.id === cur!.parent_id);
    }
    return false;
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setOverTarget(null);
    if (!canEdit) return;
    const dragId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId || dragId === overId) return;

    // Drop targets are encoded as "parent:<id|root>" or "before:<id>"
    const dragged = modules.find((m) => m.id === dragId);
    if (!dragged) return;

    if (overId.startsWith("parent:")) {
      const newParent = overId.slice(7);
      const targetParentId = newParent === "root" ? null : newParent;
      if (targetParentId === dragged.id) return;
      if (targetParentId && isDescendant(dragged.id, targetParentId)) {
        toast.error("لا يمكن نقل النظام داخل أحد فروعه"); return;
      }
      if (targetParentId === dragged.parent_id) return;
      const siblings = childrenOf.get(targetParentId) ?? [];
      const newOrder = (siblings[siblings.length - 1]?.sort_order ?? 0) + 1;
      const { error } = await supabase.from("company_modules")
        .update({ parent_id: targetParentId, sort_order: newOrder })
        .eq("id", dragged.id);
      if (error) toast.error(error.message); else { toast.success("تم النقل"); load(); }
      return;
    }

    if (overId.startsWith("before:")) {
      const targetId = overId.slice(7);
      const target = modules.find((m) => m.id === targetId);
      if (!target) return;
      if (target.id === dragged.id) return;
      if (isDescendant(dragged.id, target.id)) {
        toast.error("لا يمكن نقل النظام داخل أحد فروعه"); return;
      }
      // Place dragged just before target — same parent as target
      const siblings = (childrenOf.get(target.parent_id) ?? []).filter((m) => m.id !== dragged.id);
      const idx = siblings.findIndex((m) => m.id === target.id);
      const newList = [...siblings.slice(0, idx), dragged, ...siblings.slice(idx)];
      // Renumber sort_orders 10,20,30…
      const updates = newList.map((m, i) => ({ id: m.id, sort_order: (i + 1) * 10 }));
      // Update parent if needed
      if (dragged.parent_id !== target.parent_id) {
        await supabase.from("company_modules").update({ parent_id: target.parent_id }).eq("id", dragged.id);
      }
      // Apply sort_order updates
      for (const u of updates) {
        await supabase.from("company_modules").update({ sort_order: u.sort_order }).eq("id", u.id);
      }
      toast.success("تم إعادة الترتيب");
      load();
    }
  };

  const handleDragOver = (e: DragOverEvent) => {
    setOverTarget(e.over?.id ? String(e.over.id) : null);
  };

  // Flat list for parent picker
  const flatModules = useMemo(() => {
    const out: { id: string; name: string; depth: number }[] = [];
    const walk = (pid: string | null, d: number) => {
      for (const m of childrenOf.get(pid) ?? []) {
        out.push({ id: m.id, name: m.name, depth: d });
        walk(m.id, d + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [childrenOf]);

  const renderTree = (parent_id: string | null, depth = 0): React.ReactNode[] => {
    const list = childrenOf.get(parent_id) ?? [];
    return list.map((m) => {
      const kids = childrenOf.get(m.id) ?? [];
      const hasKids = kids.length > 0;
      const isOpen = expanded.has(m.id);
      const count = assignmentsByModule.get(m.id)?.length ?? 0;
      const isSelected = selected?.id === m.id;
      return (
        <div key={m.id}>
          {/* Drop "before" zone */}
          {canEdit && <DropBefore id={m.id} active={overTarget === `before:${m.id}`} depth={depth} />}
          <DraggableNode id={m.id} canEdit={canEdit}>
            <DroppableParent id={m.id} active={overTarget === `parent:${m.id}`}>
              <div
                className={`group flex items-center gap-2 py-2 px-2 rounded-md hover:bg-accent/40 cursor-pointer ${isSelected ? "bg-primary/10 border border-primary/40" : ""}`}
                style={{ paddingInlineStart: `${depth * 20 + 8}px` }}
                onClick={() => setSelected(m)}
              >
                {canEdit && (
                  <span className="text-muted-foreground/50 cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-4 w-4" />
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); if (hasKids) toggle(m.id); }}
                  className="h-5 w-5 flex items-center justify-center text-muted-foreground"
                >
                  {hasKids ? (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />) : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
                </button>
                <div className="h-3 w-3 rounded-sm shrink-0" style={{ background: m.color || "hsl(var(--primary))" }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    {m.name}
                    {m.code && <span className="text-xs text-muted-foreground">({m.code})</span>}
                    {!m.is_active && <Badge variant="outline" className="text-xs">معطّل</Badge>}
                  </div>
                </div>
                <Badge variant="secondary" className="gap-1"><Users2 className="h-3 w-3" />{count}</Badge>
                {canEdit && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      title="إضافة عقدة فرعية"
                      onClick={(e) => { e.stopPropagation(); openCreate(m.id); if (!isOpen) toggle(m.id); }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(m); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); remove(m.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                )}
              </div>
            </DroppableParent>
          </DraggableNode>
          {hasKids && isOpen && <div>{renderTree(m.id, depth + 1)}</div>}
        </div>
      );
    });
  };

  const selectedAssignments = selected ? (assignmentsByModule.get(selected.id) ?? []) : [];
  const availableProfiles = profiles.filter((p) => !selectedAssignments.some((a) => a.user_id === p.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" /> أنظمة الشركة (Modules)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            أدر الأنظمة الفرعية للشركة (ERP, المنصة التعليمية, Edumall, Cpay…) وأسند الموظفين إلى كل نظام.
            {canEdit ? " اسحب وأفلت لإعادة الترتيب أو تغيير الأب." : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!canEdit && (
            <Badge variant="outline" className="gap-1.5"><Lock className="h-3 w-3" /> قراءة فقط</Badge>
          )}
          {canEdit && (
            <>
              <Button variant="outline" onClick={openBulk} className="gap-1.5">
                <Layers className="h-4 w-4" /> إسناد متعدد
              </Button>
              <Button onClick={() => openCreate(null)} className="gap-1.5">
                <Plus className="h-4 w-4" /> نظام رئيسي جديد
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="p-3 lg:col-span-2 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">جارٍ التحميل...</div>
          ) : modules.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              لا توجد أنظمة بعد. ابدأ بإضافة نظام رئيسي مثل "ERP System" أو "المنصة التعليمية".
            </div>
          ) : (
            <DndContext sensors={sensors} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
              <div className="space-y-0.5">
                {renderTree(null)}
                {canEdit && <DropBefore id="__root_end__" active={false} depth={0} />}
                {canEdit && (
                  <DroppableParent id="root" active={overTarget === "parent:root"}>
                    <div className="text-[11px] text-muted-foreground/70 text-center py-2 border border-dashed rounded-md mt-2">
                      أفلت هنا لجعل النظام رئيسياً
                    </div>
                  </DroppableParent>
                )}
              </div>
            </DndContext>
          )}
        </Card>

        <Card className="p-5 lg:col-span-3">
          {!selected ? (
            <div className="text-center text-muted-foreground py-12 text-sm">
              اختر نظاماً من الشجرة لعرض تفاصيله وإسناد الموظفين.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded" style={{ background: selected.color || "hsl(var(--primary))" }} />
                    <h3 className="text-lg font-bold">{selected.name}</h3>
                    {selected.code && <Badge variant="outline">{selected.code}</Badge>}
                  </div>
                  {selected.description && <p className="text-sm text-muted-foreground mt-1.5">{selected.description}</p>}
                </div>
                {canEdit && (
                  <Button size="sm" onClick={() => openAssign(selected)} className="gap-1.5">
                    <UserPlus className="h-4 w-4" /> إسناد موظف
                  </Button>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Users2 className="h-4 w-4" /> الموظفون المسندون ({selectedAssignments.length})
                </div>
                {selectedAssignments.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-md">
                    لا يوجد موظفون مسندون لهذا النظام بعد.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedAssignments.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 p-3 rounded-md border bg-card">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                          {(a.profile?.full_name || "?").charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium flex items-center gap-2">
                            {a.profile?.full_name || "—"}
                            {a.is_primary && <Badge variant="default" className="gap-1"><Star className="h-3 w-3" /> أساسي</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {a.role ? `${a.role} · ` : ""}{a.profile?.email}
                          </div>
                        </div>
                        {canEdit && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => togglePrimary(a)} title="تبديل أساسي">
                              <Star className={`h-4 w-4 ${a.is_primary ? "fill-primary text-primary" : ""}`} />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => unassign(a.id)}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <ModuleProjectsManager
                  moduleId={selected.id}
                  moduleName={selected.name}
                  canMutate={canEdit}
                />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing.id ? "تعديل النظام" : "إضافة نظام جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الاسم *</Label>
              <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="مثل: ERP System" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الكود</Label>
                <Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="ERP" />
              </div>
              <div>
                <Label>اللون</Label>
                <Input type="color" value={editing.color ?? "#3b82f6"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea rows={2} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div>
              <Label>النظام الأب</Label>
              <Select value={editing.parent_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, parent_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— نظام رئيسي —</SelectItem>
                  {flatModules.filter((f) => f.id !== editing.id).map((f) => (
                    <SelectItem key={f.id} value={f.id}>{"—".repeat(f.depth)} {f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={save}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>إسناد موظف إلى {selected?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>الموظف</Label>
              <Select value={assignUser} onValueChange={setAssignUser}>
                <SelectTrigger><SelectValue placeholder="اختر موظفاً" /></SelectTrigger>
                <SelectContent>
                  {availableProfiles.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">جميع الموظفين مسندون لهذا النظام</div>
                  ) : availableProfiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name} {p.email ? `· ${p.email}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الدور (اختياري)</Label>
              <Input value={assignRole} onChange={(e) => setAssignRole(e.target.value)} placeholder="مطوّر، دعم، مسؤول، …" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={assignPrimary} onChange={(e) => setAssignPrimary(e.target.checked)} />
              تعيين كنظام أساسي لهذا الموظف
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>إلغاء</Button>
            <Button onClick={assign} disabled={!assignUser}>إسناد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Layers className="h-4 w-4" /> إسناد موظف لعدة أنظمة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>الموظف *</Label>
                <Select value={bulkUser} onValueChange={setBulkUser}>
                  <SelectTrigger><SelectValue placeholder="اختر موظفاً" /></SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>الدور (اختياري)</Label>
                <Input value={bulkRole} onChange={(e) => setBulkRole(e.target.value)} placeholder="يطبّق على جميع الإسنادات الجديدة" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">الأنظمة ({bulkSelected.size} مختار)</Label>
              <ScrollArea className="h-64 border rounded-md p-2">
                <div className="space-y-1">
                  {flatModules.map((f) => {
                    const checked = bulkSelected.has(f.id);
                    return (
                      <div key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/40">
                        <Checkbox checked={checked} onCheckedChange={() => toggleBulk(f.id)} />
                        <div className="flex-1 text-sm" style={{ paddingInlineStart: `${f.depth * 14}px` }}>
                          {f.name}
                        </div>
                        {checked && (
                          <button
                            type="button"
                            onClick={() => setBulkPrimary(bulkPrimary === f.id ? "" : f.id)}
                            className={`text-xs flex items-center gap-1 px-2 py-1 rounded border ${bulkPrimary === f.id ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground"}`}
                            title="تعيين كأساسي"
                          >
                            <Star className={`h-3 w-3 ${bulkPrimary === f.id ? "fill-current" : ""}`} />
                            {bulkPrimary === f.id ? "أساسي" : "اجعله أساسياً"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {flatModules.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-6">لا توجد أنظمة.</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>إلغاء</Button>
            <Button onClick={submitBulk} disabled={!bulkUser || bulkSelected.size === 0}>إسناد ({bulkSelected.size})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== DnD Helpers =====
function DraggableNode({ id, canEdit, children }: { id: string; canEdit: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled: !canEdit });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={isDragging ? "opacity-50" : ""}
    >
      {children}
    </div>
  );
}

function DroppableParent({ id, active, children }: { id: string; active: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: `parent:${id}` });
  return (
    <div ref={setNodeRef} className={active ? "ring-2 ring-primary/50 rounded-md" : ""}>
      {children}
    </div>
  );
}

function DropBefore({ id, active, depth }: { id: string; active: boolean; depth: number }) {
  const { setNodeRef } = useDroppable({ id: `before:${id}` });
  return (
    <div
      ref={setNodeRef}
      style={{ paddingInlineStart: `${depth * 20 + 8}px` }}
      className={`h-1.5 rounded transition-colors ${active ? "bg-primary" : "bg-transparent"}`}
    />
  );
}
