import * as XLSX from "xlsx";
import { readSpreadsheetFile, parseLocaleNumber } from "@/lib/inventario-import";
import {
  calcularEstadoMeta,
  parseEstadoDesdeTexto,
  type EstadoIndicador,
} from "@/lib/sostenibilidad-estado";
import type {
  ReporteSostenibilidad,
  SemanaImpacto,
  FilaSostenibilidadDetalle,
} from "@/lib/sostenibilidad-store";

export const PLANTILLA_SOSTENIBILIDAD_FILENAME = "plantilla_sostenibilidad.xlsx";

const CO2_FACTOR = 2.6;
const METANO_FACTOR = 0.15;
const ARBOLES_FACTOR = 0.117;
const KM_AUTO_FACTOR = 6.53;

function normalizeHeaderKey(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeSostenibilidadHeaders(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const patterns: Record<string, string[]> = {
    semana: ["semana", "week", "periodo", "mes"],
    comidaRescatada: ["comidarescatada", "rescatado", "rescatadokg", "comida", "kgrescatados", "alimentorescatado"],
    reduccion: ["reduccion", "reduccionporcentual", "reduccionpct", "porcentajereduccion"],
    meta: ["metareduccion", "meta", "objetivo", "metadesperdicio"],
    co2: ["co2", "co2evitado", "co2kg"],
    metano: ["metano", "metanoevitado", "metanokg"],
    arboles: ["arboles", "arbol", "trees"],
    kmAuto: ["kmauto", "km", "viajes", "autokm", "kilometros"],
    estado: ["estado", "status", "situacion", "nivel"],
  };

  for (const header of headers) {
    const normalized = normalizeHeaderKey(header);
    for (const [key, aliases] of Object.entries(patterns)) {
      if (aliases.some((a) => normalized.includes(a) || a.includes(normalized))) {
        map[header] = key;
        break;
      }
    }
  }
  return map;
}

function isFilaResumen(semana: string): boolean {
  const s = semana.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ["total", "resumen", "summary", "general", "promedio", "global"].some((k) => s.includes(k));
}

function mapRawRow(raw: Record<string, unknown>, headerMap: Record<string, string>): FilaSostenibilidadDetalle | null {
  const mapped: Record<string, string> = {};
  for (const [orig, value] of Object.entries(raw)) {
    const key = headerMap[orig];
    if (key) mapped[key] = value != null ? String(value).trim() : "";
  }

  const comida = parseLocaleNumber(mapped.comidaRescatada);
  if (comida <= 0 && !mapped.semana) return null;

  const semana = mapped.semana?.trim() || (comida > 0 ? "General" : "");
  const reduccion = mapped.reduccion ? parseLocaleNumber(mapped.reduccion) : undefined;
  const meta = mapped.meta ? parseLocaleNumber(mapped.meta) : undefined;
  const estadoTexto = parseEstadoDesdeTexto(mapped.estado);

  return {
    semana,
    comidaRescatada: comida,
    reduccionPorcentual: reduccion,
    metaReduccion: meta,
    co2Evitado: mapped.co2 ? parseLocaleNumber(mapped.co2) : undefined,
    metanoEvitado: mapped.metano ? parseLocaleNumber(mapped.metano) : undefined,
    arboles: mapped.arboles ? parseLocaleNumber(mapped.arboles) : undefined,
    kmAuto: mapped.kmAuto ? parseLocaleNumber(mapped.kmAuto) : undefined,
    estado: estadoTexto ?? undefined,
    esResumen: isFilaResumen(semana),
  };
}

function parseFilas(data: Record<string, unknown>[]): {
  filas: FilaSostenibilidadDetalle[];
  headerMap: Record<string, string>;
} {
  if (!data.length) return { filas: [], headerMap: {} };
  const headerMap = normalizeSostenibilidadHeaders(Object.keys(data[0]));
  const filas: FilaSostenibilidadDetalle[] = [];
  for (const raw of data) {
    const row = mapRawRow(raw as Record<string, unknown>, headerMap);
    if (row) filas.push(row);
  }
  return { filas, headerMap };
}

function hasComidaColumn(headerMap: Record<string, string>): boolean {
  return Object.values(headerMap).includes("comidaRescatada");
}

function buildReporte(filas: FilaSostenibilidadDetalle[], fileName: string): ReporteSostenibilidad {
  const resumen = filas.find((f) => f.esResumen) ?? filas[filas.length - 1];
  const semanales = filas.filter((f) => !f.esResumen && f.comidaRescatada > 0);

  const comidaTotal =
    resumen?.comidaRescatada && resumen.esResumen
      ? resumen.comidaRescatada
      : semanales.reduce((s, f) => s + f.comidaRescatada, 0);

  const reduccion =
    resumen?.reduccionPorcentual ??
    [...filas].reverse().find((f) => f.reduccionPorcentual != null && f.reduccionPorcentual > 0)?.reduccionPorcentual ??
    0;

  const meta =
    resumen?.metaReduccion ??
    [...filas].reverse().find((f) => f.metaReduccion != null && f.metaReduccion > 0)?.metaReduccion ??
    10;

  const co2Total =
    resumen?.co2Evitado ??
    (semanales.some((f) => f.co2Evitado != null)
      ? semanales.reduce((s, f) => s + (f.co2Evitado ?? 0), 0)
      : Math.round(comidaTotal * CO2_FACTOR));

  const metanoTotal =
    resumen?.metanoEvitado ??
    (semanales.some((f) => f.metanoEvitado != null)
      ? semanales.reduce((s, f) => s + (f.metanoEvitado ?? 0), 0)
      : Math.round(comidaTotal * METANO_FACTOR));

  const arboles =
    resumen?.arboles ?? Math.round(comidaTotal * ARBOLES_FACTOR);
  const viajesAuto =
    resumen?.kmAuto ?? Math.round(comidaTotal * KM_AUTO_FACTOR);

  const estadoArchivo =
    resumen?.estado ??
    [...filas].reverse().find((f) => f.estado)?.estado ??
    null;

  const estado = estadoArchivo ?? calcularEstadoMeta(reduccion, meta);

  let impactoSemanal: SemanaImpacto[] = semanales.map((f) => ({
    semana: f.semana,
    rescatadoKg: f.comidaRescatada,
    co2: f.co2Evitado ?? Math.round(f.comidaRescatada * CO2_FACTOR),
  }));

  if (impactoSemanal.length === 0 && comidaTotal > 0) {
    const parte = Math.round(comidaTotal / 4);
    impactoSemanal = [
      { semana: "Sem 1", rescatadoKg: parte, co2: Math.round(parte * CO2_FACTOR) },
      { semana: "Sem 2", rescatadoKg: parte, co2: Math.round(parte * CO2_FACTOR) },
      { semana: "Sem 3", rescatadoKg: parte, co2: Math.round(parte * CO2_FACTOR) },
      { semana: "Sem 4", rescatadoKg: comidaTotal - parte * 3, co2: Math.round((comidaTotal - parte * 3) * CO2_FACTOR) },
    ];
  }

  return {
    fileName,
    reduccionPorcentual: reduccion,
    metaReduccion: meta,
    estado,
    estadoFuente: estadoArchivo ? "archivo" : "calculado",
    comidaRescatada: comidaTotal,
    co2Evitado: co2Total,
    metanoEvitado: metanoTotal,
    equivalencias: { arboles, viajesAuto },
    impactoSemanal,
    filasDetalle: filas,
    ultimaActualizacion: new Date().toISOString(),
  };
}

export interface SostenibilidadImportMessages {
  formatoNoSoportado: string;
  archivoVacio: string;
  sinColumnaComida: string;
  sinDatosValidos: string;
  errorProcesar: string;
  errorLeer: string;
}

export type SostenibilidadImportResult =
  | { ok: true; reporte: ReporteSostenibilidad }
  | { ok: false; error: string };

export async function importSostenibilidadFile(
  file: File,
  messages: SostenibilidadImportMessages,
): Promise<SostenibilidadImportResult> {
  try {
    const sheetData = await readSpreadsheetFile(file);
    if (!sheetData.length) return { ok: false, error: messages.archivoVacio };

    const { filas, headerMap } = parseFilas(sheetData);
    if (!hasComidaColumn(headerMap)) {
      return { ok: false, error: messages.sinColumnaComida };
    }
    if (filas.length === 0 || filas.every((f) => f.comidaRescatada <= 0)) {
      return { ok: false, error: messages.sinDatosValidos };
    }

    const reporte = buildReporte(filas, file.name);
    return { ok: true, reporte };
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "format") return { ok: false, error: messages.formatoNoSoportado };
    if (code === "read") return { ok: false, error: messages.errorLeer };
    return { ok: false, error: messages.errorProcesar };
  }
}

/** Filas de ejemplo para plantilla (4 semanas + métricas en la última fila). */
export const PLANTILLA_SOSTENIBILIDAD_ROWS = [
  {
    Semana: "Sem 1",
    ComidaRescatada: 280,
    ReduccionPorcentual: "",
    MetaReduccion: "",
    CO2Evitado: 728,
    MetanoEvitado: "",
    Arboles: "",
    KmAuto: "",
    Estado: "",
  },
  {
    Semana: "Sem 2",
    ComidaRescatada: 310,
    ReduccionPorcentual: "",
    MetaReduccion: "",
    CO2Evitado: 806,
    MetanoEvitado: "",
    Arboles: "",
    KmAuto: "",
    Estado: "",
  },
  {
    Semana: "Sem 3",
    ComidaRescatada: 320,
    ReduccionPorcentual: "",
    MetaReduccion: "",
    CO2Evitado: 832,
    MetanoEvitado: "",
    Arboles: "",
    KmAuto: "",
    Estado: "",
  },
  {
    Semana: "Sem 4",
    ComidaRescatada: 330,
    ReduccionPorcentual: 12.5,
    MetaReduccion: 10,
    CO2Evitado: 858,
    MetanoEvitado: 186,
    Arboles: 145,
    KmAuto: 8100,
    Estado: "ok",
  },
];

export function downloadSostenibilidadPlantilla(filename = PLANTILLA_SOSTENIBILIDAD_FILENAME) {
  const worksheet = XLSX.utils.json_to_sheet(PLANTILLA_SOSTENIBILIDAD_ROWS);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sostenibilidad");
  XLSX.writeFile(workbook, filename);
}

/** Columnas esperadas (documentación en UI). */
export const COLUMNAS_SOSTENIBILIDAD = [
  { key: "Semana", required: false, ejemplo: "Sem 1" },
  { key: "ComidaRescatada", required: true, ejemplo: "280" },
  { key: "ReduccionPorcentual", required: false, ejemplo: "12.5" },
  { key: "MetaReduccion", required: false, ejemplo: "10" },
  { key: "CO2Evitado", required: false, ejemplo: "728" },
  { key: "MetanoEvitado", required: false, ejemplo: "186" },
  { key: "Arboles", required: false, ejemplo: "145" },
  { key: "KmAuto", required: false, ejemplo: "8100" },
  { key: "Estado", required: false, ejemplo: "ok / precaucion / critico" },
] as const;
