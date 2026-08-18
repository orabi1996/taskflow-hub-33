import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { History } from "lucide-react";

interface HistoryRow {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  created_at: string;
}

const FIELD_LABEL: Record<string, string> = {
  title: "العنوان",
  details: "التفاصيل",
  status: "الحالة",
  project_id: "المشروع",
  start_at: "وقت البداية",
  end_at: "وقت النهاية",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "منتهية",
  pending: "قيد التنفيذ",
  postponed: "مؤجلة",
  cancelled: "ملغاة",
};

const formatValue = (field: string, val: string | null) => {
  if (val === null || val === "") return "—";
  if (field === "status") return STATUS_LABEL[val] ?? val;
  if (field === "start_at" || field === "end_at") {
    try {
      return format(new Date(val), "d MMM yyyy HH:mm", { locale: ar });
    } catch {
      return val;
    }
  }
  if (val.length > 60) return val.slice(0, 60) + "…";
  return val;
};

export function TaskHistory({ taskId }: { taskId: string }) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("task_history")
        .select("id, field_name, old_value, new_value, changed_by, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(100);
      const list = (data ?? []) as HistoryRow[];
      setRows(list);
      const userIds = Array.from(new Set(list.map((r) => r.changed_by).filter(Boolean) as string[]));
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p) => (map[p.id] = p.full_name));
        setNames(map);
      }
      setLoading(false);
    })();
  }, [taskId]);

  if (loading) return <div className="text-sm text-muted-foreground py-4 text-center">جارٍ التحميل...</div>;
  if (rows.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-6">
        <History className="h-8 w-8 mx-auto opacity-40 mb-2" />
        لا توجد تعديلات بعد
      </div>
    );
  }

  return (
    <ul className="space-y-2 max-h-80 overflow-y-auto">
      {rows.map((r) => (
        <li key={r.id} className="text-sm bg-muted/40 rounded-md px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{FIELD_LABEL[r.field_name] ?? r.field_name}</span>
            <span className="text-muted-foreground text-xs">
              {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: ar })}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            بواسطة: <span className="font-medium text-foreground">{r.changed_by ? names[r.changed_by] ?? "مستخدم" : "النظام"}</span>
          </div>
          <div className="text-xs mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded line-through">{formatValue(r.field_name, r.old_value)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="bg-success/15 text-success px-2 py-0.5 rounded">{formatValue(r.field_name, r.new_value)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
