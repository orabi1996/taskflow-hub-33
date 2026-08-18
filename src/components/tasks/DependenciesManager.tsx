// Manage finish-to-start dependencies between tasks (predecessors).
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, Link2, Plus } from "lucide-react";
import { toast } from "sonner";

interface DepRow {
  id: string;
  predecessor_id: string;
  predecessor: { id: string; title: string; status: string } | null;
}

interface CandidateTask {
  id: string;
  title: string;
}

interface Props {
  taskId: string;
  canMutate: boolean;
}

export function DependenciesManager({ taskId, canMutate }: Props) {
  const [deps, setDeps] = useState<DepRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: depRows }, { data: tasks }] = await Promise.all([
      supabase
        .from("task_dependencies")
        .select("id, predecessor_id, predecessor:tasks!task_dependencies_predecessor_id_fkey(id, title, status)")
        .eq("successor_id", taskId),
      supabase.from("tasks").select("id, title").neq("id", taskId).order("created_at", { ascending: false }).limit(100),
    ]);
    setDeps((depRows ?? []) as unknown as DepRow[]);
    setCandidates((tasks ?? []) as CandidateTask[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const addDep = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setAdding(true);
    const { error } = await supabase.from("task_dependencies").insert({
      predecessor_id: selected,
      successor_id: taskId,
      dep_type: "finish_to_start",
    });
    setAdding(false);
    if (error) {
      if (error.message.includes("Cyclic")) toast.error("لا يمكن إضافة هذه الاعتمادية لأنها تُنشئ حلقة مرجعية");
      else if (error.code === "23505") toast.error("هذه الاعتمادية موجودة بالفعل");
      else toast.error(error.message);
      return;
    }
    setSelected("");
    toast.success("تمت إضافة الاعتمادية");
    load();
  };

  const removeDep = async (id: string) => {
    if (!confirm("حذف هذه الاعتمادية؟")) return;
    const { error } = await supabase.from("task_dependencies").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDeps((prev) => prev.filter((d) => d.id !== id));
  };

  const usedIds = new Set(deps.map((d) => d.predecessor_id));
  const available = candidates.filter((c) => !usedIds.has(c.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link2 className="h-4 w-4" />
        <span>المهام التي يجب إنهاؤها قبل هذه المهمة ({deps.length})</span>
      </div>

      {canMutate && (
        <form onSubmit={addDep} className="flex gap-2">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="اختر مهمة سابقة..." />
            </SelectTrigger>
            <SelectContent>
              {available.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  لا توجد مهام متاحة
                </div>
              ) : (
                available.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={adding || !selected} size="sm">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
      ) : deps.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-md">
          لا توجد اعتماديات
        </div>
      ) : (
        <ul className="space-y-2">
          {deps.map((dep) => {
            const done = dep.predecessor?.status === "completed";
            return (
              <li
                key={dep.id}
                className="flex items-center gap-3 p-2 rounded-md border hover:bg-muted/50 transition-colors"
              >
                <span className={`h-2 w-2 rounded-full ${done ? "bg-green-500" : "bg-amber-500"}`} />
                <span className="flex-1 text-sm">{dep.predecessor?.title ?? "(مهمة محذوفة)"}</span>
                <span className="text-xs text-muted-foreground">
                  {done ? "✓ مكتملة" : "قيد التنفيذ"}
                </span>
                {canMutate && (
                  <Button variant="ghost" size="icon" onClick={() => removeDep(dep.id)} className="h-7 w-7">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
