/**
 * Tarea JS en segundo plano de la captura automática (Android).
 *
 * El servicio nativo la lanza cuando llega una notificación del banco y la app
 * NO está abierta. Solo LEE los datos guardados para decidir qué decirle al
 * usuario ("Finn registró $23.900 en APPLE.COM/BILL → Suscripciones") y
 * muestra el aviso. No escribe nada: la entrada queda en la cola nativa y la
 * app la registra al abrirse (useCapturaAutomatica), con el mismo motor y el
 * mismo resultado. Así nunca hay dos procesos escribiendo los mismos datos.
 */
import { storageService } from './storage/StorageService';
import { parsearMensaje } from '../utils/capturaParser';
import { procesarLote, resumenAviso } from '../utils/capturaMotor';
import { mostrarAviso, obtenerPendientes, obtenerConfiguracion } from '../../modules/finn-captura';

export async function tareaCapturaSegundoPlano(datos: { id?: string }): Promise<void> {
  try {
    if (!obtenerConfiguracion().habilitado) return;
    const cola = obtenerPendientes();
    const indice = cola.findIndex(e => e.id === datos?.id);
    if (indice < 0) return;

    const [categories, medios, reglas, transactions, pendientes, ignoradas, titulares, user, profile] = await Promise.all([
      storageService.getCategories(),
      storageService.getMediosPago(),
      storageService.getReglasComercio(),
      storageService.getTransactions(),
      storageService.getCapturasPendientes(),
      storageService.getHuellasIgnoradas(),
      storageService.getTitularesBanco(),
      storageService.getUser(),
      storageService.getProfile(),
    ]);

    // Se procesan también las entradas anteriores aún en cola: si el mismo pago
    // llegó por dos SMS, el segundo sale como duplicado y no se avisa dos veces.
    const ahora = new Date();
    const entradas = cola.slice(0, indice + 1);
    const lote = procesarLote(
      entradas.map(e => parsearMensaje(e.texto, { ahora, recibidoEn: new Date(e.recibidoEn) })),
      {
        categories: categories ?? [],
        medios: medios ?? [],
        reglas: reglas ?? [],
        transactions: transactions ?? [],
        pendientes: pendientes ?? [],
        huellasIgnoradas: ignoradas ?? [],
        nombresUsuario: [user?.name, profile?.mainFinancialConcern, ...(titulares ?? [])].filter((n): n is string => !!n),
        origen: 'notificacion',
        ahora,
      },
    );

    const aviso = resumenAviso(lote.items[lote.items.length - 1]);
    if (aviso) mostrarAviso(aviso.titulo, aviso.cuerpo);
  } catch {
    // Nunca romper el servicio nativo: la entrada sigue en cola para la app.
  }
}
