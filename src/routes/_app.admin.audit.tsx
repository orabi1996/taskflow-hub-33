import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/admin/audit")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/audit" });
  },
});
