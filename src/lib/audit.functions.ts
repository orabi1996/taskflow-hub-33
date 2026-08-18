// Centralized audit log server functions.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const eventSchema = z.object({
  actorId: z.string().uuid().nullable().optional(),
  actorEmail: z.string().email().max(255).nullable().optional(),
  eventType: z.string().min(1).max(80),
  severity: z.enum(["info", "warn", "critical"]).default("info"),
  resourceType: z.string().max(80).nullable().optional(),
  resourceId: z.string().max(120).nullable().optional(),
  oldValue: z.any().nullable().optional(),
  newValue: z.any().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
});

export const recordAuditEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => eventSchema.parse(input))
  .handler(async ({ data }) => {
    const ip = getRequestIP({ xForwardedFor: true }) || null;
    const ua = getRequestHeader("user-agent")?.slice(0, 500) || null;
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: data.actorId ?? null,
      actor_email: data.actorEmail ?? null,
      event_type: data.eventType,
      severity: data.severity,
      resource_type: data.resourceType ?? null,
      resource_id: data.resourceId ?? null,
      old_value: data.oldValue ?? null,
      new_value: data.newValue ?? null,
      metadata: data.metadata ?? null,
      ip,
      user_agent: ua,
    });
    return { ok: true };
  });

const listSchema = z.object({
  limit: z.number().int().min(1).max(500).default(50),
  offset: z.number().int().min(0).default(0),
  eventType: z.string().max(80).optional(),
  severity: z.enum(["info", "warn", "critical"]).optional(),
  search: z.string().max(120).optional(),
  resourceType: z.string().max(80).optional(),
  resourceId: z.string().max(120).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  withCount: z.boolean().optional(),
});

export const listAuditEvents = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("audit_logs")
      .select(
        "id, created_at, actor_email, event_type, severity, resource_type, resource_id, ip, metadata, old_value, new_value, user_agent",
        data.withCount ? { count: "exact" } : undefined,
      )
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.eventType) q = q.ilike("event_type", `%${data.eventType}%`);
    if (data.severity) q = q.eq("severity", data.severity);
    if (data.resourceType) q = q.ilike("resource_type", `%${data.resourceType}%`);
    if (data.resourceId) q = q.ilike("resource_id", `%${data.resourceId}%`);
    if (data.startDate) q = q.gte("created_at", data.startDate);
    if (data.endDate) q = q.lte("created_at", data.endDate);
    if (data.search) {
      const s = data.search.replace(/[%,()]/g, "");
      q = q.or(
        `actor_email.ilike.%${s}%,event_type.ilike.%${s}%,resource_type.ilike.%${s}%`,
      );
    }
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? null };
  });
