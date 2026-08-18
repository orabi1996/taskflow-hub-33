import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AttachmentsManager } from "./AttachmentsManager";
import { TaskHistory } from "./TaskHistory";
import { SubtasksManager } from "./SubtasksManager";
import { DependenciesManager } from "./DependenciesManager";

type TaskStatus = "completed" | "pending" | "postponed" | "cancelled";

export interface EditableTask {
  id: string;
  user_id: string;
  title: string;
  details: string | null;
  status: TaskStatus;
  project_id: string | null;
  start_at: string;
  end_at: string | null;
}

interface Project { id: string; name: string }

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};

interface Props {
  task: EditableTask | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canEdit: boolean;
  onSaved?: () => void;
}

export function EditTaskDialog({ task, open, onOpenChange, canEdit, onSaved }: Props) {
  const { user, roles } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const isAdmin = roles.includes("admin");
  const canMutateAttachments = !!task && (task.user_id === user?.id || isAdmin);

  useEffect(() => {
    if (!open) return;
    supabase.from("projects").select("id, name").eq("is_active", true).order("name").then(({ data }) => setProjects(data ?? []));
  }, [open]);

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!task) return;
    const fd = new FormData(e.currentTarget);
    const projectVal = fd.get("project_id");
    const endVal = String(fd.get("end_at") ?? "");
    const payload = {
      title: String(fd.get("title") ?? "").trim(),
      details: String(fd.get("details") ?? "").trim() || null,
      status: fd.get("status") as TaskStatus,
      project_id: projectVal && projectVal !== "__none__" ? String(projectVal) : null,
      start_at: new Date(String(fd.get("start_at"))).toISOString(),
      end_at: endVal ? new Date(endVal).toISOString() : null,
    };
    if (payload.title.length < 2) {
      toast.error("اسم المهمة قصير جدًا");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("tasks").update(payload).eq("id", task.id);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("تم حفظ التعديلات");
    onSaved?.();
    onOpenChange(false);
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{canEdit ? "تعديل المهمة" : "تفاصيل المهمة"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="pt-2">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">التفاصيل</TabsTrigger>
            <TabsTrigger value="subtasks" className="flex-1">المهام الفرعية</TabsTrigger>
            <TabsTrigger value="dependencies" className="flex-1">الاعتماديات</TabsTrigger>
            <TabsTrigger value="attachments" className="flex-1">المرفقات</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">السجل</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="pt-4">
            <form onSubmit={handleSave} className="space-y-4">
              <fieldset disabled={!canEdit} className="space-y-4 disabled:opacity-80">
                <div className="space-y-2">
                  <Label htmlFor="e-title">عنوان المهمة *</Label>
                  <Input id="e-title" name="title" defaultValue={task.title} required maxLength={200} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>المشروع</Label>
                    <Select name="project_id" defaultValue={task.project_id ?? "__none__"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— بدون مشروع —</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>الحالة *</Label>
                    <Select name="status" defaultValue={task.status}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">قيد التنفيذ</SelectItem>
                        <SelectItem value="completed">منتهية</SelectItem>
                        <SelectItem value="postponed">مؤجلة</SelectItem>
                        <SelectItem value="cancelled">ملغاة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="e-start">من *</Label>
                    <Input id="e-start" name="start_at" type="datetime-local" required defaultValue={toLocalInput(task.start_at)} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="e-end">إلى</Label>
                    <Input id="e-end" name="end_at" type="datetime-local" defaultValue={toLocalInput(task.end_at)} dir="ltr" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="e-details">التفاصيل</Label>
                  <Textarea id="e-details" name="details" rows={4} defaultValue={task.details ?? ""} maxLength={2000} />
                </div>
              </fieldset>

              {canEdit && (
                <Button type="submit" disabled={submitting} className="w-full" size="lg">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
                  حفظ التعديلات
                </Button>
              )}
            </form>
          </TabsContent>

          <TabsContent value="subtasks" className="pt-4">
            <SubtasksManager parentTaskId={task.id} parentOwnerId={task.user_id} canMutate={canEdit} />
          </TabsContent>

          <TabsContent value="dependencies" className="pt-4">
            <DependenciesManager taskId={task.id} canMutate={canEdit} />
          </TabsContent>

          <TabsContent value="attachments" className="pt-4">
            <AttachmentsManager taskId={task.id} taskOwnerId={task.user_id} canMutate={canMutateAttachments} />
          </TabsContent>

          <TabsContent value="history" className="pt-4">
            <TaskHistory taskId={task.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
