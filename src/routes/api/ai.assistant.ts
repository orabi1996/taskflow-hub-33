import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// AI assistant — uses Lovable AI Gateway (no API key required).
// Accepts an authenticated user JWT, fetches their context (tasks, projects), and answers via gemini.
export const Route = createFileRoute("/api/ai/assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return Response.json({ error: "AI not configured" }, { status: 500 });

        const auth = request.headers.get("authorization");
        if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

        const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const anon = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!url || !anon) return Response.json({ error: "DB not configured" }, { status: 500 });

        const sb = createClient(url, anon, {
          global: { headers: { Authorization: auth } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: userData } = await sb.auth.getUser();
        if (!userData?.user) return Response.json({ error: "unauthorized" }, { status: 401 });

        let body: { mode?: string; prompt?: string; context?: unknown };
        try { body = await request.json(); } catch { return Response.json({ error: "invalid body" }, { status: 400 }); }

        const mode = body.mode ?? "chat";
        const userPrompt = String(body.prompt ?? "").slice(0, 4000);

        // Fetch user context (their pending tasks)
        const { data: tasks } = await sb
          .from("tasks")
          .select("id, title, status, start_at, end_at, project:projects(name)")
          .order("start_at", { ascending: false })
          .limit(20);

        const taskSummary = (tasks ?? []).map((t) => {
          const project = (t as { project?: { name?: string } | null }).project?.name ?? "بلا مشروع";
          return `- [${t.status}] ${t.title} (${project}) — ${t.end_at ?? "بدون موعد"}`;
        }).join("\n");

        let systemPrompt = "أنت مساعد ذكي داخل نظام إدارة مهام. أجب بالعربية باختصار ووضوح.";
        let userMessage = userPrompt;

        if (mode === "summarize_day") {
          systemPrompt += " قدّم ملخصاً يومياً لمهام المستخدم: الأولويات، المتأخرات، اقتراحات.";
          userMessage = `هذه مهامي الحالية:\n${taskSummary}\n\nاكتب ملخصاً يومياً موجزاً (5-7 أسطر) مع 3 أولويات.`;
        } else if (mode === "suggest_priority") {
          systemPrompt += " رتّب المهام حسب الأهمية مع تبرير قصير لكل واحدة.";
          userMessage = `رتّب هذه المهام حسب الأولوية:\n${taskSummary}`;
        } else if (mode === "draft_email") {
          systemPrompt += " اكتب إيميلاً مهنياً قصيراً بناءً على طلب المستخدم.";
        } else {
          // chat mode — append context
          if (taskSummary) userMessage = `سياق مهامي:\n${taskSummary}\n\nسؤالي: ${userPrompt}`;
        }

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
          }),
        });

        if (aiRes.status === 429) return Response.json({ error: "تم تجاوز حد الاستخدام، حاول لاحقاً." }, { status: 429 });
        if (aiRes.status === 402) return Response.json({ error: "يحتاج رصيد إضافي في Lovable AI." }, { status: 402 });
        if (!aiRes.ok) {
          const t = await aiRes.text();
          return Response.json({ error: "AI failed", detail: t }, { status: 500 });
        }

        const json = await aiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
        const reply = json.choices?.[0]?.message?.content ?? "";
        return Response.json({ reply });
      },
    },
  },
});
