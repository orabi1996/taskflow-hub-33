import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { summarizeWorkLogs } from "@/lib/work-log-summary";
import { exportToExcel } from "@/lib/export-utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Log = Database["public"]["Tables"]["work_logs"]["Row"];
type Task = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  "id" | "title" | "client_id" | "module_id"
>;
type Option = { id: string; name: string };
const labels: Record<string, string> = {
  draft: "مسودة",
  submitted: "بانتظار المراجعة",
  accepted: "تمت المراجعة",
  returned: "مطلوب استكمال",
};
const activityLabels: Record<string, string> = {
  work: "عمل",
  meeting: "اجتماع",
  support: "دعم",
  training: "تدريب",
  other: "أخرى",
};
const today = () => format(new Date(), "yyyy-MM-dd");
const emptyForm = () => ({
  work_date: today(),
  task_id: "",
  client_id: "",
  module_id: "",
  activity_type: "work",
  description: "",
  outcome: "",
  blocker: "",
  minutes: "",
});
const selectClass = "w-full rounded-md border bg-background p-2 text-sm";

export function WorkJournal() {
  const { user, roles } = useAuth();
  const userId = user?.id;
  const manager = roles.some((r) => ["admin", "general_manager", "manager"].includes(r));
  const [scope, setScope] = useState("mine");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [employee, setEmployee] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [modules, setModules] = useState<Option[]>([]);
  const [people, setPeople] = useState<Option[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadOptions() {
      // Paginate lookup tables too: silently missing customers makes records unreliable.
      async function options<T>(
        fetchPage: (
          from: number,
          to: number,
        ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
      ) {
        const all: T[] = [];
        for (let offset = 0; ; offset += 500) {
          const result = await fetchPage(offset, offset + 499);
          if (result.error) throw new Error(result.error.message);
          all.push(...(result.data ?? []));
          if ((result.data?.length ?? 0) < 500) return all;
        }
      }
      try {
        const [t, c, m, p] = await Promise.all([
          options((a, b) =>
            supabase
              .from("tasks")
              .select("id,title,client_id,module_id")
              .eq("user_id", userId!)
              .order("id")
              .range(a, b),
          ),
          options((a, b) => supabase.from("clients").select("id,name").order("id").range(a, b)),
          options((a, b) =>
            supabase
              .from("company_modules")
              .select("id,name")
              .eq("is_active", true)
              .order("id")
              .range(a, b),
          ),
          options((a, b) =>
            supabase.from("profiles").select("id,full_name").order("id").range(a, b),
          ),
        ]);
        if (!cancelled) {
          setTasks(t);
          setClients(c);
          setModules(m);
          setPeople(p.map((x) => ({ id: x.id, name: x.full_name })));
        }
      } catch {
        if (!cancelled) toast.error("تعذر تحميل قوائم التسجيل. أعد تحميل الصفحة.");
      }
    }
    if (userId) void loadOptions();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setLogs([]);
    if (!userId || !start || !end || start > end) {
      setLoading(false);
      setError("اختر فترة صحيحة");
      return;
    }
    setLoading(true);
    setError("");
    async function load() {
      try {
        const all: Log[] = [];
        for (let offset = 0; ; offset += 500) {
          let query = supabase
            .from("work_logs")
            .select("*")
            .gte("work_date", start)
            .lte("work_date", end)
            .order("work_date", { ascending: false })
            .order("id")
            .range(offset, offset + 499);
          if (scope === "mine" || !manager) query = query.eq("user_id", userId!);
          else if (employee) query = query.eq("user_id", employee);
          if (clientFilter) query = query.eq("client_id", clientFilter);
          if (moduleFilter) query = query.eq("module_id", moduleFilter);
          const result = await query;
          if (result.error) throw result.error;
          all.push(...(result.data ?? []));
          if ((result.data?.length ?? 0) < 500) break;
        }
        if (!cancelled) setLogs(all);
      } catch {
        if (!cancelled)
          setError("تعذر تحميل سجل الأعمال. تأكد من تطبيق تحديث قاعدة البيانات ثم أعد المحاولة.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, scope, manager, start, end, employee, clientFilter, moduleFilter, revision]);

  const summaries = useMemo(() => summarizeWorkLogs(logs), [logs]);
  const name = (options: Option[], id: string | null) =>
    options.find((x) => x.id === id)?.name ?? (id ? "غير متاح" : "—");
  const field = (key: keyof ReturnType<typeof emptyForm>, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const changeTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    setForm((f) => ({
      ...f,
      task_id: id,
      client_id: task?.client_id ?? "",
      module_id: task?.module_id ?? "",
    }));
  };
  async function save() {
    if (!user || busy) return;
    const minutes = form.minutes ? Number(form.minutes) : null;
    if (
      !form.work_date ||
      form.work_date > today() ||
      form.description.trim().length < 3 ||
      form.outcome.trim().length < 3 ||
      (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440))
    ) {
      toast.error("أدخل تاريخًا صحيحًا ووصفًا ونتيجة، ومدة صحيحة من 1 إلى 1440 دقيقة إن وجدت");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        user_id: user.id,
        task_id: form.task_id || null,
        client_id: form.client_id || null,
        module_id: form.module_id || null,
        minutes,
        status: "draft",
      };
      const result = editing
        ? await supabase
            .from("work_logs")
            .update(payload)
            .eq("id", editing)
            .eq("updated_at", logs.find((x) => x.id === editing)?.updated_at ?? "")
            .select("id")
            .single()
        : await supabase.from("work_logs").insert(payload).select("id").single();
      if (result.error) throw result.error;
      toast.success("تم حفظ مسودة العمل");
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm());
      setRevision((x) => x + 1);
    } catch {
      toast.error(
        "تعذر الحفظ. ربما تغير السجل أو لم يعد مسموحًا تعديله؛ حدّث الصفحة وحاول مجددًا.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function transition(row: Log, status: string) {
    let review_note = row.review_note;
    if (status === "returned") {
      const note = window.prompt("سبب طلب الاستكمال");
      if (!note || note.trim().length < 3) return;
      review_note = note.trim();
    }
    setBusy(true);
    try {
      const result = await supabase
        .from("work_logs")
        .update({ status, review_note })
        .eq("id", row.id)
        .eq("updated_at", row.updated_at)
        .select("id")
        .single();
      if (result.error) throw result.error;
      toast.success("تم تحديث حالة السجل");
      setRevision((x) => x + 1);
    } catch {
      toast.error("تعذر تحديث السجل. أعد تحميل البيانات للتحقق من حالته وصلاحياتك.");
    } finally {
      setBusy(false);
    }
  }
  const exportRows = () =>
    exportToExcel(
      logs.map((row) => ({
        التاريخ: row.work_date,
        الموظف: name(people, row.user_id),
        العميل: name(clients, row.client_id),
        الموديول: name(modules, row.module_id),
        العمل: row.description,
        النتيجة: row.outcome,
        العائق: row.blocker,
        الدقائق: row.minutes ?? "",
        الحالة: labels[row.status],
      })),
      `work-${start}-${end}`,
      "الأعمال",
    );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">سجل الأعمال اليومية</h2>
          <p className="text-sm text-muted-foreground">
            سجّل ما نفذته ونتيجته، واربطه بالعميل والموديول.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setForm(emptyForm());
            setShowForm(true);
          }}
        >
          إضافة عمل
        </Button>
      </div>
      {showForm && (
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold">{editing ? "استكمال سجل العمل" : "عمل جديد"}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              تاريخ العمل
              <Input
                type="date"
                value={form.work_date}
                max={today()}
                onChange={(e) => field("work_date", e.target.value)}
              />
            </label>
            <label>
              المهمة
              <select
                className={selectClass}
                value={form.task_id}
                onChange={(e) => changeTask(e.target.value)}
              >
                <option value="">عمل غير مرتبط بمهمة</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              العميل
              <select
                className={selectClass}
                disabled={!!form.task_id}
                value={form.client_id}
                onChange={(e) => field("client_id", e.target.value)}
              >
                <option value="">عمل داخلي / دون عميل</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              الموديول
              <select
                className={selectClass}
                disabled={!!form.task_id}
                value={form.module_id}
                onChange={(e) => field("module_id", e.target.value)}
              >
                <option value="">دون موديول</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              نوع النشاط
              <select
                className={selectClass}
                value={form.activity_type}
                onChange={(e) => field("activity_type", e.target.value)}
              >
                {Object.entries(activityLabels).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              المدة بالدقائق (اختياري)
              <Input
                type="number"
                min="1"
                max="1440"
                value={form.minutes}
                onChange={(e) => field("minutes", e.target.value)}
              />
            </label>
            <label>
              ما تم تنفيذه
              <Textarea
                maxLength={3000}
                value={form.description}
                onChange={(e) => field("description", e.target.value)}
              />
            </label>
            <label>
              النتيجة المحققة
              <Textarea
                maxLength={3000}
                value={form.outcome}
                onChange={(e) => field("outcome", e.target.value)}
              />
            </label>
            <label>
              العائق / الخطوة التالية (اختياري)
              <Textarea
                maxLength={3000}
                value={form.blocker}
                onChange={(e) => field("blocker", e.target.value)}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={save}>
              حفظ المسودة
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["day", "week", "month"] as const).map((period, i) => (
            <Button
              key={period}
              variant="outline"
              onClick={() => {
                setStart(
                  format(
                    period === "day"
                      ? new Date()
                      : period === "week"
                        ? startOfWeek(new Date(), { weekStartsOn: 0 })
                        : startOfMonth(new Date()),
                    "yyyy-MM-dd",
                  ),
                );
                setEnd(today());
              }}
            >
              {["اليوم", "هذا الأسبوع", "هذا الشهر"][i]}
            </Button>
          ))}
          <Button variant="outline" onClick={() => setRevision((x) => x + 1)}>
            تحديث
          </Button>
          <Button
            variant="outline"
            disabled={loading || !!error || !logs.length}
            onClick={exportRows}
          >
            تصدير Excel
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label>
            من
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            إلى
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          {manager && (
            <label>
              نطاق العرض
              <select
                className={selectClass}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="mine">أعمالي</option>
                <option value="team">الأعمال المتاحة لي للمراجعة</option>
              </select>
            </label>
          )}
          {manager && scope === "team" && (
            <label>
              الموظف
              <select
                className={selectClass}
                value={employee}
                onChange={(e) => setEmployee(e.target.value)}
              >
                <option value="">كل الموظفين المسموحين</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            العميل
            <select
              className={selectClass}
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            >
              <option value="">كل العملاء والأعمال الداخلية</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            الموديول
            <select
              className={selectClass}
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
            >
              <option value="">كل الموديولات</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>
      <p className="text-sm text-muted-foreground">
        السجلات والوقت يعكسان العمل الموثّق، وليسا درجة إنتاجية أو عدد مهام مكتملة. غياب السجلات لا
        يعني غياب العمل. الأسبوع يبدأ الأحد.
      </p>
      {error ? (
        <Card className="p-4 text-destructive" role="alert">
          {error}
        </Card>
      ) : loading ? (
        <p role="status">جارٍ تحميل الأعمال…</p>
      ) : (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {[
                    "الموظف",
                    "سجلات العمل",
                    "تمت مراجعتها",
                    "بانتظار المراجعة",
                    "للاستكمال",
                    "مهام تم العمل عليها",
                    "أيام مسجلة",
                    "دقائق مسجلة",
                  ].map((h) => (
                    <th key={h} className="p-3 text-start">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.userId} className="border-t">
                    <td className="p-3">{name(people, s.userId)}</td>
                    {[
                      s.logs,
                      s.accepted,
                      s.submitted,
                      s.returned,
                      s.tasksWorkedOn,
                      s.recordedDays,
                      s.minutes,
                    ].map((v, i) => (
                      <td key={i} className="p-3">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {!logs.length && (
            <Card className="p-8 text-center text-muted-foreground">
              لا توجد أعمال مسجلة في الفترة والفلاتر المحددة.
            </Card>
          )}
          {logs.map((row) => (
            <Card key={row.id} className="p-4 space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>
                  {name(people, row.user_id)} · {row.work_date}
                </strong>
                <span>{labels[row.status]}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {activityLabels[row.activity_type]} · {name(clients, row.client_id)} ·{" "}
                {name(modules, row.module_id)} ·{" "}
                {row.minutes === null ? "المدة غير مسجلة" : `${row.minutes} دقيقة`}
              </p>
              <p className="whitespace-pre-wrap">{row.description}</p>
              <p className="whitespace-pre-wrap">
                <strong>النتيجة: </strong>
                {row.outcome}
              </p>
              {row.blocker && (
                <p className="whitespace-pre-wrap">
                  <strong>العائق / التالي: </strong>
                  {row.blocker}
                </p>
              )}
              {row.review_note && (
                <p className="text-sm whitespace-pre-wrap">ملاحظة المراجعة: {row.review_note}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {row.user_id === user?.id && ["draft", "returned"].includes(row.status) && (
                  <>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setEditing(row.id);
                        setForm({
                          work_date: row.work_date,
                          task_id: row.task_id ?? "",
                          client_id: row.client_id ?? "",
                          module_id: row.module_id ?? "",
                          activity_type: row.activity_type,
                          description: row.description,
                          outcome: row.outcome,
                          blocker: row.blocker,
                          minutes: row.minutes?.toString() ?? "",
                        });
                        setShowForm(true);
                      }}
                    >
                      تعديل
                    </Button>
                    <Button disabled={busy} onClick={() => transition(row, "submitted")}>
                      إرسال للمراجعة
                    </Button>
                  </>
                )}
                {manager && row.user_id !== user?.id && row.status === "submitted" && (
                  <>
                    <Button disabled={busy} onClick={() => transition(row, "accepted")}>
                      اعتماد السجل
                    </Button>
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() => transition(row, "returned")}
                    >
                      طلب استكمال
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
