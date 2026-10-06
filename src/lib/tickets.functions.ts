import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface TicketRecord {
  id: string;
  ticket_number: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "urgent" | "high" | "medium" | "low";
  category: string | null;
  client_id: string | null;
  project_id: string | null;
  module_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  sla_hours: number;
  due_at: string;
  first_responded_at: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  client?: { name: string } | null;
  project?: { name: string } | null;
  module?: { name: string; code: string | null; color: string | null } | null;
  assigned?: { full_name: string; email: string | null } | null;
  messages_count?: number;
  is_sla_breached?: boolean;
  sla_remaining_minutes?: number;
}

export interface TicketMessageRecord {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  message: string;
  is_internal_note: boolean;
  created_at: string;
  sender_name?: string | null;
}

/**
 * List support tickets with client, project, and SLA calculations.
 */
export const listSupportTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: unknown) =>
    z
      .object({
        status: z.string().optional(),
        priority: z.string().optional(),
        projectId: z.string().uuid().optional(),
        clientId: z.string().uuid().optional(),
        search: z.string().optional(),
      })
      .optional()
      .parse(input)
  )
  .handler(async ({ data }) => {
    try {
      let q = supabaseAdmin
        .from("support_tickets")
        .select(`
          *,
          client:clients(name),
          project:projects(name),
          module:company_modules(name, code, color)
        `)
        .order("created_at", { ascending: false });

      if (data?.status && data.status !== "all") {
        q = q.eq("status", data.status as any);
      }
      if (data?.priority && data.priority !== "all") {
        q = q.eq("priority", data.priority as any);
      }
      if (data?.projectId && data.projectId !== "all") {
        q = q.eq("project_id", data.projectId);
      }
      if (data?.clientId && data.clientId !== "all") {
        q = q.eq("client_id", data.clientId);
      }

      const { data: rows, error } = await q.limit(200);
      if (error) {
        console.error("[listSupportTickets] Query error:", error);
        return { ok: false, error: "تعذّر جلب تذاكر الدعم الفني" };
      }

      // Fetch assigned technician names
      const assignedIds = Array.from(
        new Set((rows || []).map((r) => r.assigned_to).filter(Boolean) as string[])
      );
      const profileMap = new Map<string, { full_name: string; email: string | null }>();
      if (assignedIds.length > 0) {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", assignedIds);
        profs?.forEach((p) => profileMap.set(p.id, { full_name: p.full_name, email: p.email }));
      }

      const nowMs = Date.now();
      let filtered = (rows || []).map((r) => {
        const dueMs = new Date(r.due_at).getTime();
        const isResolved = r.status === "resolved" || r.status === "closed";
        const isBreached = isResolved
          ? r.resolved_at
            ? new Date(r.resolved_at).getTime() > dueMs
            : false
          : nowMs > dueMs;

        const slaRemainingMinutes = isResolved
          ? 0
          : Math.round((dueMs - nowMs) / 60000);

        return {
          ...r,
          assigned: r.assigned_to ? profileMap.get(r.assigned_to) || null : null,
          is_sla_breached: isBreached,
          sla_remaining_minutes: slaRemainingMinutes,
        } as TicketRecord;
      });

      if (data?.search && data.search.trim()) {
        const query = data.search.trim().toLowerCase();
        filtered = filtered.filter(
          (t) =>
            t.title.toLowerCase().includes(query) ||
            t.ticket_number.toLowerCase().includes(query) ||
            (t.description || "").toLowerCase().includes(query) ||
            (t.client?.name || "").toLowerCase().includes(query)
        );
      }

      return {
        ok: true,
        tickets: filtered,
      };
    } catch (err: any) {
      console.error("[listSupportTickets] Exception:", err);
      return { ok: false, error: err?.message || "خطأ غير متوقع" };
    }
  });

/**
 * Get detailed ticket with conversation messages thread.
 */
export const getTicketDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ticketId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data }) => {
    try {
      const { data: ticket, error: tErr } = await supabaseAdmin
        .from("support_tickets")
        .select(`
          *,
          client:clients(name, email, phone),
          project:projects(name),
          module:company_modules(name, code, color)
        `)
        .eq("id", data.ticketId)
        .single();

      if (tErr || !ticket) {
        return { ok: false, error: "التذكرة غير موجودة" };
      }

      // Fetch messages
      const { data: messages, error: mErr } = await supabaseAdmin
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", data.ticketId)
        .order("created_at", { ascending: true });

      if (mErr) console.warn("[getTicketDetails] Messages fetch error:", mErr);

      // Sender profiles
      const senderIds = Array.from(
        new Set((messages || []).map((m) => m.sender_id).filter(Boolean) as string[])
      );
      if (ticket.assigned_to && !senderIds.includes(ticket.assigned_to)) {
        senderIds.push(ticket.assigned_to);
      }

      const profMap = new Map<string, string>();
      if (senderIds.length > 0) {
        const { data: profs } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name")
          .in("id", senderIds);
        profs?.forEach((p) => profMap.set(p.id, p.full_name));
      }

      const enrichedMessages = (messages || []).map((m) => ({
        ...m,
        sender_name: m.sender_id ? profMap.get(m.sender_id) || "مستخدم" : "النظام",
      })) as TicketMessageRecord[];

      return {
        ok: true,
        ticket: {
          ...ticket,
          assigned: ticket.assigned_to
            ? { full_name: profMap.get(ticket.assigned_to) || "فني الدعم", email: null }
            : null,
        } as TicketRecord,
        messages: enrichedMessages,
      };
    } catch (err: any) {
      console.error("[getTicketDetails] Exception:", err);
      return { ok: false, error: err?.message || "خطأ غير متوقع" };
    }
  });

/**
 * Create a new support ticket.
 */
export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(3).max(255),
        description: z.string().optional().nullable(),
        priority: z.enum(["urgent", "high", "medium", "low"]).default("medium"),
        category: z.string().optional().nullable(),
        clientId: z.string().uuid().optional().nullable(),
        projectId: z.string().uuid().optional().nullable(),
        moduleId: z.string().uuid().optional().nullable(),
        assignedTo: z.string().uuid().optional().nullable(),
        slaHours: z.number().int().min(1).max(720).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    try {
      const creatorId = context.userId;

      // SLA Hours based on priority if not custom
      const defaultSlaHours: Record<string, number> = {
        urgent: 4,
        high: 8,
        medium: 24,
        low: 48,
      };
      const hours = data.slaHours || defaultSlaHours[data.priority] || 24;
      const dueAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();

      // Generate Ticket Number
      const year = new Date().getFullYear();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const ticketNumber = `TK-${year}-${randomSuffix}`;

      const { data: created, error } = await supabaseAdmin
        .from("support_tickets")
        .insert({
          ticket_number: ticketNumber,
          title: data.title,
          description: data.description || null,
          priority: data.priority,
          category: data.category || "erp_core",
          status: "open",
          client_id: data.clientId || null,
          project_id: data.projectId || null,
          module_id: data.moduleId || null,
          assigned_to: data.assignedTo || null,
          created_by: creatorId,
          sla_hours: hours,
          due_at: dueAt,
        })
        .select()
        .single();

      if (error || !created) {
        console.error("[createSupportTicket] Insert error:", error);
        return { ok: false, error: "فشل إنشاء تذكرة الدعم الفني" };
      }

      // Notify assigned technician if present
      if (data.assignedTo) {
        await supabaseAdmin.from("notifications").insert({
          user_id: data.assignedTo,
          title: `تم تعيين تذكرة دعم فني جديدة لك [${ticketNumber}]`,
          body: `العنوان: ${data.title} • الأولوية: ${data.priority}`,
          type: "ticket_assigned",
          link: "/tickets",
        });
      }

      return {
        ok: true,
        message: `تم فتح تذكرة الدعم بنجاح برقم (${ticketNumber})`,
        ticket: created as TicketRecord,
      };
    } catch (err: any) {
      console.error("[createSupportTicket] Exception:", err);
      return { ok: false, error: err?.message || "حدث خطأ غير متوقع" };
    }
  });

/**
 * Update ticket status (e.g. resolve, close, in_progress).
 */
export const updateTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        status: z.enum(["open", "in_progress", "resolved", "closed"]),
        resolutionNotes: z.string().optional().nullable(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    try {
      const now = new Date().toISOString();
      const updates: any = {
        status: data.status,
        updated_at: now,
      };

      if (data.status === "in_progress") {
        updates.first_responded_at = now;
      } else if (data.status === "resolved" || data.status === "closed") {
        updates.resolved_at = now;
        if (data.resolutionNotes) {
          updates.resolution_notes = data.resolutionNotes.trim();
        }
      }

      const { data: updated, error } = await supabaseAdmin
        .from("support_tickets")
        .update(updates)
        .eq("id", data.ticketId)
        .select()
        .single();

      if (error || !updated) {
        return { ok: false, error: "تعذّر تحديث حالة التذكرة" };
      }

      // Record status change in thread
      const statusLabels: Record<string, string> = {
        open: "مفتوحة",
        in_progress: "قيد المعالجة والتحقيق",
        resolved: "تم الحل بنجاح",
        closed: "مغلقة نهائياً",
      };

      await supabaseAdmin.from("ticket_messages").insert({
        ticket_id: data.ticketId,
        sender_id: context.userId,
        message: `تم تغيير حالة التذكرة إلى: [${statusLabels[data.status] || data.status}]${
          data.resolutionNotes ? ` — الملاحظات: ${data.resolutionNotes}` : ""
        }`,
        is_internal_note: false,
      });

      // Notify ticket creator or assignee if different from current updater
      const notifyTarget = updated.created_by === context.userId ? updated.assigned_to : updated.created_by;
      if (notifyTarget && notifyTarget !== context.userId) {
        await supabaseAdmin.from("notifications").insert({
          user_id: notifyTarget,
          type: "ticket_status_change",
          title: `تحديث حالة التذكرة #${updated.ticket_number}`,
          body: `أصبحت الحالة الآن: ${statusLabels[data.status] || data.status}${data.resolutionNotes ? ` (${data.resolutionNotes.slice(0, 80)})` : ""}`,
          link: "/tickets",
        });
      }

      return {
        ok: true,
        message: "تم تحديث حالة التذكرة بنجاح",
        ticket: updated as TicketRecord,
      };
    } catch (err: any) {
      console.error("[updateTicketStatus] Exception:", err);
      return { ok: false, error: err?.message || "خطأ غير متوقع" };
    }
  });

/**
 * Add a message or internal technical note to a ticket.
 */
export const addTicketMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        message: z.string().trim().min(1).max(4000),
        isInternalNote: z.boolean().default(false),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    try {
      const senderId = context.userId;

      const { data: created, error } = await supabaseAdmin
        .from("ticket_messages")
        .insert({
          ticket_id: data.ticketId,
          sender_id: senderId,
          message: data.message,
          is_internal_note: data.isInternalNote,
        })
        .select()
        .single();

      if (error || !created) {
        return { ok: false, error: "تعذّر إرسال الرد" };
      }

      // Touch ticket updated_at and first_responded_at
      await supabaseAdmin
        .from("support_tickets")
        .update({
          updated_at: new Date().toISOString(),
          first_responded_at: new Date().toISOString(),
        })
        .eq("id", data.ticketId)
        .is("first_responded_at", null);

      // Notify relevant parties if not an internal technical note
      if (!data.isInternalNote) {
        const { data: tkt } = await supabaseAdmin
          .from("support_tickets")
          .select("ticket_number, title, created_by, assigned_to")
          .eq("id", data.ticketId)
          .single();

        if (tkt) {
          const recipientId = tkt.assigned_to === senderId ? tkt.created_by : tkt.assigned_to;
          if (recipientId && recipientId !== senderId) {
            await supabaseAdmin.from("notifications").insert({
              user_id: recipientId,
              type: "ticket_message",
              title: `رد جديد على التذكرة #${tkt.ticket_number}`,
              body: data.message.length > 120 ? data.message.slice(0, 117) + "..." : data.message,
              link: "/tickets",
            });
          }
        }
      }

      return {
        ok: true,
        message: created,
      };
    } catch (err: any) {
      console.error("[addTicketMessage] Exception:", err);
      return { ok: false, error: err?.message || "خطأ غير متوقع" };
    }
  });

/**
 * SLA Dashboard Metrics.
 */
export const getSlaDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const { data: tickets, error } = await supabaseAdmin
        .from("support_tickets")
        .select("status, priority, due_at, resolved_at, created_at");

      if (error) throw new Error(error.message);

      const all = tickets || [];
      const total = all.length;
      const open = all.filter((t) => t.status === "open").length;
      const inProgress = all.filter((t) => t.status === "in_progress").length;
      const active = open + inProgress;
      const resolved = all.filter((t) => t.status === "resolved" || t.status === "closed").length;
      const urgentActive = all.filter(
        (t) => t.priority === "urgent" && (t.status === "open" || t.status === "in_progress")
      ).length;

      const nowMs = Date.now();
      let breached = 0;
      for (const t of all) {
        const dueMs = new Date(t.due_at).getTime();
        const isRes = t.status === "resolved" || t.status === "closed";
        if (isRes) {
          if (t.resolved_at && new Date(t.resolved_at).getTime() > dueMs) breached++;
        } else {
          if (nowMs > dueMs) breached++;
        }
      }

      const complianceRate = total > 0 ? Math.round(((total - breached) / total) * 100) : 100;

      return {
        ok: true,
        stats: {
          total,
          active,
          open,
          inProgress,
          resolved,
          urgentActive,
          breached,
          complianceRate,
        },
      };
    } catch (err: any) {
      console.error("[getSlaDashboardStats] Error:", err);
      return {
        ok: false,
        stats: {
          total: 0,
          active: 0,
          open: 0,
          inProgress: 0,
          resolved: 0,
          urgentActive: 0,
          breached: 0,
          complianceRate: 100,
        },
      };
    }
  });
