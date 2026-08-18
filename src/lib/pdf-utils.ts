import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportTableToPDF(opts: {
  title: string;
  fileName: string;
  headers: string[];
  rows: (string | number)[][];
  orientation?: "portrait" | "landscape";
}) {
  const doc = new jsPDF({ orientation: opts.orientation ?? "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(opts.title, 40, 40);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString("en-GB"), 40, 56);
  autoTable(doc, {
    head: [opts.headers],
    body: opts.rows.map((r) => r.map((c) => (c ?? "").toString())),
    startY: 70,
    styles: { fontSize: 9, cellPadding: 4, halign: "right" },
    headStyles: { fillColor: [59, 130, 246], halign: "right" },
    margin: { left: 30, right: 30 },
  });
  doc.save(`${opts.fileName}.pdf`);
}
