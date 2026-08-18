import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export type ExportRow = Record<string, string | number | null | undefined>;

export function exportToExcel(rows: ExportRow[], fileName: string, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `${fileName}.xlsx`);
}

export function exportToCSV(rows: ExportRow[], fileName: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers
        .map((h) => {
          const v = r[h] ?? "";
          const s = String(v).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(",")
    ),
  ].join("\n");
  // BOM for Excel UTF-8 (Arabic support)
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, `${fileName}.csv`);
}

export function printSection(elementId: string, title: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const win = window.open("", "_blank", "width=1024,height=768");
  if (!win) return;
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => n.outerHTML)
    .join("\n");
  win.document.write(`
    <!DOCTYPE html><html dir="rtl" lang="ar"><head>
    <title>${title}</title>${styles}
    <style>body{padding:24px;font-family:system-ui;background:#fff;color:#111}@media print{.no-print{display:none!important}}</style>
    </head><body>${el.outerHTML}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script></body></html>
  `);
  win.document.close();
}
