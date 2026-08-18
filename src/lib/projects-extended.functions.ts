import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ====================== MILESTONES ======================
export const listMilestones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("project_milestones")
      .select("*")
      .eq("project_id", data.projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    // compute progress from tasks
    const ids = (rows || []).map((r: any) => r.id);
    let progress: Record<string, { total: number; done: number }> = {};
    if (ids.length) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("milestone_id, status")
        .in("milestone_id", ids);
      for (const t of tasks || []) {
        const k = (t as any).milestone_id as string;
        if (!progress[k]) progress[k] = { total: 0, done: 0 };
        progress[k].total += 1;
        if ((t as any).status === "completed") progress[k].done += 1;
      }
    }
    return { milestones: rows || [], progress };
  });

export const upsertMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z
      .object({
        id: z.string().uuid().optional(),
        project_id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        description: z.string().max(2000).optional().nullable(),
        due_date: z.string().optional().nullable(),
        status: z.enum(["pending", "in_progress", "completed", "cancelled"]).default("pending"),
        sort_order: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase
        .from("project_milestones")
        .update({
          title: data.title,
          description: data.description ?? null,
          due_date: data.due_date || null,
          status: data.status,
          sort_order: data.sort_order ?? 0,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("project_milestones")
      .insert({
        project_id: data.project_id,
        title: data.title,
        description: data.description ?? null,
        due_date: data.due_date || null,
        status: data.status,
        sort_order: data.sort_order ?? 0,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id };
  });

export const deleteMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("project_milestones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ====================== MEMBERS ======================
export const listProjectMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: members, error } = await supabase
      .from("project_members")
      .select("*")
      .eq("project_id", data.projectId);
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((members || []).map((m: any) => m.user_id)));
    let profiles: any[] = [];
    if (ids.length) {
      const { data: pData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      profiles = pData || [];
    }
    const merged = (members || []).map((m: any) => ({
      ...m,
      profile: profiles.find((p) => p.id === m.user_id) || null,
    }));
    return { members: merged };
  });

export const addProjectMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z
      .object({
        project_id: z.string().uuid(),
        user_id: z.string().uuid(),
        role: z.enum(["manager", "executor", "observer"]).default("executor"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("project_members")
      .insert({ project_id: data.project_id, user_id: data.user_id, role: data.role, added_by: userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z.object({ id: z.string().uuid(), role: z.enum(["manager", "executor", "observer"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("project_members").update({ role: data.role }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeProjectMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("project_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ====================== COMMENTS ======================
export const listProjectComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("project_comments")
      .select("*")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows || []).map((c: any) => c.user_id)));
    let profiles: any[] = [];
    if (ids.length) {
      const { data: pData } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      profiles = pData || [];
    }
    return {
      comments: (rows || []).map((c: any) => ({ ...c, author: profiles.find((p) => p.id === c.user_id) || null })),
    };
  });

export const createComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z
      .object({
        project_id: z.string().uuid(),
        body: z.string().trim().min(1).max(5000),
        parent_comment_id: z.string().uuid().optional().nullable(),
        mentioned_users: z.array(z.string().uuid()).max(50).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("project_comments").insert({
      project_id: data.project_id,
      user_id: userId,
      body: data.body,
      parent_comment_id: data.parent_comment_id ?? null,
      mentioned_users: data.mentioned_users,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("project_comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ====================== COMMENT ATTACHMENTS ======================
export const listCommentAttachments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("project_comment_attachments")
      .select("*")
      .eq("project_id", data.projectId);
    if (error) throw new Error(error.message);
    // sign URLs
    const signed = await Promise.all(
      (rows || []).map(async (r: any) => {
        const { data: s } = await supabase.storage
          .from("project-comment-attachments")
          .createSignedUrl(r.file_path, 3600);
        return { ...r, signedUrl: s?.signedUrl || null };
      }),
    );
    return { attachments: signed };
  });

export const recordCommentAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z
      .object({
        comment_id: z.string().uuid(),
        project_id: z.string().uuid(),
        file_path: z.string().min(1),
        file_name: z.string().min(1).max(255),
        file_size: z.number().int().nonnegative().optional(),
        mime_type: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("project_comment_attachments").insert({
      comment_id: data.comment_id,
      project_id: data.project_id,
      uploaded_by: userId,
      file_path: data.file_path,
      file_name: data.file_name,
      file_size: data.file_size ?? null,
      mime_type: data.mime_type ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ====================== ACTIVITY FEED ======================
export const getProjectActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; before?: string | null; limit?: number }) =>
    z
      .object({
        projectId: z.string().uuid(),
        before: z.string().datetime().nullable().optional(),
        limit: z.number().int().min(10).max(100).default(30),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const before = data.before ?? new Date(Date.now() + 60_000).toISOString();
    const fetchLimit = data.limit + 5; // small buffer per source

    const baseHist = supabase
      .from("project_history")
      .select("id, changed_by, action, field_name, old_value, new_value, created_at")
      .eq("project_id", data.projectId)
      .lt("created_at", before)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    const baseComments = supabase
      .from("project_comments")
      .select("id, body, user_id, created_at")
      .eq("project_id", data.projectId)
      .lt("created_at", before)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    const baseMembers = supabase
      .from("project_members")
      .select("id, user_id, role, added_at, added_by")
      .eq("project_id", data.projectId)
      .lt("added_at", before)
      .order("added_at", { ascending: false })
      .limit(fetchLimit);

    const baseMhist = supabase
      .from("project_milestone_history")
      .select("id, milestone_id, changed_by, action, field_name, old_value, new_value, created_at")
      .eq("project_id", data.projectId)
      .lt("created_at", before)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    const [hist, comments, members, mhist] = await Promise.all([baseHist, baseComments, baseMembers, baseMhist]);

    const events: any[] = [];
    for (const h of hist.data || [])
      events.push({
        id: `history:${(h as any).id}`,
        kind: "history",
        at: (h as any).created_at,
        actor_id: (h as any).changed_by,
        title: `${(h as any).action} - ${(h as any).field_name ?? ""}`,
        detail: `${(h as any).old_value ?? ""} → ${(h as any).new_value ?? ""}`,
      });
    for (const c of comments.data || [])
      events.push({
        id: `comment:${(c as any).id}`,
        kind: "comment",
        at: (c as any).created_at,
        actor_id: (c as any).user_id,
        title: "تعليق جديد",
        detail: ((c as any).body || "").slice(0, 200),
      });
    for (const mb of members.data || [])
      events.push({
        id: `member:${(mb as any).id}`,
        kind: "member",
        at: (mb as any).added_at,
        actor_id: (mb as any).added_by,
        title: "إضافة عضو للفريق",
        detail: `الدور: ${(mb as any).role}`,
      });
    for (const mh of mhist.data || [])
      events.push({
        id: `mhist:${(mh as any).id}`,
        kind: "milestone_change",
        at: (mh as any).created_at,
        actor_id: (mh as any).changed_by,
        title: `تحديث مرحلة (${(mh as any).action})`,
        detail: `${(mh as any).field_name ?? ""}: ${(mh as any).old_value ?? "—"} → ${(mh as any).new_value ?? "—"}`,
      });

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const page = events.slice(0, data.limit);
    const hasMore = events.length > data.limit;
    const nextBefore = page.length > 0 ? page[page.length - 1].at : null;

    const actorIds = Array.from(new Set(page.map((e) => e.actor_id).filter(Boolean)));
    let profiles: any[] = [];
    if (actorIds.length) {
      const { data: pData } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
      profiles = pData || [];
    }
    return {
      events: page.map((e) => ({ ...e, actor: profiles.find((p) => p.id === e.actor_id) || null })),
      hasMore,
      nextBefore,
    };
  });

// ====================== DASHBOARD ======================
export const getProjectsDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = new Date().toISOString().slice(0, 10);

    const [projects, milestones] = await Promise.all([
      supabase.from("projects").select("id, name, is_active, health_status, contract_end_date, owner_id"),
      supabase.from("project_milestones").select("id, project_id, status, due_date"),
    ]);

    const ps = projects.data || [];
    const ms = milestones.data || [];

    const totalProjects = ps.length;
    const activeProjects = ps.filter((p: any) => p.is_active).length;
    const overdueProjects = ps.filter(
      (p: any) => p.contract_end_date && p.contract_end_date < today && p.is_active,
    ).length;

    const healthCounts: Record<string, number> = { green: 0, yellow: 0, red: 0 };
    for (const p of ps) {
      const h = (p as any).health_status || "green";
      healthCounts[h] = (healthCounts[h] || 0) + 1;
    }

    const milestoneStatus: Record<string, number> = { pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
    for (const m of ms) {
      const s = (m as any).status || "pending";
      milestoneStatus[s] = (milestoneStatus[s] || 0) + 1;
    }

    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const in7Str = in7.toISOString().slice(0, 10);
    const overdueMilestones = ms.filter(
      (m: any) => m.due_date && m.status !== "completed" && m.status !== "cancelled" && m.due_date < today,
    ).length;
    const dueSoonMilestones = ms.filter(
      (m: any) =>
        m.due_date && m.status !== "completed" && m.status !== "cancelled" &&
        m.due_date >= today && m.due_date <= in7Str,
    ).length;

    const projectNameById = new Map(ps.map((p: any) => [p.id, p.name]));
    const upcomingMilestones = ms
      .filter((m: any) => m.due_date && m.status !== "completed" && m.due_date >= today)
      .sort((a: any, b: any) => a.due_date.localeCompare(b.due_date))
      .slice(0, 10)
      .map((m: any) => ({ ...m, project_name: projectNameById.get(m.project_id) || "—" }));

    // owner -> count
    const ownerCounts: Record<string, number> = {};
    for (const p of ps) {
      const o = (p as any).owner_id;
      if (o) ownerCounts[o] = (ownerCounts[o] || 0) + 1;
    }
    const ownerIds = Object.keys(ownerCounts);
    let ownerProfiles: any[] = [];
    if (ownerIds.length) {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ownerIds);
      ownerProfiles = data || [];
    }
    const projectsPerOwner = ownerIds
      .map((id) => ({
        owner_id: id,
        name: ownerProfiles.find((o) => o.id === id)?.full_name || "بدون اسم",
        count: ownerCounts[id],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      totalProjects,
      activeProjects,
      overdueProjects,
      completedMilestones: milestoneStatus.completed,
      overdueMilestones,
      dueSoonMilestones,
      healthCounts,
      milestoneStatus,
      upcomingMilestones,
      projectsPerOwner,
    };
  });

// ====================== MILESTONE TASKS ======================
export const listMilestoneTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { milestoneId: string }) => z.object({ milestoneId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("tasks")
      .select("id, title, status, priority, start_at, end_at, user_id")
      .eq("milestone_id", data.milestoneId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tasks: rows || [] };
  });

export const assignTaskToMilestone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z.object({ task_id: z.string().uuid(), milestone_id: z.string().uuid().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks")
      .update({ milestone_id: data.milestone_id })
      .eq("id", data.task_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listProjectTasksUnassigned = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tasks")
      .select("id, title, status, milestone_id")
      .eq("project_id", data.projectId)
      .is("milestone_id", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { tasks: rows || [] };
  });
