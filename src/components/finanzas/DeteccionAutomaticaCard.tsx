/**
 * Activar / configurar la detección automática desde las notificaciones del
 * banco (Android). Antes de pedir el acceso muestra la divulgación destacada
 * que exige Google Play y registra el consentimiento específico
 * (`capture_notifications`, Ley 1581 art. 9) como prueba.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../../state';
import { useTheme } from '../../state/ThemeContext';
import { Icon } from '../ui/Icon';
import { THEME } from '../../constants/theme';
import { consentService } from '../../services/ConsentService';
import {
  abrirAjustesPermiso, capturaDisponible, configurar, obtenerConfiguracion, tienePermiso,
  type FuenteCaptura,
} from '../../../modules/finn-captura';

const FUENTES: { id: FuenteCaptura; label: string; desc: string; icon: string }[] = [
  { id: 'sms',    label: 'SMS del banco',  desc: 'Mensajes de texto de tus bancos',          icon: 'message-square' },
  { id: 'bancos', label: 'Apps de bancos', desc: 'Nequi, Daviplata, Bancolombia, Nu…',       icon: 'smartphone' },
  { id: 'correo', label: 'Correo',         desc: 'Alertas de PSE y bancos en Gmail/Outlook', icon: 'mail' },
  { id: 'wallet', label: 'Google Wallet',  desc: 'Pagos con el celular',                     icon: 'credit-card' },
];

const PUNTOS: [string, string, string][] = [
  ['eye', 'Qué lee', 'Solo las notificaciones de las fuentes que elijas (SMS, apps de bancos, correo, Google Wallet). Las demás apps se ignoran.'],
  ['target', 'Para qué', 'Para registrar automáticamente tus compras, pagos y envíos en la categoría correcta.'],
  ['filter', 'Qué guarda', 'Solo las que parecen movimientos (un monto y una palabra como compra o pago). Las procesa en tu celular y guarda el movimiento, no el mensaje.'],
  ['cpu', 'Finn IA', 'Si tienes activado el procesamiento con IA, para un comercio desconocido solo se envía su nombre y el monto.'],
  ['toggle-left', 'Tú decides', 'Puedes desactivarlo cuando quieras aquí o en los Ajustes del teléfono.'],
];

export const DeteccionAutomaticaCard: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useFinance();
  const [config, setConfig] = useState(obtenerConfiguracion);
  const [permiso, setPermiso] = useState(tienePermiso);
  const [divulgacion, setDivulgacion] = useState(false);

  const refrescar = useCallback(() => {
    setConfig(obtenerConfiguracion());
    setPermiso(tienePermiso());
  }, []);

  // Al volver de Ajustes, el acceso pudo cambiar.
  useEffect(() => {
    const sub = AppState.addEventListener('change', e => { if (e === 'active') refrescar(); });
    return () => sub.remove();
  }, [refrescar]);

  if (!capturaDisponible) {
    return (
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.fila}>
          <View style={[s.icono, { backgroundColor: colors.cardSecondary }]}>
            <Icon name="bell" size={16} color={colors.textTertiary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.titulo, { color: colors.textPrimary }]}>Detección automática</Text>
            <Text style={[s.sub, { color: colors.textTertiary }]}>
              {Platform.OS === 'ios'
                ? 'En iPhone llegará con los Atajos de Apple Pay. Mientras tanto, pega tus mensajes aquí abajo.'
                : 'Disponible en la app instalada (no en Expo Go). Mientras tanto, pega tus mensajes aquí abajo.'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const fuentes: FuenteCaptura[] = config.fuentes.length > 0 ? config.fuentes : ['sms', 'bancos'];

  const aceptar = async () => {
    setDivulgacion(false);
    await consentService.record([{ type: 'capture_notifications', granted: true }], 'app', user?.id ?? null).catch(() => {});
    configurar(true, fuentes);
    refrescar();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!tienePermiso()) abrirAjustesPermiso();
  };

  const desactivar = async () => {
    configurar(false, fuentes);
    await consentService.record([{ type: 'capture_notifications', granted: false }], 'app', user?.id ?? null).catch(() => {});
    refrescar();
  };

  const alternarFuente = (id: FuenteCaptura) => {
    const next = fuentes.includes(id) ? fuentes.filter(f => f !== id) : [...fuentes, id];
    if (next.length === 0) return; // al menos una fuente
    configurar(config.habilitado, next);
    refrescar();
  };

  const activo = config.habilitado && permiso;

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: activo ? colors.income + '66' : colors.border }]}>
      <View style={s.fila}>
        <View style={[s.icono, { backgroundColor: activo ? colors.incomeLight : colors.aiLight }]}>
          <Icon name={activo ? 'check-circle' : 'bell'} size={16} color={activo ? colors.income : colors.ai} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.titulo, { color: colors.textPrimary }]}>Detección automática</Text>
          <Text style={[s.sub, { color: colors.textTertiary }]}>
            {activo
              ? 'Finn registra tus compras apenas llega la notificación del banco.'
              : config.habilitado
                ? 'Falta darle a Finn el acceso a notificaciones en Ajustes.'
                : 'Finn registra tus compras apenas llega la notificación del banco, sin pegar nada.'}
          </Text>
        </View>
      </View>

      {!config.habilitado ? (
        <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary }]} onPress={() => setDivulgacion(true)} testID="deteccion-activar">
          <Text style={s.btnText}>Activar detección automática</Text>
        </TouchableOpacity>
      ) : (
        <>
          {!permiso && (
            <TouchableOpacity style={[s.btn, { backgroundColor: colors.warning }]} onPress={abrirAjustesPermiso} testID="deteccion-permiso">
              <Text style={s.btnText}>Dar acceso en Ajustes</Text>
            </TouchableOpacity>
          )}
          <Text style={[s.label, { color: colors.textTertiary }]}>LEER NOTIFICACIONES DE</Text>
          {FUENTES.map(f => (
            <View key={f.id} style={[s.fuente, { borderTopColor: colors.border }]}>
              <Icon name={f.icon as any} size={16} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[s.fuenteLabel, { color: colors.textPrimary }]}>{f.label}</Text>
                <Text style={[s.fuenteDesc, { color: colors.textTertiary }]}>{f.desc}</Text>
              </View>
              <Switch
                value={fuentes.includes(f.id)}
                onValueChange={() => alternarFuente(f.id)}
                trackColor={{ true: colors.primary, false: colors.border }}
                testID={`fuente-${f.id}`}
              />
            </View>
          ))}
          <TouchableOpacity onPress={desactivar} style={s.desactivar} testID="deteccion-desactivar">
            <Text style={[s.desactivarText, { color: colors.expense }]}>Desactivar detección automática</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Divulgación destacada (Google Play) + autorización (Ley 1581) */}
      <Modal transparent animationType="slide" visible={divulgacion} onRequestClose={() => setDivulgacion(false)}>
        <Pressable style={s.overlay} onPress={() => setDivulgacion(false)}>
          <Pressable style={[s.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[s.handle, { backgroundColor: colors.border }]} />
              <Text style={[s.modalTitulo, { color: colors.textPrimary }]}>Finn leerá las notificaciones de tu banco</Text>
              {PUNTOS.map(([icon, t, d]) => (
                <View key={t} style={s.punto}>
                  <Icon name={icon as any} size={16} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.puntoTitulo, { color: colors.textPrimary }]}>{t}</Text>
                    <Text style={[s.puntoDesc, { color: colors.textSecondary }]}>{d}</Text>
                  </View>
                </View>
              ))}
              <Text style={[s.legal, { color: colors.textTertiary }]}>
                Al aceptar autorizas este tratamiento según la Política de Tratamiento de Datos (Ley 1581 de 2012). Luego Android te pedirá confirmar el acceso a notificaciones.
              </Text>
              <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary }]} onPress={aceptar} testID="divulgacion-aceptar">
                <Text style={s.btnText}>Aceptar y continuar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.desactivar} onPress={() => setDivulgacion(false)}>
                <Text style={[s.desactivarText, { color: colors.textSecondary }]}>Ahora no</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  card:          { borderWidth: 1.5, borderRadius: THEME.radius.lg, padding: 16, marginBottom: 16 },
  fila:          { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icono:         { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  titulo:        { fontSize: 15, fontWeight: '700' },
  sub:           { fontSize: 12, marginTop: 2, lineHeight: 16 },
  btn:           { borderRadius: THEME.radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  btnText:       { color: '#fff', fontSize: 14, fontWeight: '800' },
  label:         { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 16, marginBottom: 4 },
  fuente:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  fuenteLabel:   { fontSize: 14, fontWeight: '600' },
  fuenteDesc:    { fontSize: 11.5, marginTop: 1 },
  desactivar:    { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  desactivarText:{ fontSize: 13, fontWeight: '700' },
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:         { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 22, paddingTop: 12, maxHeight: '90%' },
  handle:        { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitulo:   { fontSize: 19, fontWeight: '800', marginBottom: 16, letterSpacing: -0.3 },
  punto:         { flexDirection: 'row', gap: 12, marginBottom: 14 },
  puntoTitulo:   { fontSize: 14, fontWeight: '700' },
  puntoDesc:     { fontSize: 13, lineHeight: 18, marginTop: 2 },
  legal:         { fontSize: 11.5, lineHeight: 16, marginTop: 4 },
});
