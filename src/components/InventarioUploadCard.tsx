import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle,
  TrendingDown, TrendingUp, BarChart3, X,
} from "lucide-react";
import { Button } from "./ui/button";
import { useLang } from "@/lib/lang-context";
import { inventario as catalogoInventario } from "@/lib/mock-data";
import { useInventario } from "@/lib/inventario-store";
import {
  downloadInventarioPlantilla,
  importInventarioFile,
  type InventarioAnalysis,
} from "@/lib/inventario-import";

interface InventarioUploadCardProps {
  /** Vista compacta cuando ya hay datos cargados */
  compact?: boolean;
}

export function InventarioUploadCard({ compact = false }: InventarioUploadCardProps) {
  const { t } = useLang();
  const { inventario, setInventario, tieneDataReal, ultimaActualizacion } = useInventario();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<InventarioAnalysis | null>(null);

  const messages = {
    formatoNoSoportado: t.formatoNoSoportado,
    archivoVacio: t.archivoVacio,
    sinColumnasSKU: t.sinColumnasSKU,
    sinDatosValidos: t.sinDatosValidos,
    errorProcesar: t.errorProcesar,
    errorLeer: t.errorLeer,
    productosBajoMinimo: t.productosBajoMinimo,
    masDe50: t.masDe50,
  };

  const resetPreview = () => {
    setError(null);
    setAnalysis(null);
    setFileName(null);
  };

  const processFile = useCallback(async (f: File) => {
    resetPreview();
    setParsing(true);
    const result = await importInventarioFile(f, messages);
    setParsing(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setFileName(result.fileName);
    setAnalysis(result.analysis);
    setInventario(result.productos, result.pedido);
  }, [messages, setInventario]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) void processFile(f);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void processFile(f);
    e.target.value = "";
  };

  const descargarPlantilla = () => {
    const productos =
      inventario.length > 0
        ? inventario
        : catalogoInventario.map(({ sku, nombre, stock, minimo, unidad }) => ({
            sku,
            nombre,
            stock,
            minimo,
            unidad,
          }));
    downloadInventarioPlantilla(productos);
  };

  const showCompact = compact && tieneDataReal && !analysis;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-card ${showCompact ? "p-4" : "p-5"}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Upload size={16} className="text-primary" />
            {t.subirDocTitle}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
            {t.subirDocDesc}
          </p>
          {tieneDataReal && ultimaActualizacion && (
            <p className="text-[10px] text-success mt-1 flex items-center gap-1">
              <CheckCircle size={10} />
              {t.datosCargados ?? "Datos cargados"} —{" "}
              {new Date(ultimaActualizacion).toLocaleString("es-CO", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={descargarPlantilla} className="shrink-0">
          <FileSpreadsheet size={14} className="mr-1" />
          {t.descargarPlantilla ?? "Descargar Plantilla"}
        </Button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`mt-4 relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
          showCompact ? "p-4" : "p-6"
        } ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}`}
      >
        <FileSpreadsheet size={showCompact ? 28 : 36} className="text-muted-foreground" />
        <p className="text-sm font-medium">{t.arrastraCSV}</p>
        <p className="text-xs text-muted-foreground">{t.haceClic}</p>
        <p className="text-[10px] text-muted-foreground">.csv · .txt · .xlsx · .xls</p>
        <input
          type="file"
          ref={fileInputRef}
          accept=".csv,.txt,.xlsx,.xls"
          onChange={handleFileInput}
          className="hidden"
        />
        {parsing && (
          <p className="text-xs text-primary animate-pulse absolute bottom-3">{t.analizando}</p>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {analysis && fileName && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle size={14} className="text-success shrink-0" />
            <span>
              <strong>{fileName}</strong> {t.archivoAnalizado}
            </span>
            <Button variant="ghost" size="sm" className="ml-auto h-6 px-2" onClick={resetPreview}>
              <X size={12} />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <BarChart3 size={18} className="text-primary" />
              <div>
                <p className="text-lg font-bold">{analysis.totalProductos}</p>
                <p className="text-xs text-muted-foreground">{t.productos}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <TrendingDown size={18} className="text-destructive" />
              <div>
                <p className="text-lg font-bold">{analysis.criticos.length}</p>
                <p className="text-xs text-muted-foreground">{t.criticos}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <TrendingUp size={18} className="text-success" />
              <div>
                <p className="text-lg font-bold">{analysis.saludables.length}</p>
                <p className="text-xs text-muted-foreground">{t.saludables}</p>
              </div>
            </div>
          </div>

          {analysis.alertas.length > 0 && (
            <div className="space-y-1.5">
              {analysis.alertas.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs font-medium text-warning"
                >
                  <AlertTriangle size={12} />
                  {a}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {t.estadoAutoDesc ??
              "Cada producto se marca Crítico si el stock es menor al mínimo; de lo contrario OK. El pedido sugerido incluye solo los críticos."}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
