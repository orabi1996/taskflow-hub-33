import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// One-shot seed endpoint to provision the admin account from secrets.
// Safe to call multiple times — idempotent.
export const Route = createFileRoute("/api/public/seed-admin")({
  server: {
    handlers: {
      GET: async () => {
        const email = process.env.ADMIN_SEED_EMAIL;
        const password = process.env.ADMIN_SEED_PASSWORD;
        const fullName = process.env.ADMIN_SEED_FULL_NAME ?? "System Administrator";

        if (!email || !password) {
          return Response.json(
            { ok: false, error: "ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD غير مضبوطين" },
            { status: 400 }
          );
        }

        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        if (listErr) {
          return Response.json({ ok: false, step: "listUsers", error: listErr.message }, { status: 500 });
        }

        let user = list.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());

        if (!user) {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName },
          });
          if (error) {
            return Response.json({ ok: false, step: "createUser", error: error.message }, { status: 500 });
          }
          user = data.user!;
        } else {
          await supabaseAdmin.auth.admin.updateUserById(user.id, {
            password,
            email_confirm: true,
          });
        }

        await supabaseAdmin
          .from("profiles")
          .upsert(
            { id: user.id, full_name: fullName, email, job_title: "System Administrator" },
            { onConflict: "id" }
          );

        await supabaseAdmin.from("user_roles").delete().eq("user_id", user.id);
        const { error: rErr } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: user.id, role: "admin" });
        if (rErr) {
          return Response.json({ ok: false, step: "assignRole", error: rErr.message }, { status: 500 });
        }

        return Response.json({ ok: true, userId: user.id, email });
      },
    },
  },
});
