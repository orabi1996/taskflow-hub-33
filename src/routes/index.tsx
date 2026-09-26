import { createFileRoute, redirect, isRedirect } from "@tanstack/react-router";
import { ensureAuthSessionFromCookies } from "@/lib/auth-session";

export const Route = createFileRoute("/")({
  ssr: false,
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
