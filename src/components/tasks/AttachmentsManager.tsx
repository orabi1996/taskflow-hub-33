import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip, Download, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

interface Props {
  taskId: string;
  taskOwnerId: string;
  /** Whether the current user is allowed to upload/delete (typically owner or admin). */
  canMutate: boolean;
}

const formatSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export function AttachmentsManager({ taskId, taskOwnerId, canMutate }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("task_attachments")
      .select("id, file_name, file_path, file_size, mime_type, uploaded_by, created_at")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) {
        toast.warning(`${file.name} تجاوز 20MB`);
        continue;
      }
      const safeName = file.name.replace(/[^\w.\-]/g, "_");
      const path = `${taskOwnerId}/${taskId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("task-attachments")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        toast.error(`فشل رفع ${file.name}: ${upErr.message}`);
        continue;
      }
      const { error: insErr } = await supabase.from("task_attachments").insert({
        task_id: taskId,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      });
      if (insErr) toast.error(insErr.message);
    }
    setUploading(false);
    toast.success("تم رفع المرفقات");
    load();
  };

  const handleDownload = async (att: Attachment) => {
    const { data, error } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(att.file_path, 60);
    if (error || !data) {
      toast.error("فشل إنشاء رابط التنزيل");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (att: Attachment) => {
    if (!confirm(`حذف ${att.file_name}؟`)) return;
    const { error: stErr } = await supabase.storage
      .from("task-attachments")
      .remove([att.file_path]);
    if (stErr) {
      toast.error(stErr.message);
      return;
    }
    const { error: dbErr } = await supabase
      .from("task_attachments")
      .delete()
      .eq("id", att.id);
    if (dbErr) {
      toast.error(dbErr.message);
      return;
    }
    toast.success("تم الحذف");
    load();
  };

  return (
    <div className="space-y-3">
      {canMutate && (
        <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg py-3 cursor-pointer hover:bg-muted/40 transition-[var(--transition-smooth)]">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          <span className="text-sm">{uploading ? "جارٍ الرفع..." : "رفع مرفق جديد"}</span>
          <input type="file" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground text-sm py-4">جارٍ التحميل...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-6">لا توجد مرفقات</div>
      ) : (
        <ul className="space-y-2">
          {items.map((att) => (
            <li key={att.id} className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{att.file_name}</div>
                <div className="text-xs text-muted-foreground">{formatSize(att.file_size)}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => handleDownload(att)} title="تنزيل">
                <Download className="h-4 w-4" />
              </Button>
              {canMutate && (
                <Button size="icon" variant="ghost" onClick={() => handleDelete(att)} title="حذف" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
