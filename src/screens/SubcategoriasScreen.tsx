import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useFinance } from '../state';
import { useTheme } from '../state/ThemeContext';
import { Icon } from '../components/ui/Icon';
import { Category } from '../types';
import { generarIdCategoria } from '../utils/categoryUtils';
import { getSubcategoriasParaCategoria } from '../constants/catalogoSubcategorias';

const ICONOS = [
  'tag', 'zap', 'droplet', 'thermometer', 'wifi', 'phone', 'tv', 'trash-2',
  'shopping-cart', 'coffee', 'truck', 'home', 'tool', 'shield', 'credit-card',
  'heart', 'activity', 'book-open', 'monitor', 'music', 'film', 'camera',
  'gift', 'map-pin', 'navigation', 'package', 'sun', 'moon', 'wind', 'cpu',
  'users', 'edit', 'scissors', 'watch', 'star', 'smartphone', 'dollar-sign',
  'briefcase', 'layers', 'code', 'pen-tool', 'bar-chart-2', 'trending-up',
];

interface Props {
  parentCategory: Category;
  visible: boolean;
  onClose: () => void;
}

export const SubcategoriasScreen: React.FC<Props> = ({ parentCategory, visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { categories, transactions, addCategory, updateCategory, deleteCategory } = useFinance();

  const subcategorias = useMemo(
    () => categories.filter(c => c.parentCategoryId === parentCategory.id),
    [categories, parentCategory.id],
  );

  // Cuánto se gastó en cada etiqueta este mes
  const now = useMemo(() => new Date(), []);
  const gastosPorSub = useMemo(() => {
    const result: Record<string, number> = {};
    transactions
      .filter(t => {
        const d = new Date(t.date);
        return t.type === 'expense'
          && !!t.subcategory
          && d.getMonth() === now.getMonth()
          && d.getFullYear() === now.getFullYear();
      })
      .forEach(t => { result[t.subcategory!] = (result[t.subcategory!] || 0) + t.amount; });
    return result;
  }, [transactions, now]);

  const fmtCOP = (n: number) => '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');

  // Sugerencias del catálogo que no existen aún
  const sugeridas = useMemo(() => {
    const existentes = new Set(subcategorias.map(s => s.name.toLowerCase()));
    return getSubcategoriasParaCategoria(parentCategory.name).filter(
      s => !existentes.has(s.nombre.toLowerCase()),
    );
  }, [parentCategory.name, subcategorias]);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [formVisible, setFormVisible] = useState(false);
  const [editando, setEditando] = useState<Category | null>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formIcono, setFormIcono] = useState('tag');
  const [error, setError] = useState('');

  const abrirAgregar = useCallback((icono?: string, nombre?: string) => {
    setEditando(null);
    setFormNombre(nombre ?? '');
    setFormIcono(icono ?? 'tag');
    setError('');
    setFormVisible(true);
  }, []);

  const abrirEditar = useCallback((sub: Category) => {
    setEditando(sub);
    setFormNombre(sub.name);
    setFormIcono(sub.icon ?? 'tag');
    setError('');
    setFormVisible(true);
  }, []);

  const guardar = useCallback(() => {
    const nombre = formNombre.trim();
    if (nombre.length < 2) { setError('Mínimo 2 caracteres'); return; }
    const dup = subcategorias.find(
      s => s.name.toLowerCase() === nombre.toLowerCase() && s.id !== editando?.id,
    );
    if (dup) { setError('Ya existe una etiqueta con ese nombre'); return; }

    if (editando) {
      updateCategory(editando.id, { name: nombre, icon: formIcono });
    } else {
      addCategory({
        id: generarIdCategoria(),
        name: nombre,
        icon: formIcono,
        tipo: parentCategory.tipo ?? 'gasto',
        isSelected: true,
        pagado: false,
        parentCategoryId: parentCategory.id,
        fechaCreacion: new Date().toISOString(),
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setFormVisible(false);
  }, [formNombre, formIcono, editando, subcategorias, parentCategory, addCategory, updateCategory]);

  const confirmarEliminar = useCallback((sub: Category) => {
    Alert.alert(
      'Eliminar etiqueta',
      `¿Eliminar "${sub.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteCategory(sub.id) },
      ],
    );
  }, [deleteCategory]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>

        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={[s.iconBtn, { backgroundColor: colors.cardSecondary }]}>
            <Icon name="x" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Etiquetas de gasto</Text>
            <Text style={[s.headerSub, { color: colors.textTertiary }]}>{parentCategory.name}</Text>
          </View>
          <TouchableOpacity
            onPress={() => abrirAgregar()}
            style={[s.iconBtn, { backgroundColor: colors.primaryLight }]}
          >
            <Icon name="plus" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Descripción */}
        <View style={[s.infoBanner, { backgroundColor: colors.primaryLight }]}>
          <Icon name="info" size={14} color={colors.primary} />
          <Text style={[s.infoText, { color: colors.primary }]}>
            Las etiquetas te ayudan a ver <Text style={{ fontWeight: '700' }}>en qué específico gastaste</Text> dentro de {parentCategory.name}. No tienen presupuesto propio.
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

          {/* Etiquetas existentes */}
          {subcategorias.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>MIS ETIQUETAS</Text>
              <View style={s.chipsWrap}>
                {subcategorias.map(sub => {
                  const gastado = gastosPorSub[sub.id] ?? 0;
                  return (
                    <View key={sub.id} style={[s.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={[s.chipIcon, { backgroundColor: colors.primaryLight }]}>
                        <Icon name={(sub.icon ?? 'tag') as any} size={13} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.chipName, { color: colors.textPrimary }]}>{sub.name}</Text>
                        {gastado > 0 && (
                          <Text style={[s.chipGasto, { color: colors.expense }]}>{fmtCOP(gastado)} este mes</Text>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => abrirEditar(sub)} style={s.chipAction}>
                        <Icon name="edit-2" size={13} color={colors.textTertiary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmarEliminar(sub)} style={s.chipAction}>
                        <Icon name="trash-2" size={13} color={colors.expense} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Estado vacío */}
          {subcategorias.length === 0 && (
            <View style={[s.emptyWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name="tag" size={32} color={colors.textTertiary} />
              <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>Sin etiquetas aún</Text>
              <Text style={[s.emptyDesc, { color: colors.textTertiary }]}>
                Agrega etiquetas para saber exactamente en qué gastas dentro de {parentCategory.name}
              </Text>
              <TouchableOpacity
                onPress={() => abrirAgregar()}
                style={[s.emptyBtn, { backgroundColor: colors.primaryLight }]}
              >
                <Icon name="plus" size={13} color={colors.primary} />
                <Text style={[s.emptyBtnText, { color: colors.primary }]}>Crear etiqueta</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Sugeridas del catálogo */}
          {sugeridas.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { color: colors.textTertiary, marginTop: 24 }]}>
                SUGERIDAS PARA {parentCategory.name.toUpperCase()}
              </Text>
              <Text style={[s.sectionDesc, { color: colors.textTertiary }]}>
                Toca para agregar al instante
              </Text>
              <View style={s.sugeridosWrap}>
                {sugeridas.map(sg => (
                  <TouchableOpacity
                    key={sg.nombre}
                    onPress={() => {
                      addCategory({
                        id: generarIdCategoria(),
                        name: sg.nombre,
                        icon: sg.icono,
                        tipo: parentCategory.tipo ?? 'gasto',
                        isSelected: true,
                        pagado: false,
                        parentCategoryId: parentCategory.id,
                        fechaCreacion: new Date().toISOString(),
                      });
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    }}
                    style={[s.sugeridoChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <Icon name={sg.icono as any} size={13} color={colors.primary} />
                    <Text style={[s.sugeridoText, { color: colors.textPrimary }]}>{sg.nombre}</Text>
                    <Icon name="plus" size={12} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Form modal — solo nombre + ícono */}
        <Modal
          visible={formVisible}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setFormVisible(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colors.background }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              contentContainerStyle={[s.formContent, { paddingTop: insets.top + 8 }]}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[s.formHeader, { borderBottomColor: colors.border }]}>
                <Text style={[s.formTitle, { color: colors.textPrimary }]}>
                  {editando ? 'Editar etiqueta' : 'Nueva etiqueta'}
                </Text>
                <TouchableOpacity
                  onPress={() => setFormVisible(false)}
                  style={[s.iconBtn, { backgroundColor: colors.cardSecondary }]}
                >
                  <Icon name="x" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={[s.parentLabel, { color: colors.textTertiary }]}>
                Etiqueta de: <Text style={{ color: colors.primary, fontWeight: '700' }}>{parentCategory.name}</Text>
              </Text>

              {error ? (
                <View style={[s.errorBox, { backgroundColor: colors.expenseLight }]}>
                  <Text style={[s.errorText, { color: colors.expense }]}>{error}</Text>
                </View>
              ) : null}

              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>NOMBRE DE LA ETIQUETA</Text>
              <TextInput
                value={formNombre}
                onChangeText={t => { setFormNombre(t); setError(''); }}
                placeholder="Ej: Gas, Agua, Luz..."
                placeholderTextColor={colors.textTertiary}
                style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
                maxLength={30}
                autoFocus={!editando}
              />

              <Text style={[s.fieldLabel, { color: colors.textSecondary, marginTop: 20 }]}>ÍCONO</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                {ICONOS.map(ic => (
                  <TouchableOpacity
                    key={ic}
                    onPress={() => setFormIcono(ic)}
                    style={[
                      s.iconChip,
                      {
                        backgroundColor: formIcono === ic ? colors.primaryLight : colors.cardSecondary,
                        borderColor: formIcono === ic ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <Icon name={ic as any} size={18} color={formIcono === ic ? colors.primary : colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                onPress={guardar}
                style={[s.saveBtn, { backgroundColor: colors.primary }]}
              >
                <Icon name="check" size={16} color="#fff" />
                <Text style={s.saveBtnText}>{editando ? 'Guardar cambios' : 'Crear etiqueta'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, gap: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 13, marginTop: 1 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    padding: 12, borderRadius: 10,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },

  scroll: { padding: 16 },

  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  sectionDesc: { fontSize: 12, marginBottom: 10, marginTop: -4 },

  chipsWrap: { gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  chipIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  chipName: { fontSize: 14, fontWeight: '600' },
  chipGasto: { fontSize: 12, marginTop: 1 },
  chipAction: { padding: 4 },

  emptyWrap: {
    borderRadius: 14, borderWidth: 1,
    padding: 32, alignItems: 'center', gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 8,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700' },

  sugeridosWrap: { gap: 8 },
  sugeridoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11,
  },
  sugeridoText: { flex: 1, fontSize: 14, fontWeight: '600' },

  // Form
  formContent: { padding: 20, paddingBottom: 60 },
  formHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 16, borderBottomWidth: 1, marginBottom: 16,
  },
  formTitle: { fontSize: 18, fontWeight: '700' },
  parentLabel: { fontSize: 13, marginBottom: 20 },
  errorBox: { borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { fontSize: 13, fontWeight: '600' },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, fontWeight: '500' },
  iconChip: {
    width: 44, height: 44, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 16, borderRadius: 12, marginTop: 24,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
