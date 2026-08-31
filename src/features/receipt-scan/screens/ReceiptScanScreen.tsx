import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/state/ThemeContext';
import { Icon } from '@/src/components/ui/Icon';
import { useFinance } from '@/src/core/context/FinanceContext';
import {
  tomarFotoConCamara,
  elegirDesdGaleria,
  escanearRecibo,
} from '../services/ReceiptScanService';
import { ReceiptConfirmScreen } from './ReceiptConfirmScreen';
import type { ReceiptScanResult, ReceiptConfirmData, ScanEstado } from '../types';

interface Props {
  onGastoRegistrado: () => void;
  onCancelar: () => void;
}

export const ReceiptScanScreen: React.FC<Props> = ({ onGastoRegistrado, onCancelar }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { categories, addExpense } = useFinance();

  const [estado, setEstado]         = useState<ScanEstado>('idle');
  const [resultado, setResultado]   = useState<ReceiptScanResult | null>(null);
  const [errorMsg, setErrorMsg]     = useState('');

  // Nombres de categorías raíz para pasar al Worker
  const nombresCategoria = useMemo(
    () => categories
      .filter(c => !c.parentCategoryId && c.tipo !== 'ingreso')
      .map(c => c.name),
    [categories],
  );

  // ─── Flujo: captura → escaneo ──────────────────────────────────────────────

  const procesarImagen = async (fuente: 'camara' | 'galeria') => {
    try {
      setEstado('capturando');
      const imagen = fuente === 'camara'
        ? await tomarFotoConCamara()
        : await elegirDesdGaleria();

      if (!imagen) {
        // Usuario canceló el picker — volvemos a idle sin error
        setEstado('idle');
        return;
      }

      setEstado('procesando');
      const scan = await escanearRecibo({ imagen, categorias: nombresCategoria });

      if (!scan.es_recibo) {
        setEstado('error');
        setErrorMsg(
          scan.nota
            ?? 'La imagen no parece un recibo o factura. Intenta con otra foto más clara.',
        );
        return;
      }

      setResultado(scan);
      setEstado('confirmacion');

    } catch (e: any) {
      setEstado('error');
      setErrorMsg(e.message ?? 'Ocurrió un error inesperado. Inténtalo de nuevo.');
    }
  };

  // ─── Flujo: confirmación → registro ──────────────────────────────────────

  const handleConfirmar = async (data: ReceiptConfirmData) => {
    try {
      setEstado('guardando');
      // Reutiliza la función EXISTENTE de FinanceContext — sin modificarla
      addExpense(
        data.monto,
        data.categoria,
        data.fecha,
        data.descripcion || data.comercio || undefined,
        data.subcategoria,
      );
      setEstado('exito');
      setTimeout(onGastoRegistrado, 800);
    } catch (e: any) {
      setEstado('error');
      setErrorMsg(e.message ?? 'No se pudo guardar el gasto.');
    }
  };

  const reintentar = () => {
    setEstado('idle');
    setResultado(null);
    setErrorMsg('');
  };

  const s = makeStyles(colors);

  // ─── Estado: confirmación ─────────────────────────────────────────────────
  if ((estado === 'confirmacion' || estado === 'guardando') && resultado) {
    return (
      <ReceiptConfirmScreen
        resultado={resultado}
        onConfirmar={handleConfirmar}
        onCancelar={reintentar}
        guardando={estado === 'guardando'}
      />
    );
  }

  // ─── Estado: éxito ────────────────────────────────────────────────────────
  if (estado === 'exito') {
    return (
      <View style={[s.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[s.exitoIcono, { backgroundColor: colors.incomeLight }]}>
          <Icon name="check-circle" size={48} color={colors.income} />
        </View>
        <Text style={[s.exitoTitulo, { color: colors.textPrimary }]}>¡Gasto registrado!</Text>
        <Text style={[s.exitoSub, { color: colors.textSecondary }]}>
          El gasto del recibo fue guardado correctamente.
        </Text>
      </View>
    );
  }

  // ─── Estados: idle / capturando / procesando / error ─────────────────────
  return (
    <ScrollView
      style={[s.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onCancelar} style={s.backBtn}
          disabled={estado === 'procesando'}>
          <Icon name="arrow-left" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[s.titulo, { color: colors.textPrimary }]}>Escanear recibo</Text>
      </View>

      {/* Ícono principal */}
      <View style={[s.iconoWrap, { backgroundColor: colors.primaryLight }]}>
        <Text style={s.iconoEmoji}>🧾</Text>
      </View>

      <Text style={[s.subtitulo, { color: colors.textSecondary }]}>
        Toma una foto clara del recibo o elige una de tu galería.
        La IA extrae el monto, la fecha y la categoría automáticamente.
      </Text>

      {/* Estado: procesando */}
      {estado === 'procesando' && (
        <View style={[s.procesandoCard, { backgroundColor: colors.card }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[s.procesandoTxt, { color: colors.textPrimary }]}>
            Analizando recibo…
          </Text>
          <Text style={[s.procesandoSub, { color: colors.textSecondary }]}>
            La IA está leyendo los datos. Esto puede tardar unos segundos.
          </Text>
        </View>
      )}

      {/* Estado: error */}
      {estado === 'error' && (
        <View style={[s.errorCard, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
          <Icon name="alert-circle" size={20} color={colors.danger} />
          <Text style={[s.errorTxt, { color: colors.expense }]}>{errorMsg}</Text>
          <TouchableOpacity onPress={reintentar} style={[s.reintentar, { borderColor: colors.danger }]}>
            <Text style={[{ color: colors.expense, fontWeight: '600' }]}>Intentar de nuevo</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tips */}
      {estado === 'idle' && (
        <View style={[s.tipsCard, { backgroundColor: colors.card }]}>
          <Text style={[s.tipsTitle, { color: colors.textSecondary }]}>Para mejores resultados:</Text>
          {[
            'Asegúrate de que el total sea visible',
            'Buena iluminación, sin sombras sobre el recibo',
            'Foto de frente, sin ángulo',
            'El texto debe estar nítido, no borroso',
          ].map((tip, i) => (
            <View key={i} style={s.tipRow}>
              <Text style={[s.tipBullet, { color: colors.primary }]}>•</Text>
              <Text style={[s.tipTxt, { color: colors.textSecondary }]}>{tip}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Botones de acción */}
      {estado !== 'procesando' && (
        <View style={s.botones}>
          <TouchableOpacity
            style={[s.btnPrimario, { backgroundColor: colors.primary }]}
            onPress={() => procesarImagen('camara')}
            activeOpacity={0.85}
          >
            <Icon name="camera" size={20} color="#fff" />
            <Text style={s.btnPrimarioTxt}>Tomar foto</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.btnSecundario, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => procesarImagen('galeria')}
            activeOpacity={0.85}
          >
            <Icon name="image" size={20} color={colors.primary} />
            <Text style={[s.btnSecundarioTxt, { color: colors.primary }]}>Elegir de galería</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Badge Premium / info */}
      <View style={[s.infoBadge, { backgroundColor: colors.aiLight }]}>
        <Icon name="zap" size={13} color={colors.ai} />
        <Text style={[s.infoBadgeTxt, { color: colors.aiText }]}>
          Powered by Claude Haiku — análisis en segundos
        </Text>
      </View>
    </ScrollView>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  centered:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header:        { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  backBtn:       { padding: 8, marginRight: 8 },
  titulo:        { fontSize: 20, fontWeight: '700' },
  iconoWrap:     {
    width: 88, height: 88, borderRadius: 44,
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  iconoEmoji:    { fontSize: 44 },
  subtitulo:     { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  procesandoCard:{ borderRadius: 16, padding: 24, alignItems: 'center', gap: 12, marginBottom: 20 },
  procesandoTxt: { fontSize: 17, fontWeight: '700', marginTop: 8 },
  procesandoSub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  errorCard:     {
    borderWidth: 1, borderRadius: 14, padding: 16, gap: 10,
    alignItems: 'flex-start', marginBottom: 20,
  },
  errorTxt:      { fontSize: 14, lineHeight: 20, flex: 1 },
  reintentar:    { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, marginTop: 4 },
  tipsCard:      { borderRadius: 16, padding: 16, marginBottom: 24, gap: 6 },
  tipsTitle:     { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  tipRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipBullet:     { fontSize: 16, lineHeight: 20 },
  tipTxt:        { fontSize: 13, lineHeight: 19, flex: 1 },
  botones:       { gap: 12, marginBottom: 20 },
  btnPrimario:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    borderRadius: 16, paddingVertical: 16,
  },
  btnPrimarioTxt:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecundario:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    borderRadius: 16, paddingVertical: 16, borderWidth: 1,
  },
  btnSecundarioTxt:{ fontSize: 16, fontWeight: '600' },
  infoBadge:     {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'center',
  },
  infoBadgeTxt:  { fontSize: 12, fontWeight: '500' },
  exitoIcono:    { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  exitoTitulo:   { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  exitoSub:      { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
