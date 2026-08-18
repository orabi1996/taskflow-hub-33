// Manage subtasks for a parent task: list, add, toggle status, delete.
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2, Plus, ListTree } from "lucide-react";
import { toast } from "sonner";

interface Subtask {
  id: string;
  title: string;
  status: "pending" | "completed" | "postponed" | "cancelled";
}

interface Props {
  parentTaskId: string;
  parentOwnerId: string;
  canMutate: boolean;
}

export function SubtasksManager({ parentTaskId, parentOwnerId, canMutate }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status")
      .eq("parent_task_id", parentTaskId)
      .order("created_at", { ascending: true });
    setItems((data ?? []) as Subtask[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentTaskId]);

  const addSubtask = async (e: FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (title.length < 2) {
      toast.error("اكتب عنوانًا للمهمة الفرعية");
      return;
    }
    if (!user) return;
    setAdding(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("tasks").insert({
      title,
      user_id: parentOwnerId || user.id,
      parent_task_id: parentTaskId,
      status: "pending",
      start_at: now,
    });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewTitle("");
    toast.success("تمت إضافة المهمة الفرعية");
    load();
  };

  const toggleDone = async (sub: Subtask) => {
    const newStatus = sub.status === "completed" ? "pending" : "completed";
    const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", sub.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.map((s) => (s.id === sub.id ? { ...s, status: newStatus } : s)));
  };

  const removeSub = async (id: string) => {
    if (!confirm("حذف المهمة الفرعية؟")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.filter((s) => s.id !== id));
  };

  const completed = items.filter((i) => i.status === "completed").length;
  const progress = items.length ? Math.round((completed / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListTree className="h-4 w-4" />
          <span>{items.length} مهمة فرعية — {completed} مكتملة ({progress}%)</span>
        </div>
      </div>

      {items.length > 0 && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}

      {canMutate && (
        <form onSubmit={addSubtask} className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="عنوان مهمة فرعية جديدة..."
            maxLength={200}
          />
          <Button type="submit" disabled={adding} size="sm">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mx-auto" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-md">
          لا توجد مهام فرعية بعد
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((sub) => (
            <li
              key={sub.id}
              className="flex items-center gap-3 p-2 rounded-md border hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={sub.status === "completed"}
                onCheckedChange={() => canMutate && toggleDone(sub)}
                disabled={!canMutate}
              />
              <span className={`flex-1 text-sm ${sub.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                {sub.title}
              </span>
              {canMutate && (
                <Button variant="ghost" size="icon" onClick={() => removeSub(sub.id)} className="h-7 w-7">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
