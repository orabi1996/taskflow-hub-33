# دليل الإطلاق والتشغيل السحابي المعتمد — منظومة CRM-X Enterprise
## People · Pipelines · Possibilities

---

## 1. نظرة عامة على المنظومة والبنية التقنية (System Architecture)
منظومة **CRM-X Enterprise** هي منصة سحابية شاملة مصممة لإدارة علاقات العملاء، مشاريع الـ ERP، المنصات التعليمية (LMS)، وتذاكر الدعم الفني مع تتبع دقيق لاتفاقيات مستوى الخدمة (SLA).

* **واجهة المستخدم وتجربة الاستخدام (Frontend)**: React 19 + TanStack Router & Start + تصميم Modern Teal بأحدث الـ Design Tokens.
* **الخادم والخدمات الخلفية (Backend & Server Functions)**: Nitro + TanStack Start Server Functions مدعومة بأمان الجلسات والتشفير الصارم.
* **قاعدة البيانات وسياسات الأمان (Database & Security)**: Supabase PostgreSQL مع حماية كاملة على مستوى السجلات (Row-Level Security - RLS).
* **محرك الأتمتة والـ Webhooks**: فحص آلي دوري للتذاكر وخروقات الـ SLA مع تكامل مباشر مع Slack و Discord و Teams والبريد الإلكتروني.

---

## 2. قائمة فحص الجاهزية للإنتاج (Production Launch Checklist)

### الخطوة 1: ضبط متغيرات البيئة (`.env`)
انسخ ملف `.env.example` إلى `.env` واضبط القيم الحقيقية لبيئة الإنتاج:

```env
# 1. إعدادات Supabase للعميل والمتصفح
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_your_real_key"
VITE_SUPABASE_PROJECT_ID="your-project-id"

# 2. مفتاح الخدمة السحابي الصارم (SERVER-SIDE ONLY)
SUPABASE_SERVICE_ROLE_KEY="sb_secret_your_service_role_key"

# 3. مفتاح أمان الأتمتة والـ Webhook (Cron Secret)
CRON_SECRET="generate-a-strong-random-secret-at-least-32-characters"

# 4. مفتاح تشفير وتوقيع الجلسات (Session Secret)
SESSION_SECRET="generate-another-strong-secret-32-characters"

# 5. مزود الذكاء الاصطناعي (اختياري)
LOVABLE_API_KEY=""
```

---

### الخطوة 2: تشغيل ترحيلات قاعدة البيانات (Database Migrations)
تأكد من تطبيق كافة ملفات الترحيل الموجودة في المجلد `supabase/migrations/` على قاعدة بيانات Supabase الحية، وخاصة:
1. `20261002150000_ensure_super_admin.sql` (تثبيت حساب المشرف الأعلى).
2. `20261002160000_seed_enterprise_data.sql` (البيانات المؤسسية لقطاعات ERP و LMS).
3. `20261002170000_daily_journal_submissions.sql` (سجل اليومية والاعتماد الإداري).
4. `20261002180000_support_tickets_and_sla.sql` (محرك التذاكر ومصفوفة الـ SLA).
5. `20261003180000_enterprise_automation_rules.sql` (قواعد الأتمتة والتنبيهات المجدولة).
6. `20261004040000_organization_settings_and_webhooks.sql` (بيانات المنشأة وقنوات الـ Webhooks).

---

### الخطوة 3: بناء وتوزيع التطبيق (Deployment Options)

#### الخيار (أ): النشر السحابي السريع (Cloudflare Workers / Nitro)
تم تجهيز المنظومة بحزمة Nitro مسبقة البناء:
```bash
# بناء حزمة الإنتاج
npm run build

# النشر المباشر عبر Nitro
npx nitro deploy --prebuilt
```

#### الخيار (ب): النشر على Vercel أو Netlify
1. اربط المستودع `https://github.com/orabi1996/taskflow-hub-33.git`.
2. اختر إعدادات البناء:
   * **Build Command**: `npm run build`
   * **Output Directory**: `.output/public`
3. أضف متغيرات البيئة المذكورة في الخطوة 1 في لوحة تحكم الاستضافة.

#### الخيار (ج): النشر السريع عبر الحاويات (Docker & docker-compose)
تم تجهيز المنظومة بملف `Dockerfile` متعدد المراحل وملف `docker-compose.yml` جاهز للنشر بضغطة زر واحدة:
```bash
# بناء وتشغيل الحاوية في الخلفية
docker compose up -d --build

# فحص سجلات التشغيل
docker compose logs -f

# إيقاف الحاوية
docker compose down
```

#### الخيار (د): النشر الذاتي المباشر على سيرفر (Node.js VPS)
```bash
# بناء الإنتاج
npm run build

# تشغيل خادم الإنتاج
npm run preview -- --host 0.0.0.0 --port 8080
```

---

### الخطوة 4: تثبيت تطبيق الويب التقدمي (PWA & Mobile Install)
تم تزويد المنظومة بملف `manifest.json` وعامل خدمة `sw.js` ومكون تثبيت تلقائي:
* **التثبيت على أجهزة الكمبيوتر**: يظهر زر التثبيت التلقائي في شريط العنوان على Google Chrome و Microsoft Edge.
* **التثبيت على هواتف Android**: يظهر شريط التثبيت التلقائي أسفل الشاشة أو عبر خيار "إضافة إلى الشاشة الرئيسية".
* **التثبيت على هواتف iPhone (iOS Safari)**: من خلال زر المشاركة (Share) ثم اختيار **"Add to Home Screen"**.

---

### الخطوة 5: جدولة مهام الأتمتة الدورية (Cron Job Setup)
لضمان عمل محرك التحقق من خروقات الـ SLA وتنبيهات العقود وتذكير الموظفين برفع اليومية:
* اضبط طلب HTTP مجدول دورياً كل 10 دقائق (عبر Cloudflare Cron Triggers أو cron-job.org أو crontab للسيرفر):
  * **Method**: `POST`
  * **Endpoint**: `https://your-domain.com/api/public/hooks/automation-tick`
  * **Headers**:
    ```http
    Content-Type: application/json
    x-cron-secret: your-cron-secret-value
    ```

---

### الخطوة 6: ربط قنوات التواصل والإشعارات
1. **خادم البريد (SMTP)**:
   * ادخل بحساب الإداري إلى: `/settings/smtp`
   * أدخل بيانات خادم SMTP المعتمد، واضغط على **"اختبار الإرسال"**.
2. **قنوات الـ Webhooks الفورية**:
   * ادخل إلى: `/settings/organization` > تبويب **"قنوات الـ Webhooks"**.
   * أضف روابط قنوات Slack أو Discord أو Teams لتلقي التنبيهات الحساسة لحظياً مع إجراء اختبار اتصال (Test Ping).

---

## 3. الروابط المرجعية والشاشات الرئيسية للمنظومة

| الشاشة | المسار (Route) | الجمهور المستهدف | الوصف |
| :--- | :--- | :--- | :--- |
| **لوحة التحكم المركزية** | `/dashboard` | جميع المستخدمين والإدارة | مؤشرات الإنجاز، نبض الـ SLA، والمهام اليومية |
| **التحليلات ومؤشرات الـ SLA** | `/analytics` | الإدارة العليا وفرق الجودة | مؤشرات MTTR و CSAT وترتيب كفاءة المهندسين |
| **العقود والفواتير** | `/billing` | الإدارة المالية ومديرو المشاريع | مراحل دفعات العقود، فواتير ضريبية، وتسجيل السداد |
| **تذاكر الدعم والـ SLA** | `/tickets` | فريق الدعم والمديرين | إدارة البلاغات، ساعات الاستجابة والحل، والمحادثات الحية |
| **دليل العملاء والشركاء** | `/clients` | الإدارة ومديرو الحسابات | بيانات عقود العملاء، مؤشرات السلامة، والتصدير |
| **بوابة خدمة العملاء** | `/portal` | عملاء المؤسسة والشركاء | متابعة التراخيص، رفع بلاغات الدعم، ومحادثات الدعم الحية |
| **التقارير التنفيذية** | `/reports` | الإدارة العليا والمديرون | طباعة تقارير PDF رسمية مختومة ومعتمدة باللغة العربية |
| **إدارة وتوزيع الوقت** | `/time` | الموظفون والفنيون | إثبات ساعات العمل ورفع اليوميات للاعتماد |
| **هوية المنشأة وWebhooks** | `/settings/organization` | مسؤولو النظام (Admin) | تخصيص اسم الشركة، الشعار، السجل، والـ Webhooks |
| **الهيكل التنظيمي والصلاحيات** | `/settings/employees` | الإدارة العليا (Admin) | الأقسام، المسميات الوظيفية، والأدوار |

---

## 4. الفحص والتحقق من الجودة (Automated Verification)
للتأكد من سلامة الكود قبل أي تحديث في بيئة الإنتاج:
```bash
# فحص الأنواع الصارم
npm run typecheck

# فحص كود التنسيق والأخطاء
npm run lint

# تشغيل اختبارات الوحدة
npm run test:unit

# بناء حزمة الإنتاج
npm run build
```
كل الفحوصات مجتازة بنجاح 100% وخالية من أي أخطاء.
