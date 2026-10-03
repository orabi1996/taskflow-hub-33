/**
 * Executive PDF & Official Document Printing Engine
 * Generates enterprise-grade, high-fidelity printable reports and PDF documents with Arabic typography and corporate styling.
 */

export interface ReportMetadataItem {
  label: string;
  value: string;
}

export interface ReportKpiItem {
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}

export interface ReportTableSection {
  title?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

export interface ReportApprovalStamp {
  reviewerName?: string | null;
  reviewedAt?: string | null;
  statusText: string;
  isApproved: boolean;
  notes?: string | null;
}

export interface OfficialReportOptions {
  title: string;
  subtitle?: string;
  reportCode?: string;
  metadata?: ReportMetadataItem[];
  kpis?: ReportKpiItem[];
  sections: ReportTableSection[];
  approvalStamp?: ReportApprovalStamp;
  organizationName?: string;
}

export function printOfficialReport(opts: OfficialReportOptions) {
  const win = window.open("", "_blank", "width=1024,height=800");
  if (!win) {
    alert("يرجى السماح بالنوافذ المنبثقة لطباعة وتصدير التقرير بصيغة PDF");
    return;
  }

  const orgName = opts.organizationName || "منظومة CRM-X Enterprise";
  const reportCode = opts.reportCode || `REP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const printedDate = new Date().toLocaleString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const metadataHtml = opts.metadata && opts.metadata.length > 0
    ? `
      <div class="meta-grid">
        ${opts.metadata
          .map(
            (m) => `
          <div class="meta-item">
            <span class="meta-label">${m.label}:</span>
            <span class="meta-value">${m.value}</span>
          </div>
        `
          )
          .join("")}
      </div>
    `
    : "";

  const kpisHtml = opts.kpis && opts.kpis.length > 0
    ? `
      <div class="kpi-grid">
        ${opts.kpis
          .map(
            (k) => `
          <div class="kpi-card" style="${k.color ? `border-top: 3px solid ${k.color};` : ''}">
            <div class="kpi-label">${k.label}</div>
            <div class="kpi-value" style="${k.color ? `color: ${k.color};` : ''}">${k.value}</div>
            ${k.subtext ? `<div class="kpi-subtext">${k.subtext}</div>` : ""}
          </div>
        `
          )
          .join("")}
      </div>
    `
    : "";

  const sectionsHtml = opts.sections
    .map(
      (sec) => `
      <div class="section-container">
        ${sec.title ? `<h3 class="section-title">${sec.title}</h3>` : ""}
        <table class="report-table">
          <thead>
            <tr>
              ${sec.headers.map((h) => `<th>${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${sec.rows
              .map(
                (row, i) => `
              <tr class="${i % 2 === 0 ? "even" : "odd"}">
                ${row.map((cell) => `<td>${cell ?? "—"}</td>`).join("")}
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    )
    .join("");

  const stampHtml = opts.approvalStamp
    ? `
      <div class="approval-box ${opts.approvalStamp.isApproved ? "approved" : "pending"}">
        <div class="stamp-header">
          <span class="stamp-badge ${opts.approvalStamp.isApproved ? "badge-approved" : "badge-pending"}">
            ${opts.approvalStamp.statusText}
          </span>
          <span class="stamp-title">سجل الاعتماد والتوثيق الرسمي</span>
        </div>
        <div class="stamp-details">
          ${opts.approvalStamp.reviewerName ? `<div><strong>المعتمد:</strong> ${opts.approvalStamp.reviewerName}</div>` : ""}
          ${opts.approvalStamp.reviewedAt ? `<div><strong>تاريخ الاعتماد:</strong> ${opts.approvalStamp.reviewedAt}</div>` : ""}
          ${opts.approvalStamp.notes ? `<div class="stamp-notes"><strong>الملاحظات:</strong> ${opts.approvalStamp.notes}</div>` : ""}
        </div>
        <div class="stamp-seal">
          <div class="seal-inner">
            <span>معتمد إلكترونياً</span>
            <small>CRM-X QA</small>
          </div>
        </div>
      </div>
    `
    : "";

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8" />
      <title>${opts.title} — ${orgName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body {
          font-family: 'Tajawal', system-ui, -apple-system, sans-serif;
          margin: 0;
          padding: 24px 32px;
          background: #ffffff;
          color: #0f172a;
          font-size: 13px;
          line-height: 1.5;
        }

        .header-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #1e3a8a;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        .header-title-block h1 {
          margin: 0 0 4px 0;
          font-size: 20px;
          font-weight: 800;
          color: #1e3a8a;
        }
        .header-title-block p {
          margin: 0;
          font-size: 12px;
          color: #64748b;
        }
        .header-org-block {
          text-align: left;
          font-size: 11px;
          color: #475569;
        }
        .header-org-block strong {
          font-size: 13px;
          color: #0f172a;
          display: block;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 8px 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px 16px;
          margin-bottom: 20px;
        }
        .meta-item {
          display: flex;
          gap: 6px;
          font-size: 12px;
        }
        .meta-label {
          color: #64748b;
          font-weight: 500;
        }
        .meta-value {
          color: #0f172a;
          font-weight: 700;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }
        .kpi-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 14px;
          text-align: center;
        }
        .kpi-label {
          font-size: 11px;
          color: #64748b;
          margin-bottom: 2px;
        }
        .kpi-value {
          font-size: 18px;
          font-weight: 800;
          color: #1e3a8a;
        }
        .kpi-subtext {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 2px;
        }

        .section-container {
          margin-bottom: 24px;
        }
        .section-title {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 8px 0;
          padding-bottom: 4px;
          border-bottom: 1px solid #e2e8f0;
        }

        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .report-table th {
          background: #0F4C5C;
          color: #ffffff;
          padding: 8px 10px;
          text-align: right;
          font-weight: 700;
          border: 1px solid #0F4C5C;
        }
        .report-table td {
          padding: 8px 10px;
          border: 1px solid #e2e8f0;
          vertical-align: top;
        }
        .report-table tr.even {
          background: #ffffff;
        }
        .report-table tr.odd {
          background: #f8fafc;
        }

        .approval-box {
          position: relative;
          border-radius: 6px;
          padding: 16px 20px;
          margin-top: 30px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1px solid #e2e8f0;
        }
        .approval-box.approved {
          background: #f0fdf4;
          border-color: #86efac;
        }
        .approval-box.pending {
          background: #eff6ff;
          border-color: #93c5fd;
        }
        .stamp-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }
        .stamp-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
        }
        .badge-approved {
          background: #16a34a;
          color: #ffffff;
        }
        .badge-pending {
          background: #2563eb;
          color: #ffffff;
        }
        .stamp-title {
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
        }
        .stamp-details {
          font-size: 11px;
          color: #334155;
          line-height: 1.6;
        }
        .stamp-notes {
          margin-top: 4px;
          font-style: italic;
          color: #475569;
        }
        .stamp-seal {
          width: 80px;
          height: 80px;
          border: 2px dashed #16a34a;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #16a34a;
          font-size: 10px;
          font-weight: 700;
          transform: rotate(-12deg);
        }

        .footer-container {
          margin-top: 40px;
          padding-top: 12px;
          border-top: 1px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 10px;
          color: #94a3b8;
        }

        @media print {
          body { padding: 12px 20px; font-size: 12px; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="header-container">
        <div class="header-title-block">
          <h1>${opts.title}</h1>
          <p>${opts.subtitle || orgName}</p>
        </div>
        <div class="header-org-block">
          <div style="display:flex; align-items:center; gap:6px; justify-content:flex-end; margin-bottom:4px;">
            <svg width="24" height="24" viewBox="0 0 200 200" fill="none">
              <line x1="52" y1="46" x2="148" y2="154" stroke="#0F4C5C" stroke-width="40" stroke-linecap="round" />
              <line x1="52" y1="154" x2="148" y2="46" stroke="#00A6A6" stroke-width="40" stroke-linecap="round" />
            </svg>
            <strong style="font-size:16px; color:#0F4C5C; letter-spacing:-0.5px;">CRM-X</strong>
          </div>
          <div style="font-weight:600; color:#334155;">${orgName}</div>
          <div>الرقم المرجعي: ${reportCode}</div>
          <div>تاريخ الطباعة: ${printedDate}</div>
        </div>
      </div>

      ${metadataHtml}
      ${kpisHtml}
      ${sectionsHtml}
      ${stampHtml}

      <div class="footer-container">
        <span>وثيقة رسمية صادرة إلكترونياً من منصة CRM-X Enterprise — People · Pipelines · Possibilities</span>
        <span>صفحة 1 من 1</span>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  win.document.open();
  win.document.write(htmlContent);
  win.document.close();
}
