import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MessageSquare, Send, Trash2, Paperclip, X, FileIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listProjectComments,
  createComment,
  deleteComment,
  listCommentAttachments,
  recordCommentAttachment,
} from "@/lib/projects-extended.functions";

interface Attachment {
  id: string;
  comment_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  signedUrl: string | null;
}

interface Comment {
  id: string;
  user_id: string;
  body: string;
  mentioned_users: string[];
  created_at: string;
  author: { id: string; full_name: string; email: string | null } | null;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function humanSize(b: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function ProjectCommentsThread({
  projectId,
  currentUserId,
}: {
  projectId: string;
  currentUserId: string | null;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<Map<string, string>>(new Map());
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const [c, a] = await Promise.all([
        listProjectComments({ data: { projectId } }),
        listCommentAttachments({ data: { projectId } }),
      ]);
      setComments(c.comments as Comment[]);
      setAttachments(a.attachments as Attachment[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    supabase.from("profiles").select("id, full_name").eq("is_active", true).then(({ data }) => {
      setEmployees(data || []);
    });
  }, [projectId]);

  useEffect(() => {
    const channel = supabase
      .channel(`project_comments_${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_comments", filter: `project_id=eq.${projectId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "project_comment_attachments", filter: `project_id=eq.${projectId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const handleBodyChange = (v: string) => {
    setBody(v);
    const match = v.match(/@(\w*)$/);
    if (match) { setMentionQuery(match[1].toLowerCase()); setShowMentions(true); }
    else setShowMentions(false);
  };

  const insertMention = (emp: { id: string; full_name: string }) => {
    const newBody = body.replace(/@\w*$/, `@${emp.full_name} `);
    setBody(newBody);
    setSelectedMentions(new Map(selectedMentions).set(emp.id, emp.full_name));
    setShowMentions(false);
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    const valid = list.filter((f) => f.size <= MAX_FILE_SIZE);
    if (valid.length < list.length) toast.warning("بعض الملفات تجاوزت 20MB");
    setPendingFiles((prev) => [...prev, ...valid].slice(0, 5));
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!body.trim() && pendingFiles.length === 0) return;
    if (!currentUserId) return;
    setSubmitting(true);
    try {
      const validMentions = Array.from(selectedMentions.entries())
        .filter(([_, name]) => body.includes(`@${name}`))
        .map(([id]) => id);
      // create comment first to get id
      const { data: row, error } = await supabase
        .from("project_comments")
        .insert({
          project_id: projectId,
          user_id: currentUserId,
          body: body.trim() || "(مرفقات)",
          mentioned_users: validMentions,
        })
        .select("id")
        .single();
      if (error || !row) throw new Error(error?.message || "تعذّر الإرسال");

      // upload attachments
      for (const file of pendingFiles) {
        const safe = file.name.replace(/[^\w.\-]/g, "_");
        const path = `${projectId}/${row.id}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from("project-comment-attachments")
          .upload(path, file, { contentType: file.type });
        if (upErr) { toast.error(`فشل رفع: ${file.name}`); continue; }
        await recordCommentAttachment({
          data: {
            comment_id: row.id,
            project_id: projectId,
            file_path: path,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
          },
        });
      }
      setBody("");
      setPendingFiles([]);
      setSelectedMentions(new Map());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف التعليق؟")) return;
    try { await deleteComment({ data: { id } }); }
    catch (e: any) { toast.error(e.message); }
  };

  const filteredEmployees = employees
    .filter((e) => e.full_name.toLowerCase().includes(mentionQuery))
    .slice(0, 5);

  const attByComment = new Map<string, Attachment[]>();
  for (const a of attachments) {
    if (!attByComment.has(a.comment_id)) attByComment.set(a.comment_id, []);
    attByComment.get(a.comment_id)!.push(a);
  }

  return (
    <div className="space-y-4 flex flex-col h-[600px]">
      <h3 className="font-semibold">التعليقات والمناقشات</h3>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">جارٍ التحميل...</div>
        ) : comments.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-muted-foreground text-sm">لا توجد تعليقات بعد. كن أول من يبدأ النقاش.</p>
          </Card>
        ) : (
          comments.map((c) => {
            const atts = attByComment.get(c.id) || [];
            return (
              <Card key={c.id} className="p-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{(c.author?.full_name || "؟").slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{c.author?.full_name || "مستخدم"}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("ar")}</span>
                        {c.user_id === currentUserId && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(c.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="text-sm mt-1 whitespace-pre-wrap break-words">{c.body}</div>
                    {atts.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {atts.filter((a) => (a.mime_type || "").startsWith("image/") && a.signedUrl).length > 0 && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {atts
                              .filter((a) => (a.mime_type || "").startsWith("image/") && a.signedUrl)
                              .map((a) => (
                                <a key={a.id} href={a.signedUrl!} target="_blank" rel="noreferrer" className="block group">
                                  <img
                                    src={a.signedUrl!}
                                    alt={a.file_name}
                                    loading="lazy"
                                    className="w-full h-24 object-cover rounded border group-hover:opacity-90"
                                  />
                                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">{a.file_name}</div>
                                </a>
                              ))}
                          </div>
                        )}
                        <div className="space-y-1.5">
                          {atts
                            .filter((a) => !(a.mime_type || "").startsWith("image/"))
                            .map((a) => (
                              <a
                                key={a.id}
                                href={a.signedUrl || "#"}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 text-xs bg-muted/50 hover:bg-muted rounded p-2"
                              >
                                <FileIcon className="h-4 w-4 text-primary" />
                                <span className="flex-1 truncate">{a.file_name}</span>
                                <span className="text-muted-foreground">{humanSize(a.file_size)}</span>
                              </a>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t pt-3 space-y-2 relative">
        {showMentions && filteredEmployees.length > 0 && (
          <Card className="absolute bottom-full mb-2 left-0 right-0 p-1 max-h-48 overflow-auto z-10">
            {filteredEmployees.map((e) => (
              <button key={e.id} type="button" onClick={() => insertMention(e)} className="w-full text-right px-3 py-2 hover:bg-accent rounded text-sm">
                @{e.full_name}
              </button>
            ))}
          </Card>
        )}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pendingFiles.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                {f.name}
                <button type="button" onClick={() => setPendingFiles(pendingFiles.filter((_, idx) => idx !== i))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <Textarea
          value={body}
          onChange={(e) => handleBodyChange(e.target.value)}
          placeholder="اكتب تعليقًا... استخدم @ لذكر شخص"
          rows={3}
          maxLength={5000}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
        />
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-4 w-4 ms-1" /> إرفاق
            </Button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={onPickFiles} />
            <span className="text-xs text-muted-foreground">Ctrl+Enter للإرسال</span>
          </div>
          <Button onClick={handleSubmit} disabled={(!body.trim() && pendingFiles.length === 0) || submitting} size="sm">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin ms-1" /> : <Send className="h-4 w-4 ms-1" />}
            إرسال
          </Button>
        </div>
      </div>
    </div>
  );
}
