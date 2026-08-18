import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listProjectMembers,
  addProjectMember,
  updateMemberRole,
  removeProjectMember,
} from "@/lib/projects-extended.functions";

interface Member {
  id: string;
  user_id: string;
  role: string;
  added_at: string;
  profile: { id: string; full_name: string; email: string | null } | null;
}

const ROLES: Record<string, string> = {
  manager: "مدير المشروع",
  executor: "منفذ",
  observer: "مراقب",
};
const ROLE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  manager: "default",
  executor: "secondary",
  observer: "outline",
};

export function ProjectMembersManager({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newUser, setNewUser] = useState<string>("");
  const [newRole, setNewRole] = useState<string>("executor");

  const load = async () => {
    setLoading(true);
    try {
      const res = await listProjectMembers({ data: { projectId } });
      setMembers(res.members as Member[]);
      const { data: emps } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      setEmployees(emps || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const handleAdd = async () => {
    if (!newUser) return;
    setSubmitting(true);
    try {
      await addProjectMember({ data: { project_id: projectId, user_id: newUser, role: newRole as any } });
      toast.success("تمت إضافة العضو");
      setOpen(false);
      setNewUser("");
      setNewRole("executor");
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    try {
      await updateMemberRole({ data: { id, role: role as any } });
      toast.success("تم تحديث الدور");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("إزالة هذا العضو؟")) return;
    try {
      await removeProjectMember({ data: { id } });
      toast.success("تمت الإزالة");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const availableEmployees = employees.filter((e) => !members.some((m) => m.user_id === e.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">فريق المشروع</h3>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 ms-1" /> إضافة عضو
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة عضو للفريق</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>الموظف</Label>
                  <Select value={newUser} onValueChange={setNewUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر موظفًا" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEmployees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الدور</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} disabled={!newUser || submitting} className="w-full">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin ms-2" />}
                  إضافة
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-8">جارٍ التحميل...</div>
      ) : members.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-muted-foreground text-sm">لا يوجد أعضاء بعد</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <Card key={m.id} className="p-3 flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{(m.profile?.full_name || "؟").slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{m.profile?.full_name || "مستخدم محذوف"}</div>
                {m.profile?.email && <div className="text-xs text-muted-foreground">{m.profile.email}</div>}
              </div>
              {canManage ? (
                <Select value={m.role} onValueChange={(v) => handleRoleChange(m.id, v)}>
                  <SelectTrigger className="w-[140px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant={ROLE_VARIANTS[m.role]}>{ROLES[m.role]}</Badge>
              )}
              {canManage && (
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemove(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
