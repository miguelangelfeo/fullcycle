import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { ProduccionView } from "@/components/ProduccionView";
import { AppShell } from "@/components/AppShell";
import { useEffect } from "react";

export const Route = createFileRoute("/produccion")({
  component: ProduccionPage,
});

function ProduccionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate({ to: "/" });
    else if (!["gerente", "cocina"].includes(user.role)) navigate({ to: "/" });
  }, [user, navigate]);

  if (!user) return null;

  return (
    <AppShell>
      <ProduccionView />
    </AppShell>
  );
}
