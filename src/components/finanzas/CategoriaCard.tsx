import React, { useRef, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, ActionSheetIOS, Platform, Alert } from "react-native";
import { Category } from "../../types";
import { THEME } from "../../constants/theme";
import { useTheme } from "../../state/ThemeContext";
import { AppColors } from "../../constants/colors";

interface Props {
  category: Category;
  gastado: number;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePaid: () => void;
}

const fmtCOP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO").replace(/,/g, ".");

export const CategoriaCard: React.FC<Props> = ({ category, gastado, onEdit, onDelete, onTogglePaid }) => {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const presupuesto = category.budget ?? 0;
  const pct = presupuesto > 0 ? Math.min(100, (gastado / presupuesto) * 100) : 0;
  const barColor    = pct >= 100 ? colors.expense : pct >= 80 ? "#FBBF24" : "#4CAF82";
  const amountColor = gastado === 0 ? colors.textTertiary : gastado >= presupuesto ? colors.expense : colors.textPrimary;
  const opacity     = category.pagado ? 0.72 : 1;
  const iconBg      = category.color ? category.color + "26" : colors.cardSecondary;

  const barAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(barAnim, { toValue: pct, duration: 600, useNativeDriver: false }).start();
  }, [pct]);

  const getDueDayStatus = (diaPago?: number) => {
    if (!diaPago) return null;
    const diff = diaPago - new Date().getDate();
    if (diff === 0) return { label: "Vence hoy",         color: colors.expense };
    if (diff > 0 && diff <= 3) return { label: "Vence en " + diff + " dias", color: "#FBBF24" };
    return { label: "Dia " + diaPago, color: colors.textTertiary };
  };
  const dueStatus = getDueDayStatus(category.diaPago);

  const showMenu = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancelar", "Editar", category.pagado ? "Desmarcar pagado" : "Marcar pagado", "Eliminar"], cancelButtonIndex: 0, destructiveButtonIndex: 3 },
        (idx) => { if (idx === 1) onEdit(); if (idx === 2) onTogglePaid(); if (idx === 3) onDelete(); }
      );
    } else {
      Alert.alert(category.name, "", [
        { text: "Editar", onPress: onEdit },
        { text: category.pagado ? "Desmarcar pagado" : "Marcar pagado", onPress: onTogglePaid },
        { text: "Eliminar", style: "destructive", onPress: onDelete },
        { text: "Cancelar", style: "cancel" },
      ]);
    }
  };

  return (
    <View style={[s.card, { opacity }]}>
      <View style={s.topRow}>
        <View style={[s.iconCircle, { backgroundColor: iconBg }]}>
          <Text style={s.iconText}>{category.icon ?? "📦"}</Text>
        </View>
        <View style={s.mid}>
          <View style={s.nameLine}>
            <Text style={s.name}>{category.name}</Text>
            <Text style={[s.amount, { color: amountColor }]}>{fmtCOP(presupuesto)}</Text>
          </View>
          <View style={s.subLine}>
            <Text style={s.sub}>{category.tipo === "fijo" ? "Fijo" : "Variable"}{dueStatus ? " · " + dueStatus.label : ""}</Text>
            {category.pagado ? (
              <View style={s.paidBadge}><Text style={s.paidText}>Pagado</Text></View>
            ) : dueStatus && dueStatus.color === colors.expense ? (
              <View style={[s.badge, { backgroundColor: colors.expenseLight }]}><Text style={[s.badgeText, { color: colors.expense }]}>Vence hoy</Text></View>
            ) : dueStatus && dueStatus.color === "#FBBF24" ? (
              <View style={[s.badge, { backgroundColor: "#FEF3C7" }]}><Text style={[s.badgeText, { color: "#D97706" }]}>{dueStatus.label}</Text></View>
            ) : (
              <View style={[s.badge, { backgroundColor: colors.cardSecondary }]}><Text style={[s.badgeText, { color: colors.textSecondary }]}>Pendiente</Text></View>
            )}
          </View>
        </View>
        <TouchableOpacity onPress={showMenu} style={s.menuBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={s.menuDots}>···</Text>
        </TouchableOpacity>
      </View>
      <View style={s.barTrack}>
        <Animated.View style={[s.barFill, { width: barAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }), backgroundColor: barColor }]} />
      </View>
      {gastado > 0 && (
        <Text style={s.gastadoText}>Gastado: {fmtCOP(gastado)} · {Math.round(pct)}%</Text>
      )}
    </View>
  );
};

const makeStyles = (colors: AppColors) => StyleSheet.create({
  card:        { backgroundColor: colors.card, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  topRow:      { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconCircle:  { width: 44, height: 44, borderRadius: THEME.radius.md, alignItems: "center", justifyContent: "center" },
  iconText:    { fontSize: 22 },
  mid:         { flex: 1, gap: 4 },
  nameLine:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name:        { fontSize: 15, fontWeight: "700", color: colors.textPrimary, flex: 1 },
  amount:      { fontSize: 15, fontWeight: "700" },
  subLine:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sub:         { fontSize: 12, color: colors.textTertiary, flex: 1 },
  menuBtn:     { padding: 4 },
  menuDots:    { fontSize: 18, color: colors.textTertiary, letterSpacing: 2 },
  barTrack:    { height: 4, backgroundColor: colors.cardSecondary, borderRadius: 2 },
  barFill:     { height: 4, borderRadius: 2 },
  gastadoText: { fontSize: 11, color: colors.textTertiary },
  paidBadge:   { backgroundColor: colors.incomeLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  paidText:    { fontSize: 11, fontWeight: "600", color: colors.income },
  badge:       { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText:   { fontSize: 11, fontWeight: "600" },
});
