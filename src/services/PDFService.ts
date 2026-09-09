import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
const documentDirectory: string = (FileSystem as any).documentDirectory ?? '';
import { generarHTMLReporte, type DatosReporte } from '../utils/pdfUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

export type EstadoExportacion = 'idle' | 'generando' | 'guardando' | 'listo' | 'error';

export interface ReporteGuardado {
  uri:    string;
  nombre: string;
  fecha:  string; // ISO
  size:   number; // bytes
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nombreArchivo(mes: number, año: number): string {
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `FinancyAI_Reporte_${MESES[mes] ?? mes}_${año}.pdf`;
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function generarYCompartirPDF(
  datos: DatosReporte,
  onEstado?: (estado: EstadoExportacion) => void,
): Promise<void> {
  try {
    onEstado?.('generando');
    const html = generarHTMLReporte(datos);

    const { uri } = await Print.printToFileAsync({ html, base64: false });

    onEstado?.('guardando');
    const nombre  = nombreArchivo(datos.config.mes, datos.config.año);
    const destUri = `${documentDirectory}${nombre}`;
    await FileSystem.moveAsync({ from: uri, to: destUri });

    onEstado?.('listo');
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(destUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Reporte Financiero — ${nombre}`,
        UTI: 'com.adobe.pdf',
      });
    }
  } catch (err) {
    onEstado?.('error');
    throw err;
  }
}

export async function guardarPDFLocal(
  datos: DatosReporte,
  onEstado?: (estado: EstadoExportacion) => void,
): Promise<string> {
  onEstado?.('generando');
  const html = generarHTMLReporte(datos);

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  onEstado?.('guardando');
  const nombre  = nombreArchivo(datos.config.mes, datos.config.año);
  const destUri = `${documentDirectory}${nombre}`;
  await FileSystem.moveAsync({ from: uri, to: destUri });

  onEstado?.('listo');
  return destUri;
}

export async function imprimirReporte(datos: DatosReporte): Promise<void> {
  const html = generarHTMLReporte(datos);
  await Print.printAsync({ html });
}

export async function listarReportesGuardados(): Promise<ReporteGuardado[]> {
  try {
    const dir = documentDirectory;
    if (!dir) return [];

    const files = await FileSystem.readDirectoryAsync(dir);
    const pdfs  = files.filter(f => f.startsWith('FinancyAI_') && f.endsWith('.pdf'));

    const reportes: ReporteGuardado[] = [];
    for (const nombre of pdfs) {
      const uri  = `${dir}${nombre}`;
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        reportes.push({
          uri,
          nombre,
          fecha: (info as any).modificationTime
            ? new Date(((info as any).modificationTime as number) * 1000).toISOString()
            : new Date().toISOString(),
          size:  (info as any).size ?? 0,
        });
      }
    }

    return reportes.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  } catch {
    return [];
  }
}

export async function eliminarReporte(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function compartirReporteGuardado(uri: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) return;
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
  });
}
