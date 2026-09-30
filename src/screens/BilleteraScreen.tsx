/**
 * Billetera — medios de pago del usuario (tarjetas, billeteras, cuentas, efectivo).
 *
 * Fase 0 de la captura automática de compras: aquí el usuario registra con qué
 * paga; cada gasto puede quedar asociado a un medio. Las fases siguientes
 * (notificaciones del banco, correos, Apple Pay) usan estos medios para saber
 * a qué tarjeta pertenece una compra detectada.
 *
 * Seguridad: nunca se piden ni se guardan el número completo, el CVV ni claves.
 */
import React, { useMemo, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import { THEME } from '../constants/theme';
import type { Franquicia, MedioPago, TipoMedioPago, Transaction } from '../types';
import {
  FRANQUICIAS, TIPOS_MEDIO,
  construirMedioPago, descripcionMedio, entidadPorId, entidadesParaTipo, esTarjeta,
  etiquetaMedio, gastoPorMedio, mediosActivos, resumenMedio, tieneMovimientos, tipoInfo,
  validarMedioPago,
  type ErroresMedio, type MedioPagoInput, type ResumenMedio,
} from '../utils/mediosPago';

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
const fmtMiles = (t: string) => {
  const n = parseInt(t.replace(/\D/g, ''), 10);
  return isNaN(n) ? '' : n.toLocaleString('es-CO').replace(/,/g, '.');
};
const fmtFechaCorta = (d: Date) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

// ─── Tarjeta visual ───────────────────────────────────────────────────────────

interface TarjetaProps {
  medio: MedioPago;
  resumen: ResumenMedio;
  onPress?: () => void;
}

const TarjetaVisual: React.FC<TarjetaProps> = ({ medio, resumen, onPress }) => {
  const entidad = entidadPorId(medio.entidad);
  const tx = entidad.texto;
  const franquicia = FRANQUICIAS.find(f => f.id === medio.franquicia);
  const pagoPronto = resumen.proximoPago && resumen.proximoPago.dias <= 5;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${etiquetaMedio(medio)}, ${descripcionMedio(medio)}. Este mes ${fmt(resumen.gastoMes)}`}
      style={({ pressed }) => [tj.card, { backgroundColor: entidad.color, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      testID={`tarjeta-${medio.id}`}
    >
      {/* Decoración */}
      <View style={[tj.circulo, tj.circuloA]} />
      <View style={[tj.circulo, tj.circuloB]} />

      <View style={tj.filaTop}>
        <View style={{ flex: 1 }}>
          <Text style={[tj.entidad, { color: tx }]} numberOfLines={1}>{entidad.nombre}</Text>
          <Text style={[tj.tipo, { color: tx }]}>{descripcionMedio(medio).split(' · ')[0]}</Text>
        </View>
        {medio.predeterminado && (
          <View style={[tj.badge, { borderColor: tx + '66' }]}>
            <Icon name="star" size={10} color={tx} />
            <Text style={[tj.badgeText, { color: tx }]}>Predeterminado</Text>
          </View>
        )}
      </View>

      <View style={tj.filaMedio}>
        {esTarjeta(medio.tipo)
          ? <View style={tj.chip}><View style={tj.chipLinea} /><View style={tj.chipLinea} /></View>
          : <Icon name={tipoInfo(medio.tipo).icon as any} size={22} color={tx} />}
        <Text style={[tj.alias, { color: tx }]} numberOfLines={1}>{medio.alias}</Text>
      </View>

      {resumen.cupo && (
        <View style={tj.cupoWrap}>
          <View style={[tj.cupoTrack, { backgroundColor: tx + '33' }]}>
            <View style={[tj.cupoFill, { width: `${Math.max(resumen.cupo.pct * 100, 2)}%` as any, backgroundColor: tx }]} />
          </View>
          <Text style={[tj.cupoText, { color: tx }]}>
            Disponible {fmt(resumen.cupo.disponible)} de {fmt(resumen.cupo.total)}
          </Text>
        </View>
      )}

      <View style={tj.filaBottom}>
        <View>
          <Text style={[tj.numero, { color: tx }]}>
            {medio.ultimos4 ? `•••• ${medio.ultimos4}` : ' '}
          </Text>
          {resumen.proximoPago && (
            <Text style={[tj.pago, { color: tx, fontWeight: pagoPronto ? '800' : '600' }]}>
              {resumen.proximoPago.dias === 0 ? 'Pagas hoy' : `Pago en ${resumen.proximoPago.dias} día${resumen.proximoPago.dias === 1 ? '' : 's'}`}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[tj.gastoLabel, { color: tx }]}>Este mes</Text>
          <Text style={[tj.gasto, { color: tx }]}>{fmt(resumen.gastoMes)}</Text>
          {franquicia && franquicia.id !== 'otra' && (
            <Text style={[tj.franquicia, { color: tx }]}>{franquicia.label.toUpperCase()}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
};

// ─── Formulario (agregar / editar) ────────────────────────────────────────────

type Paso = 'tipo' | 'entidad' | 'datos';

interface FormProps {
  inicial: MedioPago | null;
  onClose: () => void;
  onSave: (input: MedioPagoInput, id?: string) => void;
}

function aliasSugerido(tipo: TipoMedioPago, entidadId: string): string {
  const nombre = entidadPorId(entidadId).nombre;
  const s = {
    credito: `Crédito ${nombre}`,
    debito: `Débito ${nombre}`,
    billetera: nombre,
    cuenta: `Cuenta ${nombre}`,
    efectivo: 'Efectivo',
  }[tipo];
  return s.substring(0, 40);
}

const ErrorCampo: React.FC<{ mensaje?: string; color: string }> = ({ mensaje, color }) =>
  mensaje ? <Text style={[fm.error, { color }]}>{mensaje}</Text> : null;

/**
 * Se monta de nuevo cada vez que se abre (el padre le pone `key`), así el
 * estado arranca limpio o con el medio a editar sin efectos de reinicio.
 */
const MedioForm: React.FC<FormProps> = ({ inicial, onClose, onSave }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [paso, setPaso]             = useState<Paso>(inicial ? 'datos' : 'tipo');
  const [tipo, setTipo]             = useState<TipoMedioPago>(inicial?.tipo ?? 'credito');
  const [entidad, setEntidad]       = useState(inicial?.entidad ?? '');
  const [alias, setAlias]           = useState(inicial?.alias ?? '');
  const [ultimos4, setUltimos4]     = useState(inicial?.ultimos4 ?? '');
  const [franquicia, setFranquicia] = useState<Franquicia | undefined>(inicial?.franquicia);
  const [cupo, setCupo]             = useState(inicial?.cupo !== undefined ? fmtMiles(String(inicial.cupo)) : '');
  const [diaCorte, setDiaCorte]     = useState(inicial?.diaCorte !== undefined ? String(inicial.diaCorte) : '');
  const [diaPago, setDiaPago]       = useState(inicial?.diaPago !== undefined ? String(inicial.diaPago) : '');
  const [errores, setErrores]       = useState<ErroresMedio>({});

  const elegirTipo = (t: TipoMedioPago) => {
    Haptics.selectionAsync().catch(() => {});
    setTipo(t);
    if (t === 'efectivo') {
      setEntidad('efectivo');
      setAlias('Efectivo');
      setPaso('datos');
    } else {
      setPaso('entidad');
    }
  };

  const elegirEntidad = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    // Reemplaza el alias solo si el usuario no lo personalizó.
    if (!alias || alias === aliasSugerido(tipo, entidad)) setAlias(aliasSugerido(tipo, id));
    setEntidad(id);
    setPaso('datos');
  };

  const numOpcional = (t: string) => {
    const n = parseInt(t.replace(/\D/g, ''), 10);
    return isNaN(n) ? undefined : n;
  };

  const guardar = () => {
    const input: MedioPagoInput = {
      tipo, entidad, alias,
      ...(ultimos4 ? { ultimos4 } : {}),
      ...(franquicia ? { franquicia } : {}),
      ...(tipo === 'credito' ? { cupo: numOpcional(cupo), diaCorte: numOpcional(diaCorte), diaPago: numOpcional(diaPago) } : {}),
    };
    const r = validarMedioPago(input);
    setErrores(r.errores);
    if (!r.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSave(input, inicial?.id);
  };

  const inputStyle = [fm.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }];

  const titulo = inicial ? 'Editar medio de pago'
    : paso === 'tipo' ? '¿Qué quieres agregar?'
    : paso === 'entidad' ? '¿De qué entidad?'
    : 'Datos para reconocerlo';

  const preview: MedioPago | null = entidad ? {
    id: 'preview', tipo, entidad, alias: alias.trim() || aliasSugerido(tipo, entidad),
    ...(ultimos4.length === 4 ? { ultimos4 } : {}),
    ...(franquicia && esTarjeta(tipo) ? { franquicia } : {}),
    color: entidadPorId(entidad).color, predeterminado: false, archivado: false, creadoEn: '',
  } : null;

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={st.overlay} onPress={onClose}>
          <Pressable style={[fm.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
            <View style={[st.handle, { backgroundColor: colors.border }]} />
            <View style={fm.header}>
              {paso !== 'tipo' && !inicial && (
                <TouchableOpacity
                  onPress={() => setPaso(paso === 'datos' && tipo !== 'efectivo' ? 'entidad' : 'tipo')}
                  style={fm.atras}
                  accessibilityLabel="Paso anterior"
                >
                  <Icon name="arrow-left" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              )}
              <Text style={[st.sheetTitle, { color: colors.textPrimary, marginBottom: 0, flex: 1 }]}>{titulo}</Text>
              <TouchableOpacity onPress={onClose} style={[fm.cerrar, { backgroundColor: colors.inputBg }]} accessibilityLabel="Cerrar">
                <Icon name="x" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {paso === 'tipo' && (
                <View style={{ gap: 10 }}>
                  {TIPOS_MEDIO.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      testID={`tipo-${t.id}`}
                      style={[fm.opcion, { borderColor: colors.border, backgroundColor: colors.cardSecondary }]}
                      onPress={() => elegirTipo(t.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[fm.opcionIcon, { backgroundColor: colors.primaryLight }]}>
                        <Icon name={t.icon as any} size={18} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[fm.opcionTitulo, { color: colors.textPrimary }]}>{t.label}</Text>
                        <Text style={[fm.opcionDesc, { color: colors.textTertiary }]}>{t.descripcion}</Text>
                      </View>
                      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {paso === 'entidad' && (
                <View style={fm.grid}>
                  {entidadesParaTipo(tipo).map(e => (
                    <TouchableOpacity
                      key={e.id}
                      testID={`entidad-${e.id}`}
                      style={[fm.entidad, { borderColor: entidad === e.id ? e.color : colors.border, backgroundColor: colors.cardSecondary }]}
                      onPress={() => elegirEntidad(e.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[fm.entidadDot, { backgroundColor: e.color }]}>
                        <Text style={[fm.entidadInicial, { color: e.texto }]}>{e.nombre.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={[fm.entidadNombre, { color: colors.textPrimary }]} numberOfLines={2}>{e.nombre}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {paso === 'datos' && (
                <View>
                  {preview && (
                    <View style={{ marginBottom: 18 }}>
                      <TarjetaVisual medio={preview} resumen={{ gastoMes: 0, movimientosMes: 0 }} />
                    </View>
                  )}

                  <Text style={[st.label, { color: colors.textTertiary }]}>NOMBRE</Text>
                  <TextInput
                    style={inputStyle}
                    value={alias}
                    onChangeText={setAlias}
                    placeholder="Ej: Visa de la casa"
                    placeholderTextColor={colors.textTertiary}
                    maxLength={40}
                    testID="medio-alias"
                  />
                  <ErrorCampo mensaje={errores.alias} color={colors.expense} />

                  {tipo !== 'efectivo' && (
                    <>
                      <Text style={[st.label, { color: colors.textTertiary, marginTop: 14 }]}>
                        {esTarjeta(tipo) ? 'ÚLTIMOS 4 DÍGITOS (opcional)' : 'ÚLTIMOS 4 DEL NÚMERO (opcional)'}
                      </Text>
                      <TextInput
                        style={inputStyle}
                        value={ultimos4}
                        onChangeText={t => setUltimos4(t.replace(/\D/g, '').slice(0, 4))}
                        placeholder="1234"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        maxLength={4}
                        testID="medio-ultimos4"
                      />
                      <Text style={[fm.ayuda, { color: colors.textTertiary }]}>
                        Nos ayudan a reconocer tus compras. Nunca escribas el número completo.
                      </Text>
                      <ErrorCampo mensaje={errores.ultimos4} color={colors.expense} />
                    </>
                  )}

                  {esTarjeta(tipo) && (
                    <>
                      <Text style={[st.label, { color: colors.textTertiary, marginTop: 14 }]}>FRANQUICIA</Text>
                      <View style={fm.chips}>
                        {FRANQUICIAS.map(f => {
                          const activa = franquicia === f.id;
                          return (
                            <TouchableOpacity
                              key={f.id}
                              style={[fm.chip, { borderColor: activa ? colors.primary : colors.border, backgroundColor: activa ? colors.primaryLight : 'transparent' }]}
                              onPress={() => setFranquicia(activa ? undefined : f.id)}
                            >
                              <Text style={[fm.chipText, { color: activa ? colors.primary : colors.textSecondary }]}>{f.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  )}

                  {tipo === 'credito' && (
                    <>
                      <Text style={[st.label, { color: colors.textTertiary, marginTop: 14 }]}>CUPO TOTAL (opcional)</Text>
                      <TextInput
                        style={inputStyle}
                        value={cupo}
                        onChangeText={t => setCupo(fmtMiles(t))}
                        placeholder="0"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="numeric"
                      />
                      <ErrorCampo mensaje={errores.cupo} color={colors.expense} />
                      <View style={fm.fila}>
                        <View style={{ flex: 1 }}>
                          <Text style={[st.label, { color: colors.textTertiary, marginTop: 14 }]}>DÍA DE CORTE</Text>
                          <TextInput
                            style={inputStyle}
                            value={diaCorte}
                            onChangeText={t => setDiaCorte(t.replace(/\D/g, '').slice(0, 2))}
                            placeholder="Ej: 15"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="number-pad"
                          />
                          <ErrorCampo mensaje={errores.diaCorte} color={colors.expense} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[st.label, { color: colors.textTertiary, marginTop: 14 }]}>DÍA DE PAGO</Text>
                          <TextInput
                            style={inputStyle}
                            value={diaPago}
                            onChangeText={t => setDiaPago(t.replace(/\D/g, '').slice(0, 2))}
                            placeholder="Ej: 5"
                            placeholderTextColor={colors.textTertiary}
                            keyboardType="number-pad"
                          />
                          <ErrorCampo mensaje={errores.diaPago} color={colors.expense} />
                        </View>
                      </View>
                    </>
                  )}

                  <View style={[fm.seguridad, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
                    <Icon name="shield" size={14} color={colors.income} />
                    <Text style={[fm.seguridadText, { color: colors.textSecondary }]}>
                      Finn nunca te pide el número completo, el CVV ni tus claves.
                    </Text>
                  </View>

                  <TouchableOpacity style={[st.saveBtn, { backgroundColor: colors.primary }]} onPress={guardar} testID="medio-guardar">
                    <Text style={st.saveBtnText}>{inicial ? 'Guardar cambios' : 'Agregar a mi billetera'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Detalle de un medio ──────────────────────────────────────────────────────

const Dato: React.FC<{ label: string; valor: string; sub?: string }> = ({ label, valor, sub }) => {
  const { colors } = useTheme();
  return (
    <View style={[dt.dato, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
      <Text style={[dt.datoLabel, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[dt.datoValor, { color: colors.textPrimary }]}>{valor}</Text>
      {sub ? <Text style={[dt.datoSub, { color: colors.textTertiary }]}>{sub}</Text> : null}
    </View>
  );
};

interface DetalleProps {
  medio: MedioPago | null;
  transactions: Transaction[];
  onClose: () => void;
  onEditar: (m: MedioPago) => void;
  onPredeterminado: (m: MedioPago) => void;
  onEliminar: (m: MedioPago) => void;
}

const DetalleMedio: React.FC<DetalleProps> = ({ medio, transactions, onClose, onEditar, onPredeterminado, onEliminar }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const resumen = useMemo(() => (medio ? resumenMedio(medio, transactions) : null), [medio, transactions]);
  const ultimos = useMemo(
    () => (medio
      ? transactions
          .filter(t => t.paymentMethodId === medio.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5)
      : []),
    [medio, transactions],
  );
  if (!medio || !resumen) return null;

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={st.overlay} onPress={onClose}>
        <Pressable style={[fm.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]} onPress={() => {}}>
          <View style={[st.handle, { backgroundColor: colors.border }]} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <TarjetaVisual medio={medio} resumen={resumen} />

            <View style={dt.datos}>
              <Dato label="Este mes" valor={fmt(resumen.gastoMes)} sub={`${resumen.movimientosMes} movimiento${resumen.movimientosMes === 1 ? '' : 's'}`} />
              {resumen.ciclo && (
                <Dato
                  label="Ciclo actual"
                  valor={fmt(resumen.ciclo.gasto)}
                  sub={`${fmtFechaCorta(resumen.ciclo.inicio)} – ${fmtFechaCorta(resumen.ciclo.fin)}`}
                />
              )}
              {resumen.proximoPago && (
                <Dato
                  label="Próximo pago"
                  valor={fmtFechaCorta(resumen.proximoPago.fecha)}
                  sub={resumen.proximoPago.dias === 0 ? 'Hoy' : `En ${resumen.proximoPago.dias} días`}
                />
              )}
            </View>
            {resumen.cupo && (
              <Text style={[dt.nota, { color: colors.textTertiary }]}>
                El cupo disponible es un estimado con lo que registras en Finn; tu banco tiene el saldo oficial.
              </Text>
            )}

            <Text style={[st.label, { color: colors.textTertiary, marginTop: 18 }]}>ÚLTIMOS MOVIMIENTOS</Text>
            {ultimos.length === 0 ? (
              <Text style={[dt.vacio, { color: colors.textTertiary }]}>
                Aún no hay gastos con este medio. Elígelo en «Pagaste con» al registrar un gasto.
              </Text>
            ) : ultimos.map(t => (
              <View key={t.id} style={[dt.mov, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[dt.movTitulo, { color: colors.textPrimary }]} numberOfLines={1}>{t.description || t.category}</Text>
                  <Text style={[dt.movFecha, { color: colors.textTertiary }]}>
                    {new Date(t.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · {t.category}
                  </Text>
                </View>
                <Text style={[dt.movMonto, { color: t.type === 'income' ? colors.income : colors.expense }]}>
                  {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                </Text>
              </View>
            ))}

            <View style={dt.acciones}>
              {!medio.predeterminado && (
                <TouchableOpacity style={[dt.accion, { borderColor: colors.border }]} onPress={() => onPredeterminado(medio)}>
                  <Icon name="star" size={16} color={colors.primary} />
                  <Text style={[dt.accionText, { color: colors.textPrimary }]}>Usar por defecto</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[dt.accion, { borderColor: colors.border }]} onPress={() => onEditar(medio)} testID="medio-editar">
                <Icon name="edit-2" size={16} color={colors.textSecondary} />
                <Text style={[dt.accionText, { color: colors.textPrimary }]}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[dt.accion, { borderColor: colors.border }]} onPress={() => onEliminar(medio)} testID="medio-eliminar">
                <Icon name="trash-2" size={16} color={colors.expense} />
                <Text style={[dt.accionText, { color: colors.expense }]}>Quitar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ─── Pantalla ─────────────────────────────────────────────────────────────────

interface BilleteraScreenProps {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

export const BilleteraScreen: React.FC<BilleteraScreenProps> = ({ onBack, onNavigate }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const {
    mediosPago, transactions, premium, capturasPendientes,
    addMedioPago, updateMedioPago, eliminarMedioPago, setMedioPredeterminado,
  } = useFinance();

  const [formVisible, setFormVisible] = useState(false);
  const [editando, setEditando]       = useState<MedioPago | null>(null);
  const [detalleId, setDetalleId]     = useState<string | null>(null);
  const [verArchivados, setVerArchivados] = useState(false);

  const activos    = useMemo(() => mediosActivos(mediosPago), [mediosPago]);
  const archivados = useMemo(() => mediosPago.filter(m => m.archivado), [mediosPago]);
  const detalle    = detalleId ? mediosPago.find(m => m.id === detalleId) ?? null : null;
  const resumenes  = useMemo(
    () => new Map(activos.map(m => [m.id, resumenMedio(m, transactions)])),
    [activos, transactions],
  );

  // Distribución del gasto del mes por medio (incluye lo registrado sin medio).
  const distribucion = useMemo(() => {
    const hoy = new Date();
    return gastoPorMedio(transactions, hoy.getFullYear(), hoy.getMonth());
  }, [transactions]);
  const totalMes = distribucion.reduce((s, d) => s + d.total, 0);
  const sinMedio = distribucion.find(d => d.medioId === null);

  const abrirNuevo = () => { setEditando(null); setFormVisible(true); };

  const guardar = (input: MedioPagoInput, id?: string) => {
    if (id) {
      const actual = mediosPago.find(m => m.id === id);
      if (actual) {
        const construido = construirMedioPago(input, mediosPago, new Date(), id);
        // Reemplazo completo: un campo que el usuario borró (p. ej. el cupo) no debe sobrevivir.
        updateMedioPago(id, {
          ultimos4: undefined, franquicia: undefined, cupo: undefined, diaCorte: undefined, diaPago: undefined,
          ...construido,
          predeterminado: actual.predeterminado,
          archivado: actual.archivado,
          creadoEn: actual.creadoEn,
        });
      }
    } else {
      addMedioPago(construirMedioPago(input, mediosPago));
    }
    setFormVisible(false);
    setEditando(null);
  };

  const quitar = (m: MedioPago) => {
    const conMovimientos = tieneMovimientos(m.id, transactions);
    Alert.alert(
      conMovimientos ? `¿Archivar "${m.alias}"?` : `¿Eliminar "${m.alias}"?`,
      conMovimientos
        ? 'Tiene gastos registrados. Dejará de aparecer al registrar, pero tu historial lo conserva.'
        : 'Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: conMovimientos ? 'Archivar' : 'Eliminar',
          style: 'destructive',
          onPress: () => {
            eliminarMedioPago(m.id);
            setDetalleId(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          },
        },
      ],
    );
  };

  return (
    <View style={[st.screen, { backgroundColor: colors.background }]}>
      <View style={[st.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={st.backBtn} accessibilityLabel="Volver">
          <Icon name="arrow-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: colors.textPrimary }]}>Mi billetera</Text>
        <TouchableOpacity
          onPress={abrirNuevo}
          style={[st.addBtn, { backgroundColor: colors.primaryLight }]}
          accessibilityLabel="Agregar medio de pago"
          testID="billetera-agregar"
        >
          <Icon name="plus" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {activos.length === 0 ? (
          <View style={st.empty}>
            <Text style={{ fontSize: 52 }}>💳</Text>
            <Text style={[st.emptyTitle, { color: colors.textPrimary }]}>¿Con qué pagas?</Text>
            <Text style={[st.emptySub, { color: colors.textTertiary }]}>
              Agrega tus tarjetas, Nequi, Daviplata o efectivo. Así sabrás cuánto gastas con cada uno y cuándo pagar tu tarjeta.
            </Text>
            <TouchableOpacity style={[st.saveBtn, { backgroundColor: colors.primary, paddingHorizontal: 28, marginTop: 20 }]} onPress={abrirNuevo}>
              <Text style={st.saveBtnText}>Agregar medio de pago</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {totalMes > 0 && (
              <View style={[st.resumen, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[st.label, { color: colors.textTertiary }]}>ESTE MES PAGASTE</Text>
                <Text style={[st.resumenMonto, { color: colors.textPrimary }]}>{fmt(totalMes)}</Text>
                <View style={[st.barra, { backgroundColor: colors.border }]}>
                  {distribucion.map(d => {
                    const m = d.medioId ? mediosPago.find(x => x.id === d.medioId) : undefined;
                    return (
                      <View
                        key={d.medioId ?? 'sin'}
                        style={{ flex: d.total, backgroundColor: m ? entidadPorId(m.entidad).color : colors.textTertiary + '55' }}
                      />
                    );
                  })}
                </View>
                {sinMedio && (
                  <Text style={[st.resumenNota, { color: colors.textTertiary }]}>
                    {fmt(sinMedio.total)} sin medio asignado · elígelo en «Pagaste con» al registrar.
                  </Text>
                )}
              </View>
            )}

            {activos.map(m => (
              <View key={m.id} style={{ marginBottom: 14 }}>
                <TarjetaVisual
                  medio={m}
                  resumen={resumenes.get(m.id) ?? { gastoMes: 0, movimientosMes: 0 }}
                  onPress={() => setDetalleId(m.id)}
                />
              </View>
            ))}

            {archivados.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <TouchableOpacity style={st.archivadosToggle} onPress={() => setVerArchivados(v => !v)}>
                  <Text style={[st.label, { color: colors.textTertiary, marginBottom: 0 }]}>ARCHIVADOS ({archivados.length})</Text>
                  <Icon name={verArchivados ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textTertiary} />
                </TouchableOpacity>
                {verArchivados && archivados.map(m => (
                  <View key={m.id} style={[st.archivado, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[st.archivadoDot, { backgroundColor: entidadPorId(m.entidad).color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[st.archivadoNombre, { color: colors.textPrimary }]}>{etiquetaMedio(m)}</Text>
                      <Text style={[st.archivadoSub, { color: colors.textTertiary }]}>{descripcionMedio(m)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => updateMedioPago(m.id, { archivado: false })} style={st.restaurar}>
                      <Text style={[st.restaurarText, { color: colors.primary }]}>Restaurar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Captura automática (Premium) */}
        <TouchableOpacity
          style={[st.pronto, { backgroundColor: colors.aiLight, borderColor: colors.ai + '33' }]}
          onPress={() => onNavigate?.('captura')}
          disabled={!onNavigate}
          activeOpacity={0.85}
          testID="billetera-captura"
        >
          <View style={[st.prontoIcon, { backgroundColor: colors.ai }]}>
            <Icon name="zap" size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.prontoTitulo, { color: colors.aiText }]}>
              {capturasPendientes.length > 0
                ? `${capturasPendientes.length} movimiento${capturasPendientes.length > 1 ? 's' : ''} por confirmar`
                : 'Registra tus compras desde el banco'}
            </Text>
            <Text style={[st.prontoSub, { color: colors.aiText }]}>
              Pega los SMS o correos de tu banco y Finn guarda cada compra con esta tarjeta, en la categoría correcta.
              {premium.isPremium ? '' : ' · Premium'}
            </Text>
          </View>
          <Icon name="chevron-right" size={16} color={colors.aiText} />
        </TouchableOpacity>

        <View style={st.seguridad}>
          <Icon name="lock" size={12} color={colors.textTertiary} />
          <Text style={[st.seguridadText, { color: colors.textTertiary }]}>
            Solo guardamos el nombre, la entidad y los últimos 4 dígitos. Nunca el número completo, el CVV ni tus claves.
          </Text>
        </View>
      </ScrollView>

      {formVisible && (
        <MedioForm
          key={editando?.id ?? 'nuevo'}
          inicial={editando}
          onClose={() => { setFormVisible(false); setEditando(null); }}
          onSave={guardar}
        />
      )}
      {detalle && !formVisible && (
        <DetalleMedio
          medio={detalle}
          transactions={transactions}
          onClose={() => setDetalleId(null)}
          onEditar={m => { setEditando(m); setFormVisible(true); }}
          onPredeterminado={m => {
            setMedioPredeterminado(m.id);
            Haptics.selectionAsync().catch(() => {});
          }}
          onEliminar={quitar}
        />
      )}
    </View>
  );
};

// ─── Estilos ──────────────────────────────────────────────────────────────────

const tj = StyleSheet.create({
  card: {
    borderRadius: 20, padding: 18, minHeight: 170, overflow: 'hidden', justifyContent: 'space-between',
    ...(Platform.OS !== 'web' ? { shadowColor: '#0B1220', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 6 } : {}),
  },
  circulo:    { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  circuloA:   { width: 180, height: 180, top: -70, right: -50 },
  circuloB:   { width: 120, height: 120, bottom: -60, right: 60 },
  filaTop:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  entidad:    { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  tipo:       { fontSize: 11, fontWeight: '600', opacity: 0.85, marginTop: 1 },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:  { fontSize: 10, fontWeight: '700' },
  filaMedio:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 14 },
  chip:       { width: 34, height: 26, borderRadius: 5, backgroundColor: '#E8C66A', justifyContent: 'center', gap: 5, paddingHorizontal: 5 },
  chipLinea:  { height: 1.5, backgroundColor: 'rgba(0,0,0,0.25)' },
  alias:      { fontSize: 17, fontWeight: '700', flex: 1 },
  cupoWrap:   { marginBottom: 10, gap: 5 },
  cupoTrack:  { height: 5, borderRadius: 3, overflow: 'hidden' },
  cupoFill:   { height: '100%', borderRadius: 3 },
  cupoText:   { fontSize: 11, fontWeight: '600', opacity: 0.9 },
  filaBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  numero:     { fontSize: 15, fontWeight: '700', letterSpacing: 2 },
  pago:       { fontSize: 11, marginTop: 3, opacity: 0.95 },
  gastoLabel: { fontSize: 10, fontWeight: '600', opacity: 0.8 },
  gasto:      { fontSize: 18, fontWeight: '800' },
  franquicia: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 2, opacity: 0.9 },
});

const fm = StyleSheet.create({
  sheet:         { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '92%' },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  atras:         { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  cerrar:        { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  opcion:        { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: THEME.radius.md, padding: 14 },
  opcionIcon:    { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  opcionTitulo:  { fontSize: 15, fontWeight: '700' },
  opcionDesc:    { fontSize: 12, marginTop: 2 },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  entidad:       { width: '31%', flexGrow: 1, alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: THEME.radius.md, paddingVertical: 14, paddingHorizontal: 6 },
  entidadDot:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  entidadInicial:{ fontSize: 17, fontWeight: '800' },
  entidadNombre: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  input:         { borderWidth: 1, borderRadius: THEME.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  ayuda:         { fontSize: 11, marginTop: 6, lineHeight: 15 },
  error:         { fontSize: 12, fontWeight: '600', marginTop: 6 },
  chips:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:          { borderWidth: 1.5, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  chipText:      { fontSize: 13, fontWeight: '600' },
  fila:          { flexDirection: 'row', gap: 12 },
  seguridad:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: THEME.radius.md, padding: 12, marginTop: 18 },
  seguridadText: { flex: 1, fontSize: 12, lineHeight: 16 },
});

const dt = StyleSheet.create({
  datos:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  dato:       { flexGrow: 1, flexBasis: '30%', borderWidth: 1, borderRadius: THEME.radius.md, padding: 12 },
  datoLabel:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  datoValor:  { fontSize: 16, fontWeight: '800', marginTop: 4 },
  datoSub:    { fontSize: 11, marginTop: 2 },
  nota:       { fontSize: 11, marginTop: 10, lineHeight: 15 },
  vacio:      { fontSize: 13, lineHeight: 18, paddingVertical: 8 },
  mov:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  movTitulo:  { fontSize: 14, fontWeight: '600' },
  movFecha:   { fontSize: 11, marginTop: 2 },
  movMonto:   { fontSize: 14, fontWeight: '700' },
  acciones:   { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  accion:     { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: THEME.radius.md, paddingVertical: 12, paddingHorizontal: 10 },
  accionText: { fontSize: 13, fontWeight: '700' },
});

const st = StyleSheet.create({
  screen:          { flex: 1 },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle:     { flex: 1, fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginLeft: 8 },
  addBtn:          { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empty:           { alignItems: 'center', paddingTop: 48, paddingBottom: 24, paddingHorizontal: 24 },
  emptyTitle:      { fontSize: 20, fontWeight: '800', marginTop: 14, marginBottom: 8 },
  emptySub:        { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  resumen:         { borderWidth: 1, borderRadius: THEME.radius.lg, padding: 18, marginBottom: 18 },
  resumenMonto:    { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 12 },
  resumenNota:     { fontSize: 12, marginTop: 10, lineHeight: 16 },
  barra:           { height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row', gap: 2 },
  archivadosToggle:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  archivado:       { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: THEME.radius.md, padding: 12, marginTop: 8 },
  archivadoDot:    { width: 14, height: 14, borderRadius: 7 },
  archivadoNombre: { fontSize: 14, fontWeight: '700' },
  archivadoSub:    { fontSize: 11, marginTop: 2 },
  restaurar:       { paddingHorizontal: 8, paddingVertical: 6 },
  restaurarText:   { fontSize: 13, fontWeight: '700' },
  pronto:          { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: THEME.radius.lg, padding: 16, marginTop: 20, alignItems: 'flex-start' },
  prontoIcon:      { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  prontoTitulo:    { fontSize: 14, fontWeight: '800' },
  prontoSub:       { fontSize: 12, marginTop: 4, lineHeight: 17, opacity: 0.9 },
  seguridad:       { flexDirection: 'row', gap: 6, marginTop: 18, paddingHorizontal: 4 },
  seguridadText:   { flex: 1, fontSize: 11, lineHeight: 15 },
  // Modal
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  handle:          { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle:      { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  label:           { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  saveBtn:         { paddingVertical: 15, borderRadius: THEME.radius.lg, alignItems: 'center', marginTop: 16 },
  saveBtnText:     { color: '#fff', fontSize: 16, fontWeight: '800' },
});
