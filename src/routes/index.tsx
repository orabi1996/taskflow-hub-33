import { createFileRoute, redirect } from "@tanstack/react-router";
import { ensureAuthSessionFromCookies } from "@/lib/auth-session";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await ensureAuthSessionFromCookies();
    if (session) throw redirect({ to: "/dashboard" });
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
