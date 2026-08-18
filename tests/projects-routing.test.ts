/**
 * اختبار توجيه + Skeleton/Error UI لصفحة تفاصيل المشروع.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect } from "vitest";

const tree = readFileSync(resolve(process.cwd(), "src/routeTree.gen.ts"), "utf-8");
const detail = readFileSync(
  resolve(process.cwd(), "src/routes/_app.projects.$projectId.tsx"),
  "utf-8",
);
const dashboard = readFileSync(
  resolve(process.cwd(), "src/routes/_app.projects.$projectId.dashboard.tsx"),
  "utf-8",
);
const list = readFileSync(resolve(process.cwd(), "src/routes/_app.projects.index.tsx"), "utf-8");

function assert(cond: unknown, msg: string) {
  expect(cond, msg).toBeTruthy();
}

test("projects routing & UI invariants", () => {
// التوجيه
assert(tree.includes("_app.projects.$projectId"), "/projects/$projectId مسجّل");
assert(tree.includes("_app.projects.index"), "/projects/ index مسجّل (وليس مسارًا أبًا)");
assert(
  tree.includes("AppProjectsProjectIdDashboard") ||
    tree.includes("_app.projects.$projectId.dashboard"),
  "/projects/$projectId/dashboard مسجّل",
);

// محتوى صفحة التفاصيل
assert(detail.includes('data-testid="project-detail-page"'), "صفحة التفاصيل تحمل علامتها");
assert(detail.includes('data-testid="project-skeleton"'), "صفحة التفاصيل تعرض Skeleton أثناء التحميل");
assert(detail.includes('data-testid="project-error"'), "صفحة التفاصيل تعرض Error UI عند الفشل");
assert(detail.includes("ProjectDetailSkeleton"), "مكوّن Skeleton مُعرَّف داخل صفحة التفاصيل");
assert(
  /if\s*\(\s*loading\s*\)\s*return\s*<ProjectDetailSkeleton/.test(detail),
  "Skeleton يظهر عند loading=true",
);
assert(
  /error\s*\|\|\s*!project/.test(detail),
  "Error UI يظهر عند وجود خطأ أو غياب البيانات",
);
assert(
  /setProject\(null\)[\s\S]{0,200}setLoading\(true\)/.test(detail),
  "إعادة ضبط الحالة عند تغيّر projectId (لا يبقى المحتوى السابق)",
);
assert(detail.includes("forceMount"), "تبويبات التفاصيل تستخدم forceMount للحفاظ على الحالة");
assert(
  detail.includes("data-[state=active]:animate-fade-in"),
  "انتقالات ناعمة بين تبويبات التفاصيل",
);

// لوحة المشروع
assert(dashboard.includes('data-testid="project-skeleton"'), "لوحة المشروع تعرض Skeleton");
assert(dashboard.includes('data-testid="project-error"'), "لوحة المشروع تعرض Error UI");
assert(/onClick=\{\(\)\s*=>\s*load\("refresh"\)\}/.test(dashboard), "زر تحديث متصل بـ load(refresh)");
assert(dashboard.includes("RefreshCw"), "أيقونة RefreshCw للتحديث");

// قائمة المشاريع
assert(list.includes('data-testid="projects-list-page"'), "صفحة القائمة تحمل علامتها");
assert(list.includes("filteredProjects"), "قائمة المشاريع تستخدم تصفية");
assert(list.includes("setSearchTerm"), "حقل بحث متاح");
assert(list.includes("healthFilter") && list.includes("statusFilter"), "فلاتر الحالة الصحية والنشاط");

});
