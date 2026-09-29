import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { debeBloquear } from '../utils/appLockPolicy';
import {
  cargarOpcionBloqueo, opcionBloqueoActual, haySalidaPermitida,
} from '../services/AppLockService';

/**
 * Bloqueo por inactividad + pantalla de privacidad.
 *
 * - `ocultarContenido`: true mientras la app no está al frente. Tapa los datos
 *   para que la vista previa del selector de apps (iOS) no muestre saldos.
 * - `bloqueado`: true cuando la app volvió tras superar el tiempo de gracia.
 *
 * Solo `background` cuenta como salida: `inactive` también lo producen el
 * diálogo de Face ID, el centro de control o una llamada entrante, y bloquear
 * ahí crearía un ciclo (Face ID → inactive → bloqueo → Face ID…).
 *
 * @param habilitado  hay sesión, PIN configurado y la app está desbloqueada
 */
export function useBloqueoInactividad(habilitado: boolean) {
  const [bloqueado, setBloqueado] = useState(false);
  const bloqueadoRef = useRef(false);
  bloqueadoRef.current = bloqueado;
  const [ocultarContenido, setOcultarContenido] = useState(false);

  const habilitadoRef = useRef(habilitado);
  habilitadoRef.current = habilitado;
  const salida = useRef<{ en: number; permitida: boolean } | null>(null);

  useEffect(() => { cargarOpcionBloqueo().catch(() => {}); }, []);

  // Al cerrar sesión o bloquear por otra vía, se descarta el estado pendiente.
  useEffect(() => {
    if (!habilitado) { salida.current = null; setOcultarContenido(false); setBloqueado(false); }
  }, [habilitado]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', estado => {
      if (!habilitadoRef.current) return;

      // Con la app ya bloqueada no hace falta la cortina (el PIN no muestra datos),
      // y así el diálogo de Face ID no la hace parpadear al desbloquear.
      // Tampoco durante un diálogo propio del sistema (Face ID, cámara, compartir).
      if ((estado === 'inactive' || estado === 'background') && !bloqueadoRef.current && !haySalidaPermitida()) {
        setOcultarContenido(true);
      }

      if (estado === 'background' && salida.current === null) {
        salida.current = { en: Date.now(), permitida: haySalidaPermitida() };
      }

      if (estado === 'active') {
        const s = salida.current;
        salida.current = null;
        // Primero se decide el bloqueo y después se quita la cortina, para que
        // el contenido no aparezca ni un instante antes del PIN.
        if (s && debeBloquear(s.en, Date.now(), opcionBloqueoActual(), s.permitida)) {
          setBloqueado(true);
        }
        setOcultarContenido(false);
      }
    });
    return () => sub.remove();
  }, []);

  return {
    bloqueado,
    ocultarContenido,
    desbloquear: () => setBloqueado(false),
  };
}
