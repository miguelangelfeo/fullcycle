import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { SostenibilidadView } from "@/components/SostenibilidadView";
import { AppShell } from "@/components/AppShell";
import { useEffect } from "react";

export const Route = createFileRoute("/sostenibilidad")({
  component: SostenibilidadPage,
});

function SostenibilidadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate({ to: "/" });
    else if (!["gerente", "sostenibilidad"].includes(user.role)) navigate({ to: "/" });
  }, [user, navigate]);

  if (!user) return null;

  return (
    <AppShell>
      <SostenibilidadView />
    </AppShell>
  );
}
