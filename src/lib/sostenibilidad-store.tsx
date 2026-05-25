import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { EstadoIndicador } from "@/lib/sostenibilidad-estado";

export interface FilaSostenibilidadDetalle {
  semana: string;
  comidaRescatada: number;
  reduccionPorcentual?: number;
  metaReduccion?: number;
  co2Evitado?: number;
  metanoEvitado?: number;
  arboles?: number;
  kmAuto?: number;
  estado?: EstadoIndicador;
  esResumen: boolean;
}

export interface SemanaImpacto {
  semana: string;
  rescatadoKg: number;
  co2: number;
}

export interface ReporteSostenibilidad {
  fileName?: string;
  reduccionPorcentual: number;
  metaReduccion: number;
  estado: EstadoIndicador;
  estadoFuente: "archivo" | "calculado";
  comidaRescatada: number;
  co2Evitado: number;
  metanoEvitado: number;
  equivalencias: { arboles: number; viajesAuto: number };
  impactoSemanal: SemanaImpacto[];
  filasDetalle: FilaSostenibilidadDetalle[];
  ultimaActualizacion: string;
}

interface SostenibilidadState {
  reporte: ReporteSostenibilidad | null;
}

interface SostenibilidadContextType extends SostenibilidadState {
  setReporte: (reporte: ReporteSostenibilidad) => void;
  clearReporte: () => void;
  tieneReporte: boolean;
}

const STORAGE_KEY = "fc_sostenibilidad";

const INITIAL_STATE: SostenibilidadState = { reporte: null };

function loadFromStorage(): SostenibilidadState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STATE;
    return { reporte: JSON.parse(raw) as ReporteSostenibilidad };
  } catch {
    return INITIAL_STATE;
  }
}

function saveToStorage(state: SostenibilidadState) {
  try {
    if (state.reporte) localStorage.setItem(STORAGE_KEY, JSON.stringify(state.reporte));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

const SostenibilidadContext = createContext<SostenibilidadContextType | null>(null);

export function SostenibilidadProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SostenibilidadState>(INITIAL_STATE);

  useEffect(() => {
    setState(loadFromStorage());
  }, []);

  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  const setReporte = (reporte: ReporteSostenibilidad) => {
    setState({ reporte });
  };

  const clearReporte = () => {
    setState(INITIAL_STATE);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
  };

  return (
    <SostenibilidadContext.Provider
      value={{
        ...state,
        setReporte,
        clearReporte,
        tieneReporte: state.reporte != null,
      }}
    >
      {children}
    </SostenibilidadContext.Provider>
  );
}

export function useSostenibilidad() {
  const ctx = useContext(SostenibilidadContext);
  if (!ctx) throw new Error("useSostenibilidad debe estar dentro de SostenibilidadProvider");
  return ctx;
}
