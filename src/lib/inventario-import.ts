import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { PedidoItem, ProductoInventario } from "@/lib/inventario-store";

export const PLANTILLA_FILENAME = "plantilla_inventario.xlsx";

export function plantillaRowsFromProductos(productos: ProductoInventario[]) {
  return productos.map((p) => ({
    SKU: p.sku,
    Nombre: p.nombre,
    Stock: p.stock,
    Minimo: p.minimo,
    Unidad: p.unidad,
  }));
}

export function downloadInventarioPlantilla(
  productos: ProductoInventario[],
  filename = PLANTILLA_FILENAME,
) {
  const worksheet = XLSX.utils.json_to_sheet(plantillaRowsFromProductos(productos));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario");
  XLSX.writeFile(workbook, filename);
}

export interface ParsedRow {
  sku: string;
  nombre: string;
  stock: number;
  minimo: number;
  unidad: string;
}

export interface InventarioAnalysis {
  totalProductos: number;
  criticos: ParsedRow[];
  saludables: ParsedRow[];
  stockTotal: number;
  alertas: string[];
  sugerencias: {
    sku: string;
    nombre: string;
    cantidadActual: number;
    cantidadPedir: number;
    unidad: string;
  }[];
}

export type InventarioEstado = "critico" | "ok";

export function estadoInventario(stock: number, minimo: number): InventarioEstado {
  return stock < minimo ? "critico" : "ok";
}

/** Normaliza texto para comparar encabezados (sin acentos, minúsculas). */
function normalizeHeaderKey(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeHeaders(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const patterns: Record<string, string[]> = {
    sku: ["sku", "codigo", "code", "id", "referencia"],
    nombre: ["nombre", "name", "producto", "item", "descripcion", "articulo"],
    stock: ["stock", "cantidad", "qty", "quantity", "existencia", "inventario", "actual"],
    minimo: ["minimo", "min", "minimum", "reorder", "puntoreorden", "punto"],
    unidad: ["unidad", "unit", "uom", "medida"],
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

export function hasSkuColumn(headerMap: Record<string, string>): boolean {
  return Object.values(headerMap).includes("sku");
}

export function parseLocaleNumber(value: string | undefined): number {
  if (value == null || value === "") return 0;
  const cleaned = String(value).trim().replace(/\s/g, "");
  const normalized = cleaned.includes(",") && !cleaned.includes(".")
    ? cleaned.replace(",", ".")
    : cleaned.replace(/,/g, "");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

export function rowsFromSheetData(
  data: Record<string, unknown>[],
): { rows: ParsedRow[]; headerMap: Record<string, string> } {
  if (!data.length) return { rows: [], headerMap: {} };

  const headers = Object.keys(data[0] as Record<string, unknown>);
  const headerMap = normalizeHeaders(headers);
  const rows: ParsedRow[] = [];

  for (const raw of data as Record<string, string>[]) {
    const mapped: Record<string, string> = {};
    for (const [origHeader, value] of Object.entries(raw)) {
      const key = headerMap[origHeader];
      if (key) mapped[key] = value != null ? String(value) : "";
    }

    if (mapped.sku?.trim() && mapped.nombre?.trim()) {
      rows.push({
        sku: mapped.sku.trim(),
        nombre: mapped.nombre.trim(),
        stock: parseLocaleNumber(mapped.stock),
        minimo: parseLocaleNumber(mapped.minimo),
        unidad: mapped.unidad?.trim() || "und",
      });
    }
  }

  return { rows, headerMap };
}

export function analyzeInventarioRows(
  rows: ParsedRow[],
  productosBajoMinimo: string,
  masDe50: string,
): InventarioAnalysis {
  const criticos = rows.filter((r) => estadoInventario(r.stock, r.minimo) === "critico");
  const saludables = rows.filter((r) => estadoInventario(r.stock, r.minimo) === "ok");
  const stockTotal = rows.reduce((sum, r) => sum + r.stock, 0);

  const alertas: string[] = [];
  if (criticos.length > 0) alertas.push(`${criticos.length} ${productosBajoMinimo}`);
  if (rows.length > 0 && criticos.length > rows.length * 0.5) alertas.push(masDe50);

  const sugerencias = criticos.map((c) => ({
    sku: c.sku,
    nombre: c.nombre,
    cantidadActual: c.stock,
    cantidadPedir: Math.max(0, c.minimo - c.stock),
    unidad: c.unidad,
  }));

  return {
    totalProductos: rows.length,
    criticos,
    saludables,
    stockTotal,
    alertas,
    sugerencias,
  };
}

export function toStorePayload(rows: ParsedRow[], analysis: InventarioAnalysis) {
  const productos: ProductoInventario[] = rows.map((r) => ({
    sku: r.sku,
    nombre: r.nombre,
    stock: r.stock,
    minimo: r.minimo,
    unidad: r.unidad,
  }));
  const pedido: PedidoItem[] = analysis.sugerencias.map((s) => ({
    sku: s.sku,
    nombre: s.nombre,
    cantidadActual: s.cantidadActual,
    cantidadPedir: s.cantidadPedir,
    unidad: s.unidad,
  }));
  return { productos, pedido };
}

function parseCsvText(csv: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0 && (!results.data || results.data.length === 0)) {
          reject(new Error("parse"));
          return;
        }
        resolve((results.data ?? []) as Record<string, unknown>[]);
      },
      error: () => reject(new Error("read")),
    });
  });
}

function parseCsvFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0 && (!results.data || results.data.length === 0)) {
          reject(new Error("parse"));
          return;
        }
        resolve((results.data ?? []) as Record<string, unknown>[]);
      },
      error: () => reject(new Error("read")),
    });
  });
}

export async function readSpreadsheetFile(file: File): Promise<Record<string, unknown>[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const isExcel = ["xlsx", "xls"].includes(ext ?? "");
  const isCsvOrTxt = ["csv", "txt"].includes(ext ?? "");

  if (!isExcel && !isCsvOrTxt) throw new Error("format");

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("empty");
    const worksheet = workbook.Sheets[firstSheetName];
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    return parseCsvText(csv);
  }

  return parseCsvFile(file);
}

export interface InventarioImportMessages {
  formatoNoSoportado: string;
  archivoVacio: string;
  sinColumnasSKU: string;
  sinDatosValidos: string;
  errorProcesar: string;
  errorLeer: string;
  productosBajoMinimo: string;
  masDe50: string;
}

export type InventarioImportResult =
  | {
      ok: true;
      fileName: string;
      rows: ParsedRow[];
      analysis: InventarioAnalysis;
      productos: ProductoInventario[];
      pedido: PedidoItem[];
    }
  | { ok: false; error: string };

export async function importInventarioFile(
  file: File,
  messages: InventarioImportMessages,
): Promise<InventarioImportResult> {
  try {
    const sheetData = await readSpreadsheetFile(file);
    if (!sheetData.length) {
      return { ok: false, error: messages.archivoVacio };
    }

    const { rows, headerMap } = rowsFromSheetData(sheetData);
    if (!hasSkuColumn(headerMap)) {
      return { ok: false, error: messages.sinColumnasSKU };
    }
    if (rows.length === 0) {
      return { ok: false, error: messages.sinDatosValidos };
    }

    const analysis = analyzeInventarioRows(
      rows,
      messages.productosBajoMinimo,
      messages.masDe50,
    );
    const { productos, pedido } = toStorePayload(rows, analysis);

    return {
      ok: true,
      fileName: file.name,
      rows,
      analysis,
      productos,
      pedido,
    };
  } catch (e) {
    const code = e instanceof Error ? e.message : "";
    if (code === "format") return { ok: false, error: messages.formatoNoSoportado };
    if (code === "read") return { ok: false, error: messages.errorLeer };
    return { ok: false, error: messages.errorProcesar };
  }
}
