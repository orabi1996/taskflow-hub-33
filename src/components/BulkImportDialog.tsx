import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { logError } from "@/lib/log-error";

export interface BulkImportColumn {
  key: string;
  header: string;
  example?: string | number;
  required?: boolean;
  note?: string;
}

interface BulkImportResult {
  row: number;
  status: "created" | "exists" | "error";
  message?: string;
  email?: string;
  name?: string;
}

interface Props {
  title: string;
  description: string;
  templateFileName: string;
  columns: BulkImportColumn[];
  /** Server function that accepts { rows } and returns { results, total } */
  onImport: (rows: Record<string, unknown>[]) => Promise<{ results: BulkImportResult[]; total: number }>;
  onDone?: () => void;
  triggerLabel?: string;
}

export function BulkImportDialog({
  title,
  description,
  templateFileName,
  columns,
  onImport,
  onDone,
  triggerLabel = "استيراد من Excel",
}: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<BulkImportResult[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = columns.map((c) => c.header);
    const example = columns.map((c) => c.example ?? "");
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    // Add a notes sheet
    const notesData = [
      ["العمود", "إجباري؟", "ملاحظات"],
      ...columns.map((c) => [c.header, c.required ? "نعم" : "لا", c.note ?? ""]),
    ];
    const wsNotes = XLSX.utils.aoa_to_sheet(notesData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "البيانات");
    XLSX.utils.book_append_sheet(wb, wsNotes, "تعليمات");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `${templateFileName}.xlsx`);
  };

  const onFile = async (file: File) => {
    setFileName(file.name);
    setResults(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      // Map Arabic header → key
      const headerToKey = new Map(columns.map((c) => [c.header, c.key]));
      const mapped = json.map((r) => {
        const out: Record<string, unknown> = {};
        for (const [header, val] of Object.entries(r)) {
          const k = headerToKey.get(header.toString().trim());
          if (!k) continue;
          if (val === "" || val === null || val === undefined) continue;
          // Excel date serial → ISO string
          if (val instanceof Date) {
            out[k] = val.toISOString().slice(0, 10);
          } else {
            out[k] = typeof val === "string" ? val.trim() : val;
          }
        }
        return out;
      }).filter((r) => Object.keys(r).length > 0);
      setRows(mapped);
      if (mapped.length === 0) {
        toast.error("الملف فارغ أو الأعمدة غير مطابقة للقالب");
      } else {
        toast.success(`تم قراءة ${mapped.length} صفًا`);
      }
    } catch (e) {
      toast.error(logError(e, { scope: "bulk-import-parse", fallback: "فشل قراءة الملف" }));
    }
  };

  const submit = async () => {
    if (rows.length === 0) {
      toast.error("لا توجد صفوف للاستيراد");
      return;
    }
    setSubmitting(true);
    try {
      const res = await onImport(rows);
      setResults(res.results);
      const ok = res.results.filter((r) => r.status === "created").length;
      const skipped = res.results.filter((r) => r.status === "exists").length;
      const failed = res.results.filter((r) => r.status === "error").length;
      toast.success(`تم: ${ok} | موجود: ${skipped} | فشل: ${failed}`);
      onDone?.();
    } catch (e) {
      toast.error(logError(e, { scope: "bulk-import", fallback: "فشل الاستيراد" }));
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setRows([]);
    setFileName("");
    setResults(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 ms-1.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <FileSpreadsheet className="h-4 w-4" />
              الخطوة 1: حمّل القالب
            </div>
            <p className="text-sm text-muted-foreground">
              نزّل ملف Excel جاهز فيه أعمدة بأسماء عربية وصف نموذجي.
            </p>
            <Button variant="secondary" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 ms-1.5" />
              تنزيل قالب Excel
            </Button>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <Upload className="h-4 w-4" />
              الخطوة 2: ارفع الملف بعد تعبئته
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
              className="block w-full text-sm file:me-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
            />
            {fileName && (
              <p className="text-xs text-muted-foreground">
                الملف: <span className="font-medium">{fileName}</span> — {rows.length} صف
              </p>
            )}
          </div>

          {results && (
            <div className="rounded-lg border max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="text-start px-3 py-2">صف</th>
                    <th className="text-start px-3 py-2">الحالة</th>
                    <th className="text-start px-3 py-2">تفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5">{r.row}</td>
                      <td className="px-3 py-1.5">
                        {r.status === "created" && <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> تم</span>}
                        {r.status === "exists" && <span className="text-amber-600 inline-flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> موجود</span>}
                        {r.status === "error" && <span className="text-destructive inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5" /> فشل</span>}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.message ?? r.email ?? r.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          {results ? (
            <Button onClick={() => setOpen(false)}>إغلاق</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={reset} disabled={submitting}>إعادة</Button>
              <Button onClick={submit} disabled={submitting || rows.length === 0}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin ms-1.5" />}
                استيراد {rows.length > 0 ? `(${rows.length})` : ""}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
