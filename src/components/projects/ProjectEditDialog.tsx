import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectModulesManager } from "@/components/projects/ProjectModulesManager";

export const UNASSIGNED = "__none__";

export interface EditableProject {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  owner_id?: string | null;
  health_status?: string | null;
  country?: string | null;
  address?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  secondary_email?: string | null;
  secondary_phone?: string | null;
  contract_number?: string | null;
  contract_value?: number | null;
  currency?: string | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  alert_days_before?: number | null;
  notes?: string | null;
}

interface OwnerOption {
  id: string;
  full_name: string;
}

interface Props {
  project: EditableProject | null;
  employees?: OwnerOption[];
  canManageModules?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

/** Full project editor covering details, contract data and contacts. */
export function ProjectEditDialog({ project, employees, canManageModules = false, onOpenChange, onSaved }: Props) {
  const [form, setForm] = useState<EditableProject | null>(project);
  const [saving, setSaving] = useState(false);
  const [owners, setOwners] = useState<OwnerOption[]>(employees ?? []);

  useEffect(() => setForm(project), [project]);

  useEffect(() => {
    if (employees && employees.length) {
      setOwners(employees);
      return;
    }
    if (!project) return;
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setOwners(data ?? []));
  }, [project, employees]);

  const set = <K extends keyof EditableProject>(key: K, value: EditableProject[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const name = form.name.trim();
    if (name.length < 2 || name.length > 150) {
      toast.error("اسم المشروع يجب أن يكون بين 2 و 150 حرفًا");
      return;
    }
    if (form.contract_start_date && form.contract_end_date && form.contract_end_date < form.contract_start_date) {
      toast.error("تاريخ نهاية العقد يجب أن يكون بعد تاريخ البداية");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        name,
        description: form.description?.trim() || null,
        is_active: form.is_active,
        owner_id: !form.owner_id || form.owner_id === UNASSIGNED ? null : form.owner_id,
        health_status: (form.health_status || "green") as "green" | "yellow" | "red",
        country: form.country?.trim() || null,
        address: form.address?.trim() || null,
        contact_email: form.contact_email?.trim() || null,
        contact_phone: form.contact_phone?.trim() || null,
        secondary_email: form.secondary_email?.trim() || null,
        secondary_phone: form.secondary_phone?.trim() || null,
        contract_number: form.contract_number?.trim() || null,
        contract_value:
          form.contract_value === null || form.contract_value === undefined || (form.contract_value as any) === ""
            ? null
            : Number(form.contract_value),
        currency: form.currency?.trim() || null,
        contract_start_date: form.contract_start_date || null,
        contract_end_date: form.contract_end_date || null,
        alert_days_before: Number(form.alert_days_before ?? 30),
        notes: form.notes?.trim() || null,
      })
      .eq("id", form.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم تحديث المشروع");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={!!project} onOpenChange={(v) => !v && onOpenChange(false)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل المشروع</DialogTitle>
        </DialogHeader>
        {form && (
          <Tabs defaultValue="details" className="pt-2">
            <TabsList className="w-full flex-wrap h-auto">
              <TabsTrigger value="details" className="flex-1">التفاصيل</TabsTrigger>
              <TabsTrigger value="contract" className="flex-1">العقد</TabsTrigger>
              <TabsTrigger value="contact" className="flex-1">بيانات التواصل</TabsTrigger>
              <TabsTrigger value="modules" className="flex-1">الأنظمة</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit}>
              <TabsContent value="details" className="pt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pe-name">اسم المشروع *</Label>
                  <Input id="pe-name" value={form.name} maxLength={150} onChange={(e) => set("name", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pe-desc">الوصف</Label>
                  <Textarea id="pe-desc" rows={3} maxLength={500} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pe-owner">الموظف المسؤول</Label>
                    <Select value={form.owner_id || UNASSIGNED} onValueChange={(v) => set("owner_id", v)}>
                      <SelectTrigger id="pe-owner"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>بدون مسؤول</SelectItem>
                        {owners.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pe-health">الحالة الصحية</Label>
                    <Select value={form.health_status || "green"} onValueChange={(v) => set("health_status", v)}>
                      <SelectTrigger id="pe-health"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="green">صحي</SelectItem>
                        <SelectItem value="yellow">تحذير</SelectItem>
                        <SelectItem value="red">حرج</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pe-notes">ملاحظات</Label>
                  <Textarea id="pe-notes" rows={3} maxLength={2000} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="pe-active" className="cursor-pointer">المشروع نشط</Label>
                  <Switch id="pe-active" checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
                </div>
              </TabsContent>

              <TabsContent value="contract" className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pe-cnum">رقم العقد</Label>
                    <Input id="pe-cnum" value={form.contract_number ?? ""} onChange={(e) => set("contract_number", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pe-cval">قيمة العقد</Label>
                    <Input id="pe-cval" type="number" step="0.01" value={form.contract_value ?? ""} onChange={(e) => set("contract_value", e.target.value === "" ? null : Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pe-cur">العملة</Label>
                    <Input id="pe-cur" placeholder="SAR" value={form.currency ?? ""} onChange={(e) => set("currency", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pe-alert">التنبيه قبل نهاية العقد (أيام)</Label>
                    <Input id="pe-alert" type="number" min={0} max={365} value={form.alert_days_before ?? 30} onChange={(e) => set("alert_days_before", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pe-start">بداية العقد</Label>
                    <Input id="pe-start" type="date" value={form.contract_start_date ?? ""} onChange={(e) => set("contract_start_date", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pe-end">نهاية العقد</Label>
                    <Input id="pe-end" type="date" value={form.contract_end_date ?? ""} onChange={(e) => set("contract_end_date", e.target.value)} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="contact" className="pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pe-country">الدولة</Label>
                    <Input id="pe-country" value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pe-addr">العنوان</Label>
                    <Input id="pe-addr" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pe-email">البريد الأساسي</Label>
                    <Input id="pe-email" type="email" value={form.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pe-phone">الهاتف الأساسي</Label>
                    <Input id="pe-phone" value={form.contact_phone ?? ""} onChange={(e) => set("contact_phone", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pe-email2">بريد بديل</Label>
                    <Input id="pe-email2" type="email" value={form.secondary_email ?? ""} onChange={(e) => set("secondary_email", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pe-phone2">هاتف بديل</Label>
                    <Input id="pe-phone2" value={form.secondary_phone ?? ""} onChange={(e) => set("secondary_phone", e.target.value)} />
                  </div>
                </div>
              </TabsContent>

              <div className="pt-4">
                <Button type="submit" disabled={saving} className="w-full">
                  {saving && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
                  حفظ التعديلات
                </Button>
              </div>
            </form>

            <TabsContent value="modules" className="pt-4">
              <ProjectModulesManager projectId={form.id} canMutate={canManageModules} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
