# خطة تطوير المشاريع

## 1. قاعدة البيانات (Migration واحد شامل)

### جداول جديدة:
- **`project_milestones`**: id, project_id, title, description, due_date, status (pending/in_progress/completed), sort_order, completion_percentage (محسوبة من المهام المرتبطة), created_by, timestamps
- **`project_members`**: id, project_id, user_id, role (manager/executor/observer), added_by, added_at — UNIQUE(project_id, user_id)
- **`project_comments`**: id, project_id, user_id, body, parent_comment_id (للردود), mentioned_users (uuid[]), timestamps
- **`tasks.milestone_id`**: عمود جديد لربط المهمة بمرحلة (nullable)

### Functions:
- `is_project_member(_user_id, _project_id, _role?)` — للتحقق من العضوية
- `can_view_project(_user_id, _project_id)` — يدمج owner + member + manager+
- تحديث `can_manage_project` ليشمل role='manager' من project_members
- `get_milestone_progress(_milestone_id)` — يحسب نسبة الإنجاز

### RLS:
- جميع الجداول الجديدة مع RLS صارم
- التعليقات: عرض لمن يقدر يشوف المشروع، إنشاء للأعضاء فقط، تعديل/حذف للمؤلف فقط
- المراحل: قراءة لمن يشوف المشروع، إدارة للمدير
- الأعضاء: إدارة للمدير + admin/GM

### Realtime:
- تفعيل publication لـ project_comments, project_members, project_history, notifications

## 2. Server Functions

`src/server/projects-extended.functions.ts`:
- `listMilestones`, `createMilestone`, `updateMilestone`, `deleteMilestone`, `reorderMilestones`
- `listProjectMembers`, `addProjectMember`, `updateMemberRole`, `removeProjectMember`
- `listProjectComments`, `createComment`, `updateComment`, `deleteComment`
- `getProjectActivityFeed` — يدمج project_history + comments + milestone events
- `getProjectsDashboard` — إحصائيات: عدد المشاريع/الحالة، توزيع health، مشاريع متأخرة، نسب إنجاز، top performers

## 3. UI Components

### تطوير شاشة المشاريع `_app.projects.tsx`:
- تبديل بين Views: Cards (الحالي) | Kanban (حسب health_status) | Timeline (Gantt مبسط على contract_start/end)
- زر "Dashboard" يفتح صفحة جديدة

### صفحات جديدة:
- `_app.projects.$projectId.tsx` — صفحة تفاصيل المشروع مع تابات:
  - نظرة عامة (مع نسبة الإنجاز الكلية)
  - المراحل (Milestones) — قائمة قابلة للسحب وإعادة الترتيب
  - الفريق (Members) — جدول مع dropdown لتغيير الدور
  - المهام (مفلترة على المشروع)
  - التعليقات (thread مع mentions @user)
  - النشاط (Activity feed موحّد timeline)
  - الأنظمة المربوطة (الموجود)
- `_app.projects.dashboard.tsx` — لوحة تحليلات شاملة بـ recharts:
  - KPI cards (إجمالي/نشط/متأخر/مكتمل)
  - Pie chart توزيع health
  - Bar chart مشاريع لكل عضو
  - خط زمني للمراحل القادمة
  - أكثر المشاريع نشاطاً

### Components:
- `ProjectKanbanBoard.tsx` — أعمدة حسب health
- `ProjectTimelineView.tsx` — عرض Gantt مبسط
- `ProjectMilestonesManager.tsx` — CRUD + تقدم
- `ProjectMembersManager.tsx` — إدارة الفريق
- `ProjectCommentsThread.tsx` — مع @mentions و real-time subscription
- `ProjectActivityFeed.tsx` — timeline موحّد
- `ProjectDashboard.tsx` — charts + KPIs

## 4. Real-time

- Subscribe على `project_comments` و `notifications` داخل صفحة المشروع
- إنشاء notification تلقائياً عند:
  - mention في تعليق
  - إضافة عضو جديد
  - milestone status change
  - تعليق جديد على مشروع المستخدم عضو فيه

## 5. التكامل مع TaskForm
- إضافة select للـ milestone عند اختيار مشروع
- التحقق من العضوية قبل السماح بإنشاء مهمة على مشروع

## ملاحظات تقنية
- استخدام `requireSupabaseAuth` لكل server functions
- جميع التواريخ بـ timezone UTC
- mentions تُخزن كـ uuid[] وتُرسل notifications عبر trigger
- الترتيب RTL (Arabic)
- semantic tokens فقط من styles.css

## نطاق العمل
عمل ضخم سيتم على مرحلتين:
1. **هذه المرحلة**: DB migration + Server functions + Project Detail page (Overview, Milestones, Members, Comments, Activity) + Realtime
2. **المرحلة التالية**: Kanban view + Timeline view + Dashboard analytics

نبدأ بالمرحلة الأولى لأنها الأساس.
