import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export const listPeopleLite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, job_title, department_id")
      .eq("is_active", true)
      .order("full_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* ------------------------------------------------------------------ */
/* Objectives / Key results (OKRs)                                     */
/* ------------------------------------------------------------------ */

const PeriodSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  quarter: z.number().int().min(1).max(4),
  owner_id: z.string().uuid().nullable().optional(),
});

export const listObjectives = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PeriodSchema.parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("objectives")
      .select(
        "id, title, description, owner_id, department_id, module_id, quarter, year, status, progress, created_at"
      )
      .eq("year", data.year)
      .eq("quarter", data.quarter)
      .order("created_at", { ascending: false });
    if (data.owner_id) q = q.eq("owner_id", data.owner_id);

    const { data: objectives, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (objectives ?? []).map((o) => o.id);

    const { data: krs, error: krErr } = ids.length
      ? await context.supabase
          .from("key_results")
          .select("id, objective_id, title, start_value, current_value, target_value, unit, status, sort_order")
          .in("objective_id", ids)
          .order("sort_order")
      : { data: [], error: null };
    if (krErr) throw new Error(krErr.message);

    const { data: people } = await context.supabase.from("profiles").select("id, full_name");
    const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));

    return (objectives ?? []).map((o) => ({
      ...o,
      owner_name: nameById.get(o.owner_id) ?? "—",
      key_results: (krs ?? []).filter((k) => k.objective_id === o.id),
    }));
  });

const ObjectiveSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(200),
  description: z.string().max(2000).nullable().optional(),
  owner_id: z.string().uuid(),
  department_id: z.string().uuid().nullable().optional(),
  module_id: z.string().uuid().nullable().optional(),
  quarter: z.number().int().min(1).max(4),
  year: z.number().int().min(2000).max(2100),
  status: z.enum(["draft", "active", "completed", "cancelled"]),
});

export const upsertObjective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ObjectiveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      title: data.title,
      description: data.description ?? null,
      owner_id: data.owner_id,
      department_id: data.department_id ?? null,
      module_id: data.module_id ?? null,
      quarter: data.quarter,
      year: data.year,
      status: data.status,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase.from("objectives").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("objectives")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteObjective = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("objectives").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const KrSchema = z.object({
  id: z.string().uuid().optional(),
  objective_id: z.string().uuid(),
  title: z.string().min(2).max(200),
  start_value: z.number(),
  current_value: z.number(),
  target_value: z.number(),
  unit: z.enum(["number", "percent", "currency"]),
  status: z.enum(["on_track", "at_risk", "off_track", "done"]),
});

export const upsertKeyResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => KrSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    if (id) {
      const { error } = await context.supabase.from("key_results").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase
      .from("key_results")
      .insert({ ...rest, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteKeyResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("key_results").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Performance reviews                                                 */
/* ------------------------------------------------------------------ */

export const listReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("performance_reviews")
      .select("*")
      .order("period_end", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: people } = await context.supabase.from("profiles").select("id, full_name");
    const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));
    return (data ?? []).map((r) => ({
      ...r,
      employee_name: nameById.get(r.employee_id) ?? "—",
      reviewer_name: nameById.get(r.reviewer_id) ?? "—",
    }));
  });

const ReviewSchema = z.object({
  id: z.string().uuid().optional(),
  employee_id: z.string().uuid(),
  period_start: z.string().min(10).max(10),
  period_end: z.string().min(10).max(10),
  score_delivery: z.number().int().min(1).max(5).nullable(),
  score_quality: z.number().int().min(1).max(5).nullable(),
  score_collaboration: z.number().int().min(1).max(5).nullable(),
  score_timeliness: z.number().int().min(1).max(5).nullable(),
  strengths: z.string().max(2000).nullable().optional(),
  improvements: z.string().max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(["draft", "submitted", "acknowledged"]),
});

export const upsertReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      employee_id: data.employee_id,
      reviewer_id: context.userId,
      period_start: data.period_start,
      period_end: data.period_end,
      score_delivery: data.score_delivery,
      score_quality: data.score_quality,
      score_collaboration: data.score_collaboration,
      score_timeliness: data.score_timeliness,
      strengths: data.strengths ?? null,
      improvements: data.improvements ?? null,
      notes: data.notes ?? null,
      status: data.status,
    };
    if (data.id) {
      const { error } = await context.supabase.from("performance_reviews").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase.from("performance_reviews").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("performance_reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Kudos                                                               */
/* ------------------------------------------------------------------ */

export const listKudos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("kudos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const { data: people } = await context.supabase.from("profiles").select("id, full_name");
    const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));
    return (data ?? []).map((k) => ({
      ...k,
      from_name: nameById.get(k.from_user_id) ?? "—",
      to_name: nameById.get(k.to_user_id) ?? "—",
      mine: k.from_user_id === context.userId,
    }));
  });

export const sendKudos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        to_user_id: z.string().uuid(),
        category: z.enum(["teamwork", "ownership", "innovation", "quality", "support"]),
        message: z.string().min(2).max(500),
        is_public: z.boolean(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    if (data.to_user_id === context.userId) throw new Error("لا يمكن إرسال تقدير لنفسك");
    const { error } = await context.supabase
      .from("kudos")
      .insert({ ...data, from_user_id: context.userId });
    if (error) throw new Error(error.message);

    // In-app notification for the recipient.
    await context.supabase.from("notifications").insert({
      user_id: data.to_user_id,
      type: "kudos",
      title: "تلقيت تقديرًا جديدًا 🎉",
      body: data.message.slice(0, 200),
      link: "/performance/kudos",
    });
    return { ok: true };
  });

export const deleteKudos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kudos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
