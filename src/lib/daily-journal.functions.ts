import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface JournalSubmissionRecord {
  id: string;
  user_id: string;
  journal_date: string;
  status: "submitted" | "approved" | "revision_requested";
  total_tasks: number;
  completed_tasks: number;
  total_minutes: number;
  employee_notes: string | null;
  manager_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  reviewer_name?: string | null;
  employee_name?: string | null;
}

const SUPER_ADMIN_EMAILS = ["ctraining801@gmail.com"];

async function checkIsManagerOrAdmin(userId: string): Promise<boolean> {
  const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = (userRes?.user?.email ?? "").toLowerCase().trim();
  if (email && SUPER_ADMIN_EMAILS.includes(email)) {
    return true;
  }
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "general_manager", "manager"]);

  return Boolean(data && data.length > 0);
}

/**
 * Fetch journal submission for a given date and user.
 */
export const getJournalSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    try {
      const currentUserId = context.userId;
      const targetUserId = data.userId || currentUserId;

      // If viewing another user's journal, verify manager or admin privileges
      if (targetUserId !== currentUserId) {
        const isManager = await checkIsManagerOrAdmin(currentUserId);
        if (!isManager) {
          return { ok: false, error: "ليس لديك صلاحية لمشاهدة يومية موظف آخر" };
        }
      }

      const { data: row, error } = await supabaseAdmin
        .from("daily_journal_submissions")
        .select(`
          id,
          user_id,
          journal_date,
          status,
          total_tasks,
          completed_tasks,
          total_minutes,
          employee_notes,
          manager_notes,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at
        `)
        .eq("user_id", targetUserId)
        .eq("journal_date", data.date)
        .maybeSingle();

      if (error) {
        console.error("[getJournalSubmission] Error:", error);
        return { ok: false, error: "تعذّر جلب حالة اليومية" };
      }

      if (!row) {
        return { ok: true, submission: null };
      }

      let reviewerName: string | null = null;
      if (row.reviewed_by) {
        const { data: revProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("id", row.reviewed_by)
          .maybeSingle();
        reviewerName = revProfile?.full_name ?? null;
      }

      return {
        ok: true,
        submission: {
          ...row,
          reviewer_name: reviewerName,
        } as JournalSubmissionRecord,
      };
    } catch (err: any) {
      console.error("[getJournalSubmission] Exception:", err);
      return { ok: false, error: err?.message || "خطأ غير متوقع" };
    }
  });

/**
 * Submit or update daily journal for review.
 */
export const submitDailyJournal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        totalTasks: z.number().int().min(0),
        completedTasks: z.number().int().min(0),
        totalMinutes: z.number().int().min(0),
        employeeNotes: z.string().max(2000).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    try {
      const userId = context.userId;

      // Upsert submission
      const { data: saved, error } = await supabaseAdmin
        .from("daily_journal_submissions")
        .upsert(
          {
            user_id: userId,
            journal_date: data.date,
            status: "submitted",
            total_tasks: data.totalTasks,
            completed_tasks: data.completedTasks,
            total_minutes: data.totalMinutes,
            employee_notes: data.employeeNotes?.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,journal_date" }
        )
        .select()
        .single();

      if (error) {
        console.error("[submitDailyJournal] Upsert error:", error);
        return { ok: false, error: "فشل حفظ طلب اعتماد اليومية" };
      }

      // Fetch employee profile name for manager notification
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      const empName = profile?.full_name || "أحد الموظفين";

      // Notify managers
      const { data: managers } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "general_manager", "manager"]);

      if (managers && managers.length > 0) {
        const notifs = managers
          .filter((m) => m.user_id !== userId)
          .map((m) => ({
            user_id: m.user_id,
            title: "يومية عمل جديدة بانتظار الاعتماد",
            body: `قام ${empName} برفع يومية العمل لتاريخ ${data.date} للاعتماد.`,
            type: "journal_submitted",
            link: "/team",
          }));

        if (notifs.length > 0) {
          await supabaseAdmin.from("notifications").insert(notifs);
        }
      }

      return {
        ok: true,
        message: "تم إرسال تقرير اليومية للمدير بنجاح للاعتماد",
        submission: saved as JournalSubmissionRecord,
      };
    } catch (err: any) {
      console.error("[submitDailyJournal] Exception:", err);
      return { ok: false, error: err?.message || "خطأ في الاتصال بالخادم" };
    }
  });

/**
 * Review daily journal submission (Approve or Request Revision).
 */
export const reviewDailyJournal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        submissionId: z.string().uuid(),
        status: z.enum(["approved", "revision_requested"]),
        managerNotes: z.string().max(2000).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    try {
      const reviewerId = context.userId;
      const isManager = await checkIsManagerOrAdmin(reviewerId);
      if (!isManager) {
        return { ok: false, error: "يتطلب اعتماد اليوميات صلاحيات إدارية" };
      }

      const now = new Date().toISOString();

      const { data: updated, error } = await supabaseAdmin
        .from("daily_journal_submissions")
        .update({
          status: data.status,
          manager_notes: data.managerNotes?.trim() || null,
          reviewed_by: reviewerId,
          reviewed_at: now,
          updated_at: now,
        })
        .eq("id", data.submissionId)
        .select()
        .single();

      if (error || !updated) {
        console.error("[reviewDailyJournal] Update error:", error);
        return { ok: false, error: "فشل تحديث حالة اليومية" };
      }

      // Notify the employee
      const title =
        data.status === "approved"
          ? "تم اعتماد يومية العمل بنجاح ✅"
          : "مطلوب تعديل على يومية العمل ⚠️";

      const body =
        data.managerNotes?.trim() ||
        (data.status === "approved"
          ? `تم اعتماد تقرير يومية العمل لتاريخ ${updated.journal_date} من قِبل الإدارة.`
          : `يرجى مراجعة وتحديث مهام يومية ${updated.journal_date} وإعادة إرسالها.`);

      await supabaseAdmin.from("notifications").insert({
        user_id: updated.user_id,
        title,
        body,
        type: "journal_reviewed",
        link: "/dashboard",
      });

      return {
        ok: true,
        message:
          data.status === "approved"
            ? "تم اعتماد يومية العمل بنجاح"
            : "تم إرسال طلب التعديل إلى الموظف بنجاح",
        submission: updated as JournalSubmissionRecord,
      };
    } catch (err: any) {
      console.error("[reviewDailyJournal] Exception:", err);
      return { ok: false, error: err?.message || "حدث خطأ أثناء اعتماد اليومية" };
    }
  });

/**
 * Get all pending journal submissions for the team/company.
 */
export const getTeamPendingJournals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: unknown) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .optional()
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    try {
      const isManager = await checkIsManagerOrAdmin(context.userId);
      if (!isManager) {
        return { ok: false, error: "غير مصرح لك باستعراض يوميات الفريق" };
      }

      let q = supabaseAdmin
        .from("daily_journal_submissions")
        .select(`
          id,
          user_id,
          journal_date,
          status,
          total_tasks,
          completed_tasks,
          total_minutes,
          employee_notes,
          manager_notes,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at
        `)
        .order("journal_date", { ascending: false });

      if (data?.date) {
        q = q.eq("journal_date", data.date);
      }

      const { data: rows, error } = await q.limit(100);

      if (error) {
        console.error("[getTeamPendingJournals] Query error:", error);
        return { ok: false, error: "فشل استرجاع سجلات اليومية" };
      }

      // Fetch employee names
      const userIds = Array.from(new Set((rows || []).map((r) => r.user_id)));
      const nameMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        profiles?.forEach((p) => nameMap.set(p.id, p.full_name));
      }

      const enriched = (rows || []).map((r) => ({
        ...r,
        employee_name: nameMap.get(r.user_id) || "موظف",
      })) as JournalSubmissionRecord[];

      return {
        ok: true,
        submissions: enriched,
      };
    } catch (err: any) {
      console.error("[getTeamPendingJournals] Exception:", err);
      return { ok: false, error: err?.message || "خطأ غير متوقع" };
    }
  });
