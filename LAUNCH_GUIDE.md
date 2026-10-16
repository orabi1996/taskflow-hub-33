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

### الخطوة 1: ضبط وتوليد متغيرات البيئة تلقائياً (`.env`)
يمكنك تشغيل الأداة الآلية لتوليد ملف `.env` بمفاتيح تشفير عشوائية فائقة الأمان وفحص الجاهزية بضغطة واحدة:

```bash
npm run setup:env
```

أو انسخ ملف `.env.example` إلى `.env` واضبط القيم الحقيقية لبيئة الإنتاج:

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
تم تجهيز أداة تجميع آلية لإنشاء ملف SQL موحد وشامل لكافة الجداول والسياسات:

```bash
# توليد ملف SQL الموحد
npm run export:schema
```

ينتج الملف الموحد: `supabase/full_production_schema.sql`. يمكنك نسخه بالكامل ولصقه داخل **Supabase SQL Editor** وتشغيله بضغطة زر واحدة لتجهيز كافة الجداول والمشرف والأمان.

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
   * يمكنك تجربة إرسال تنبيه SLA تجريبي فوري عبر الأداة:
     ```bash
     node scripts/test-webhook-ping.mjs <YOUR_SLACK_OR_DISCORD_WEBHOOK_URL>
     ```

---

### الخطوة 7: نماذج إدخال واستيراد البيانات التأسيسية (Onboarding Data Templates)
تم تجهيز نماذج بيانات واقعية جاهزة للتعبئة والاستيراد داخل مجلد `docs/templates/`:
* `docs/templates/clients_import_template.csv`: بيانات العملاء، ومستويات الـ SLA، وأرقام وقيم العقود، وتواريخ الانتهاء، وأرقام هواتف الواتساب.
* `docs/templates/employees_import_template.csv`: هيكل الموظفين، والمسميات الوظيفية، والأقسام، والأدوار (Admin / Manager / Support).
* **ميزة محادثة WhatsApp المباشرة**: تم تفعيل زر المحادثة الفورية في كروت العملاء للتواصل بنقرة واحدة عبر الواتساب.

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
