/**
 * Procesa las notificaciones del banco que capturó el servicio nativo
 * (Android): al abrir la app, al volver a ella y en vivo mientras está
 * abierta. Registra lo que Finn tiene claro y deja el resto en la bandeja.
 *
 * Es el ÚNICO lugar que escribe lo capturado desde notificaciones (la tarea en
 * segundo plano solo avisa), así que no hay carreras entre procesos.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFinance } from '../state';
import { consentService } from '../services/ConsentService';
import { analizarEntradas } from '../services/CapturaService';
import { resumenAviso, type ItemResultado } from '../utils/capturaMotor';
import { emitRewardToast } from '../utils/rewardToastBus';
import {
  capturaDisponible, confirmarProcesadas, mostrarAviso, obtenerPendientes, suscribirCapturas,
} from '../../modules/finn-captura';

/** Tras aplicar un lote se espera a que el estado se actualice antes de procesar otro. */
const PAUSA_TRAS_LOTE_MS = 1500;

type Finanzas = ReturnType<typeof useFinance>;

interface EstadoCola {
  finanzas: { current: Finanzas };
  ocupado: { current: boolean };
  reintentar: { current: boolean };
}

async function procesarCola(estado: EstadoCola): Promise<void> {
  if (!capturaDisponible) return;
  // Llegó algo mientras se procesaba: se repite al terminar.
  if (estado.ocupado.current) { estado.reintentar.current = true; return; }
  const f = estado.finanzas.current;
  // Sin datos cargados o sin Premium, la cola espera (no se pierde).
  if (f.isLoading || !f.premium.isPremium) return;
  const entradas = obtenerPendientes();
  if (entradas.length === 0) return;

  estado.ocupado.current = true;
  try {
    const lote = await analizarEntradas(
      entradas.map(e => ({ texto: e.texto, recibidoEn: new Date(e.recibidoEn) })),
      {
        categories: f.categories,
        medios: f.mediosPago,
        reglas: f.reglasComercio,
        transactions: f.transactions,
        pendientes: f.capturasPendientes,
        huellasIgnoradas: f.huellasIgnoradas,
        nombresUsuario: [f.user?.name, f.profile?.mainFinancialConcern, ...f.titularesBanco].filter((n): n is string => !!n),
        origen: 'notificacion',
      },
      { usarFinn: await consentService.hasAIConsent() },
    );
    f.aplicarLoteCaptura(lote);
    confirmarProcesadas(entradas.map(e => e.id));
    avisar(lote.items);
  } catch {
    // La cola sigue intacta: se reintenta en la próxima oportunidad.
  } finally {
    setTimeout(() => {
      estado.ocupado.current = false;
      if (estado.reintentar.current) { estado.reintentar.current = false; procesarCola(estado); }
    }, PAUSA_TRAS_LOTE_MS);
  }
}

function avisar(items: ItemResultado[]): void {
  const activa = AppState.currentState === 'active';
  const registrados = items.filter(i => i.estado === 'registrado');
  const porConfirmar = items.filter(i => i.estado === 'por_confirmar').length;
  if (activa && (registrados.length > 0 || porConfirmar > 0)) {
    emitRewardToast({
      title: registrados.length > 0
        ? `Finn registró ${registrados.length} compra${registrados.length > 1 ? 's' : ''}`
        : `${porConfirmar} movimiento${porConfirmar > 1 ? 's' : ''} por confirmar`,
      subtitle: registrados.length === 1
        ? resumenAviso(registrados[0])?.cuerpo ?? ''
        : porConfirmar > 0 ? 'Revísalos en Registro automático' : 'Desde las notificaciones de tu banco',
      icon: 'zap',
      iconColor: '#7C3AED',
      iconBg: '#EDE9FE',
    });
  } else if (!activa) {
    // App viva en segundo plano: el aviso lo da Finn por notificación.
    const ultimo = [...items].reverse().find(i => resumenAviso(i));
    const aviso = ultimo ? resumenAviso(ultimo) : null;
    if (aviso) mostrarAviso(aviso.titulo, aviso.cuerpo);
  }
}

export function useCapturaAutomatica(): void {
  const finance = useFinance();
  // Siempre el estado más reciente, sin re-crear los listeners en cada render.
  const finanzas = useRef(finance);
  const ocupado = useRef(false);
  const reintentar = useRef(false);
  useEffect(() => { finanzas.current = finance; });

  // Al cargar los datos y cuando cambia el estado Premium.
  useEffect(() => {
    procesarCola({ finanzas, ocupado, reintentar });
  }, [finance.isLoading, finance.premium.isPremium]);

  // Al volver a la app y en vivo.
  useEffect(() => {
    if (!capturaDisponible) return;
    const estado = { finanzas, ocupado, reintentar };
    const sub = AppState.addEventListener('change', e => { if (e === 'active') procesarCola(estado); });
    const captura = suscribirCapturas(() => procesarCola(estado));
    return () => { sub.remove(); captura?.remove(); };
  }, []);
}
