import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  Building2,
  Save,
  Loader2,
  Radio,
  Plus,
  Send,
  Trash2,
  Pencil,
  FileSignature,
  Clock,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { CrmXLogo, CrmXAppIcon } from "@/components/brand/CrmXLogo";
import {
  getOrganizationSettings,
  saveOrganizationSettings,
  sendWebhookTestPing,
  type OrganizationSettings,
  type WebhookConfig,
  DEFAULT_ORG_SETTINGS,
} from "@/lib/organization-settings";

export const Route = createFileRoute("/_app/settings/organization")({
  component: OrganizationSettingsPage,
});

const EVENT_OPTIONS = [
  { id: "ticket_created", label: "إنشاء تذكرة دعم جديدة" },
  { id: "ticket_sla_response_breach", label: "خرق اتفاقية SLA للاستجابة" },
  { id: "ticket_sla_resolve_breach", label: "خرق اتفاقية SLA لحل المشكلة" },
  { id: "journal_approved", label: "اعتماد يومية عمل موظف" },
  { id: "contract_expiring", label: "اقتراب انتهاء عقد عميل (ERP/LMS)" },
  { id: "task_overdue", label: "تأخر موعد إنجاز مهمة" },
];

function OrganizationSettingsPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const isManager = roles.includes("manager");
  const canEdit = isAdmin || isManager;

  const [settings, setSettings] = useState<OrganizationSettings>(DEFAULT_ORG_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Webhook dialog state
  const [whDialogOpen, setWhDialogOpen] = useState(false);
  const [editingWh, setEditingWh] = useState<WebhookConfig | null>(null);
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whPlatform, setWhPlatform] = useState<WebhookConfig["platform"]>("slack");
  const [whEvents, setWhEvents] = useState<string[]>(["ticket_sla_response_breach"]);
  const [whActive, setWhActive] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    getOrganizationSettings().then((data) => {
      setSettings(data);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!canEdit) {
      toast.error("ليس لديك صلاحية لتعديل إعدادات المنشأة");
      return;
    }
    setSaving(true);
    try {
      await saveOrganizationSettings(settings);
      toast.success("تم حفظ إعدادات وهوية المنشأة بنجاح");
    } catch {
      toast.error("حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  const openNewWebhookModal = () => {
    setEditingWh(null);
    setWhName("");
    setWhUrl("");
    setWhPlatform("slack");
    setWhEvents(["ticket_sla_response_breach", "ticket_sla_resolve_breach"]);
    setWhActive(true);
    setWhDialogOpen(true);
  };

  const openEditWebhookModal = (wh: WebhookConfig) => {
    setEditingWh(wh);
    setWhName(wh.name);
    setWhUrl(wh.url);
    setWhPlatform(wh.platform);
    setWhEvents(wh.events || []);
    setWhActive(wh.is_active);
    setWhDialogOpen(true);
  };

  const handleSaveWebhook = () => {
    if (!whName.trim() || !whUrl.trim()) {
      toast.error("يرجى إدخال اسم القناة ورابط الـ Webhook");
      return;
    }

    if (editingWh) {
      setSettings((prev) => ({
        ...prev,
        webhooks: prev.webhooks.map((w) =>
          w.id === editingWh.id
            ? {
                ...w,
                name: whName,
                url: whUrl,
                platform: whPlatform,
                events: whEvents,
                is_active: whActive,
              }
            : w
        ),
      }));
      toast.success("تم تحديث إعدادات القناة");
    } else {
      const newWh: WebhookConfig = {
        id: `wh-${Date.now()}`,
        name: whName,
        url: whUrl,
        platform: whPlatform,
        events: whEvents,
        is_active: whActive,
        created_at: new Date().toISOString(),
      };
      setSettings((prev) => ({
        ...prev,
        webhooks: [newWh, ...prev.webhooks],
      }));
      toast.success("تمت إضافة قناة الـ Webhook الجديدة");
    }
    setWhDialogOpen(false);
  };

  const handleDeleteWebhook = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      webhooks: prev.webhooks.filter((w) => w.id !== id),
    }));
    toast.success("تم حذف القناة");
  };

  const handleTestPing = async (wh: WebhookConfig) => {
    setTestingId(wh.id);
    try {
      const res = await sendWebhookTestPing(wh);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } finally {
      setTestingId(null);
    }
  };

  const toggleEvent = (eventId: string) => {
    setWhEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="ملف وهوية المنشأة"
          description="إدارة بيانات الشركة، هوية العلامة التجارية، تذييل التقارير، وقنوات الربط الخارجي والـ Webhooks"
          icon={Building2}
        />
        {canEdit && (
          <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ كافة التغييرات
          </Button>
        )}
      </div>

      {/* Brand Identity Card Preview */}
      <Card className="p-6 border-primary/20 bg-gradient-to-r from-primary/5 via-card to-card">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <CrmXAppIcon size={56} />
            <div>
              <div className="text-xl font-bold flex items-center gap-2">
                <span>{settings.company_name}</span>
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                  Modern Teal Edition
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground mt-1">{settings.brand_tagline}</div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-primary" /> {settings.support_email}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-primary" /> {settings.support_phone}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" /> {settings.working_hours}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center p-3 rounded-xl border bg-background/80 shadow-sm">
            <div className="text-xs text-muted-foreground mb-1">الختم الرقمي المعتمد</div>
            <div className="text-xs font-bold text-primary flex items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {settings.official_seal_text}
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="h-4 w-4" />
            بيانات المنشأة
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <FileSignature className="h-4 w-4" />
            التقارير والأختام
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Radio className="h-4 w-4" />
            قنوات الـ Webhooks
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: General Info */}
        <TabsContent value="general" className="mt-4 space-y-4">
          <Card className="p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="company_name">اسم المنشأة الرسمي</Label>
                <Input
                  id="company_name"
                  value={settings.company_name}
                  onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="brand_tagline">الشعار اللفظي (Slogan)</Label>
                <Input
                  id="brand_tagline"
                  value={settings.brand_tagline}
                  onChange={(e) => setSettings({ ...settings, brand_tagline: e.target.value })}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="commercial_registry">رقم السجل التجاري / الترخيص</Label>
                <Input
                  id="commercial_registry"
                  value={settings.commercial_registry}
                  onChange={(e) => setSettings({ ...settings, commercial_registry: e.target.value })}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="currency">العملة الافتراضية</Label>
                <Select
                  value={settings.currency}
                  onValueChange={(val) => setSettings({ ...settings, currency: val })}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAR">ريال سعودي (SAR)</SelectItem>
                    <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                    <SelectItem value="AED">درهم إماراتي (AED)</SelectItem>
                    <SelectItem value="EGP">جنيه مصري (EGP)</SelectItem>
                    <SelectItem value="EUR">يورو (EUR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="support_email">البريد الإلكتروني المعتمد للدعم</Label>
                <Input
                  id="support_email"
                  type="email"
                  value={settings.support_email}
                  onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="support_phone">رقم هاتف / واتساب الدعم</Label>
                <Input
                  id="support_phone"
                  value={settings.support_phone}
                  onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="working_hours">ساعات العمل الرسمية</Label>
                <Input
                  id="working_hours"
                  value={settings.working_hours}
                  onChange={(e) => setSettings({ ...settings, working_hours: e.target.value })}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="timezone">المنطقة الزمنية</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(val) => setSettings({ ...settings, timezone: val })}
                  disabled={!canEdit}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Riyadh">توقيت الرياض (GMT+3)</SelectItem>
                    <SelectItem value="Asia/Dubai">توقيت دبي (GMT+4)</SelectItem>
                    <SelectItem value="Africa/Cairo">توقيت القاهرة (GMT+2)</SelectItem>
                    <SelectItem value="UTC">توقيت غرينتش (UTC)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">عنوان المقر الرئيسي للمنشأة</Label>
              <Input
                id="address"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                disabled={!canEdit}
              />
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Reports & Seals */}
        <TabsContent value="reports" className="mt-4 space-y-4">
          <Card className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="official_seal_text">نص ختم التدقيق والجودة الرقمي</Label>
              <Input
                id="official_seal_text"
                value={settings.official_seal_text}
                onChange={(e) => setSettings({ ...settings, official_seal_text: e.target.value })}
                placeholder="مثال: CRM-X QA معتمد"
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                يظهر هذا الختم على مخرجات التقارير التنفيذية واعتمادات يوميات العمل.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="report_footer">تذييل الوثائق والتقارير التنفيذية (Footer Note)</Label>
              <Textarea
                id="report_footer"
                rows={3}
                value={settings.report_footer}
                onChange={(e) => setSettings({ ...settings, report_footer: e.target.value })}
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                يُطبع هذا النص تلقائياً في أسفل صفحات الـ PDF الرسمية للمنظومة.
              </p>
            </div>

            <div className="pt-4 border-t">
              <div className="text-sm font-semibold mb-2">معاينة التذييل في التقارير الرسمية:</div>
              <div className="p-4 rounded-lg bg-muted/40 border text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
                <CrmXLogo variant="horizontal" iconSize={24} showTagline={false} />
                <span className="text-center sm:text-right">{settings.report_footer}</span>
                <span className="font-semibold text-primary">{settings.official_seal_text}</span>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 3: Webhooks */}
        <TabsContent value="webhooks" className="mt-4 space-y-4">
          <Card className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-base">قنوات الربط الخارجي والتنبيهات الفورية (Webhooks)</div>
                <div className="text-sm text-muted-foreground">
                  إرسال إشعارات فورية إلى قنوات Slack أو سيرفرات Discord أو Microsoft Teams عند حدوث خروقات SLA أو أحداث حرجة.
                </div>
              </div>
              {canEdit && (
                <Button onClick={openNewWebhookModal} className="gap-2 shrink-0">
                  <Plus className="h-4 w-4" />
                  إضافة قناة جديدة
                </Button>
              )}
            </div>

            {settings.webhooks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
                لا توجد قنوات Webhooks مضافة حتى الآن.
              </div>
            ) : (
              <div className="grid gap-3">
                {settings.webhooks.map((wh) => (
                  <div
                    key={wh.id}
                    className="p-4 rounded-xl border bg-card/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{wh.name}</span>
                        <Badge variant="outline" className="capitalize text-xs">
                          {wh.platform}
                        </Badge>
                        {wh.is_active ? (
                          <Badge className="bg-emerald-600/15 text-emerald-600 border-emerald-600/30 text-xs">
                            نشط
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            معطل
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate max-w-xl">
                        {wh.url}
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {wh.events.map((ev) => {
                          const opt = EVENT_OPTIONS.find((o) => o.id === ev);
                          return (
                            <Badge key={ev} variant="outline" className="text-[11px] py-0">
                              {opt?.label || ev}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestPing(wh)}
                        disabled={testingId === wh.id}
                        className="gap-1.5 text-xs"
                      >
                        {testingId === wh.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5 text-primary" />
                        )}
                        اختبار الاتصال
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditWebhookModal(wh)}
                            className="h-8 w-8 p-0"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteWebhook(wh.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Webhook Add/Edit Dialog */}
      <Dialog open={whDialogOpen} onOpenChange={setWhDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingWh ? "تعديل قناة الـ Webhook" : "إضافة قناة Webhook جديدة"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="wh_name">اسم القناة أو الرابط</Label>
              <Input
                id="wh_name"
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                placeholder="مثال: قناة تنبيهات سلاك للإدارة"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wh_platform">المنصة</Label>
              <Select
                value={whPlatform}
                onValueChange={(val) => setWhPlatform(val as WebhookConfig["platform"])}
              >
                <SelectTrigger id="wh_platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="discord">Discord</SelectItem>
                  <SelectItem value="teams">Microsoft Teams</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp Webhook</SelectItem>
                  <SelectItem value="custom">مخصص (Custom REST Webhook)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wh_url">رابط الـ Webhook URL</Label>
              <Input
                id="wh_url"
                value={whUrl}
                onChange={(e) => setWhUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label>الأحداث المفعّلة للإرسال (Events)</Label>
              <div className="grid gap-2 border p-3 rounded-lg max-h-48 overflow-y-auto">
                {EVENT_OPTIONS.map((ev) => (
                  <label
                    key={ev.id}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1.5 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={whEvents.includes(ev.id)}
                      onChange={() => toggleEvent(ev.id)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span>{ev.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label htmlFor="wh_active" className="cursor-pointer">
                تفعيل القناة
              </Label>
              <Switch id="wh_active" checked={whActive} onCheckedChange={setWhActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWhDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSaveWebhook}>حفظ القناة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
