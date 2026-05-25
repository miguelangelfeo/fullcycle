export type EstadoIndicador = "success" | "warning" | "destructive";

const ESTADO_ALIASES: Record<EstadoIndicador, string[]> = {
  success: ["ok", "good", "success", "exito", "verde", "saludable", "bien"],
  warning: ["warning", "precaucion", "precaución", "amarillo", "progreso", "enprogreso", "medio"],
  destructive: ["critical", "critico", "crítico", "destructive", "rojo", "mal", "alerta", "urgente"],
};

/** Interpreta columna Estado del Excel (ok / precaución / crítico, etc.). */
export function parseEstadoDesdeTexto(value: string | undefined): EstadoIndicador | null {
  if (!value?.trim()) return null;
  const n = value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  for (const [estado, aliases] of Object.entries(ESTADO_ALIASES) as [EstadoIndicador, string[]][]) {
    if (aliases.some((a) => n === a || n.includes(a))) return estado;
  }
  return null;
}

/** success ≥ meta; warning ≥ 50% meta; destructive < 50% meta */
export function calcularEstadoMeta(reduccion: number, meta: number): EstadoIndicador {
  if (meta <= 0) return reduccion > 0 ? "success" : "destructive";
  if (reduccion >= meta) return "success";
  if (reduccion >= meta * 0.5) return "warning";
  return "destructive";
}

export function subtituloEstadoMeta(
  estado: EstadoIndicador,
  labels: { cumpliendo: string; enProgreso: string; critico: string },
): string {
  if (estado === "success") return labels.cumpliendo;
  if (estado === "warning") return labels.enProgreso;
  return labels.critico;
}

/** 1.0 = meta cumplida; escala hacia abajo según reducción vs meta (mín. 20%). */
export function calcularFactorDesempeno(reduccion: number, meta: number): number {
  if (meta <= 0) return reduccion > 0 ? 1 : 0.2;
  const ratio = reduccion / meta;
  return Math.min(Math.max(ratio, 0.2), 1.15);
}

export interface MetricasAmbientalesBase {
  comidaRescatada: number;
  co2Evitado: number;
  metanoEvitado: number;
  equivalencias: { arboles: number; viajesAuto: number };
}

export interface MetricasAmbientalesSimuladas extends MetricasAmbientalesBase {
  factor: number;
}

export function calcularMetricasSimuladas(
  reduccion: number,
  meta: number,
  base: MetricasAmbientalesBase,
): MetricasAmbientalesSimuladas {
  const factor = calcularFactorDesempeno(reduccion, meta);
  return {
    factor,
    comidaRescatada: Math.round(base.comidaRescatada * factor),
    co2Evitado: Math.round(base.co2Evitado * factor),
    metanoEvitado: Math.round(base.metanoEvitado * factor),
    equivalencias: {
      arboles: Math.round(base.equivalencias.arboles * factor),
      viajesAuto: Math.round(base.equivalencias.viajesAuto * factor),
    },
  };
}

export function escalarSerieSemanal<T extends { rescatadoKg: number; co2: number }>(
  datos: T[],
  factor: number,
): T[] {
  return datos.map((row) => ({
    ...row,
    rescatadoKg: Math.round(row.rescatadoKg * factor),
    co2: Math.round(row.co2 * factor),
  }));
}

export const ESTADO_CHART_FILL: Record<EstadoIndicador, string> = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  destructive: "var(--color-destructive)",
};

export const ESTADO_CARD_STYLES: Record<
  EstadoIndicador,
  { box: string; icon: string; value: string }
> = {
  success: {
    box: "bg-success/5 border-success/20",
    icon: "text-success",
    value: "text-success",
  },
  warning: {
    box: "bg-warning/5 border-warning/20",
    icon: "text-warning",
    value: "text-warning",
  },
  destructive: {
    box: "bg-destructive/5 border-destructive/20",
    icon: "text-destructive",
    value: "text-destructive",
  },
};
