import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { ComprasView } from "@/components/ComprasView";
import { AppShell } from "@/components/AppShell";
import { useEffect } from "react";

export const Route = createFileRoute("/compras")({
  component: ComprasPage,
});

function ComprasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate({ to: "/" });
    else if (!["gerente", "compras"].includes(user.role)) navigate({ to: "/" });
  }, [user, navigate]);

  if (!user) return null;

  return (
    <AppShell>
      <ComprasView />
    </AppShell>
  );
}
