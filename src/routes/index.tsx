import { createFileRoute, redirect, isRedirect } from "@tanstack/react-router";
import { ensureAuthSessionFromCookies } from "@/lib/auth-session";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "CRM-X | إدارة المشاريع وفرق العمل" },
    { name: "description", content: "منظومة CRM-X لمتابعة المشاريع والمهام وأداء الموظفين." },
    { property: "og:title", content: "CRM-X | إدارة المشاريع وفرق العمل" },
    { property: "og:description", content: "منظومة CRM-X لمتابعة المشاريع والمهام وأداء الموظفين." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: async () => {
    try {
      const session = await ensureAuthSessionFromCookies();
      if (session) throw redirect({ to: "/dashboard" });
    } catch (err) {
      if (isRedirect(err)) throw err;
      console.warn("[index.beforeLoad] Non-fatal session lookup error:", err);
    }
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
