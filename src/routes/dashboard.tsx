import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { DashboardView } from "@/components/DashboardView";
import { AppShell } from "@/components/AppShell";
import { useEffect } from "react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate({ to: "/" });
    else if (!["gerente", "sostenibilidad"].includes(user.role)) navigate({ to: "/" });
  }, [user, navigate]);

  if (!user) return null;

  return (
    <AppShell>
      <DashboardView />
    </AppShell>
  );
}
