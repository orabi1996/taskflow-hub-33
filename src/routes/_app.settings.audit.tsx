import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { listAuditEvents } from "@/lib/audit.functions";
import { exportToCSV, exportToExcel } from "@/lib/export-utils";
import {
  ShieldAlert,
  RefreshCw,
  Loader2,
  Search,
  Download,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

export const Route = createFileRoute("/_app/settings/audit")({
  component: AuditPage,
});

interface AuditRow {
  id: string;
  created_at: string;
  actor_email: string | null;
  event_type: string;
  severity: "info" | "warn" | "critical" | string;
  resource_type: string | null;
  resource_id: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  old_value: unknown;
  new_value: unknown;
  user_agent: string | null;
}

const SEV_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  info: "outline",
  warn: "secondary",
  critical: "destructive",
};

const PAGE_SIZE = 50;

function AuditPage() {
  const { roles } = useAuth();
  const isAllowed = roles.includes("admin") || roles.includes("general_manager");
  const canExport = roles.includes("admin");

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<string>("__all__");
  const [eventType, setEventType] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const buildFilters = () => ({
    severity: severity === "__all__" ? undefined : (severity as any),
    eventType: eventType || undefined,
    resourceType: resourceType || undefined,
    resourceId: resourceId || undefined,
    search: search || undefined,
    startDate: startDate ? new Date(startDate).toISOString() : undefined,
    endDate: endDate ? new Date(endDate + "T23:59:59").toISOString() : undefined,
  });

  const loadPage = async (targetPage: number, refreshCount = false) => {
    setLoading(true);
    try {
      const res = await listAuditEvents({
        data: {
          limit: PAGE_SIZE,
          offset: targetPage * PAGE_SIZE,
          withCount: refreshCount || totalCount === null,
          ...buildFilters(),
        },
      });
      setRows(res.rows as AuditRow[]);
      if (res.count !== null && res.count !== undefined) setTotalCount(res.count);
      setPage(targetPage);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setTotalCount(null);
    loadPage(0, true);
  };

  const exportData = async (format: "csv" | "xlsx") => {
    if (!canExport) return;
    setExporting(true);
    try {
      const all: AuditRow[] = [];
      let offset = 0;
      while (true) {
        const res = await listAuditEvents({
          data: { limit: 500, offset, ...buildFilters() },
        });
        const batch = res.rows as AuditRow[];
        all.push(...batch);
        if (batch.length < 500 || all.length >= 10000) break;
        offset += 500;
      }
      const data = all.map((r) => ({
        التاريخ: new Date(r.created_at).toLocaleString("ar-EG"),
        المستخدم: r.actor_email ?? "",
        الحدث: r.event_type,
        الخطورة: r.severity,
        نوع_المورد: r.resource_type ?? "",
        معرف_المورد: r.resource_id ?? "",
        IP: r.ip ?? "",
        Metadata: r.metadata ? JSON.stringify(r.metadata) : "",
      }));
      const fname = `audit-log-${new Date().toISOString().slice(0, 10)}`;
      if (format === "csv") exportToCSV(data, fname);
      else exportToExcel(data, fname, "AuditLog");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (isAllowed) loadPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllowed]);

  const eventTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.event_type))).sort(),
    [rows],
  );

  const totalPages = totalCount !== null ? Math.max(1, Math.ceil(totalCount / PAGE_SIZE)) : null;
  const rangeStart = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = page * PAGE_SIZE + rows.length;

  if (!isAllowed) {
    return (
      <Card className="p-12 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">هذه الصفحة متاحة للأدمن والمدير العام فقط.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <PageHeader
          icon={ShieldAlert}
          title="سجل التدقيق الأمني"
          description="جميع الأحداث الحساسة في النظام: تسجيل الدخول، تغيير الصلاحيات، التعديلات الإدارية."
        />

        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <>
              <Button
                variant="outline"
                onClick={() => exportData("csv")}
                disabled={exporting || loading}
                title="تصدير CSV (متاح للأدمن فقط)"
              >
                {exporting ? <Loader2 className="h-4 w-4 ms-1.5 animate-spin" /> : <Download className="h-4 w-4 ms-1.5" />}
                CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => exportData("xlsx")}
                disabled={exporting || loading}
                title="تصدير Excel (متاح للأدمن فقط)"
              >
                {exporting ? <Loader2 className="h-4 w-4 ms-1.5 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 ms-1.5" />}
                Excel
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => loadPage(page, true)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 ms-1.5 animate-spin" /> : <RefreshCw className="h-4 w-4 ms-1.5" />}
            تحديث
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث (بريد/حدث/مورد)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger>
              <SelectValue placeholder="الخطورة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">كل المستويات</SelectItem>
              <SelectItem value="info">معلومة</SelectItem>
              <SelectItem value="warn">تحذير</SelectItem>
              <SelectItem value="critical">حرج</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="نوع الحدث..."
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          />
          <Input
            placeholder="نوع المورد..."
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
          />
          <Input
            placeholder="معرف المورد..."
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
          />
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="من"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="إلى"
          />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch(""); setSeverity("__all__"); setEventType("");
              setResourceType(""); setResourceId(""); setStartDate(""); setEndDate("");
            }}
          >
            مسح المعايير
          </Button>
          <Button size="sm" onClick={applyFilters} disabled={loading}>تطبيق</Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="text-muted-foreground">
          {loading && totalCount === null ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> جارٍ حساب الإجمالي...
            </span>
          ) : totalCount !== null ? (
            <>
              عرض <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> من إجمالي{" "}
              <strong>{totalCount.toLocaleString("ar-EG")}</strong> حدث
            </>
          ) : null}
        </div>
        {eventTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            {eventTypes.slice(0, 6).map((t) => (
              <Badge key={t} variant="outline" className="font-mono">{t}</Badge>
            ))}
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" />
            جارٍ التحميل...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">لا توجد أحداث مطابقة للمعايير.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-start px-3 py-3 font-semibold">التاريخ</th>
                  <th className="text-start px-3 py-3 font-semibold">المستخدم</th>
                  <th className="text-start px-3 py-3 font-semibold">الحدث</th>
                  <th className="text-start px-3 py-3 font-semibold">الخطورة</th>
                  <th className="text-start px-3 py-3 font-semibold">المورد</th>
                  <th className="text-start px-3 py-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelected(r)}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("ar-EG")}
                    </td>
                    <td className="px-3 py-2">{r.actor_email ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.event_type}</td>
                    <td className="px-3 py-2">
                      <Badge variant={SEV_VARIANT[r.severity] ?? "outline"}>
                        {r.severity === "critical" ? "حرج" : r.severity === "warn" ? "تحذير" : "معلومة"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.resource_type ? `${r.resource_type}${r.resource_id ? ` · ${r.resource_id.slice(0, 8)}…` : ""}` : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages !== null && totalPages > 0 && (
          <div className="p-3 border-t flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-muted-foreground">
              صفحة <strong>{page + 1}</strong> من <strong>{totalPages}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadPage(page - 1)}
                disabled={page === 0 || loading}
              >
                <ChevronRight className="h-4 w-4 ms-1" />
                السابق
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadPage(page + 1)}
                disabled={page + 1 >= totalPages || loading}
              >
                التالي
                <ChevronLeft className="h-4 w-4 me-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الحدث</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <DetailRow label="التاريخ" value={new Date(selected.created_at).toLocaleString("ar-EG")} />
              <DetailRow label="المستخدم" value={selected.actor_email ?? "—"} />
              <DetailRow label="نوع الحدث" value={<span className="font-mono text-xs">{selected.event_type}</span>} />
              <DetailRow
                label="الخطورة"
                value={
                  <Badge variant={SEV_VARIANT[selected.severity] ?? "outline"}>
                    {selected.severity === "critical" ? "حرج" : selected.severity === "warn" ? "تحذير" : "معلومة"}
                  </Badge>
                }
              />
              <DetailRow label="نوع المورد" value={selected.resource_type ?? "—"} />
              <DetailRow label="معرف المورد" value={<span className="font-mono text-xs break-all">{selected.resource_id ?? "—"}</span>} />
              <DetailRow label="IP" value={<span className="font-mono text-xs">{selected.ip ?? "—"}</span>} />
              <DetailRow label="User Agent" value={<span className="text-xs break-all">{selected.user_agent ?? "—"}</span>} />
              {selected.metadata && (
                <div>
                  <div className="font-semibold mb-1.5">Metadata</div>
                  <pre className="bg-muted/40 rounded p-3 text-xs overflow-x-auto">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              )}
              {selected.old_value !== null && selected.old_value !== undefined && (
                <div>
                  <div className="font-semibold mb-1.5">القيمة القديمة</div>
                  <pre className="bg-muted/40 rounded p-3 text-xs overflow-x-auto">
                    {JSON.stringify(selected.old_value, null, 2)}
                  </pre>
                </div>
              )}
              {selected.new_value !== null && selected.new_value !== undefined && (
                <div>
                  <div className="font-semibold mb-1.5">القيمة الجديدة</div>
                  <pre className="bg-muted/40 rounded p-3 text-xs overflow-x-auto">
                    {JSON.stringify(selected.new_value, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start border-b pb-2">
      <div className="w-32 shrink-0 text-muted-foreground">{label}</div>
      <div className="flex-1">{value}</div>
    </div>
  );
}
