import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { THEME } from "../../constants/theme";

interface Props {
  salario: number;
  totalPresupuesto: number;
}

const fmtCOP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO").replace(/,/g, ".");

export const ResumenPresupuesto: React.FC<Props> = ({ salario, totalPresupuesto }) => {
  const disponible = salario - totalPresupuesto;
  const pct = salario > 0 ? Math.min(100, (totalPresupuesto / salario) * 100) : 0;
  const barColor = pct >= 80 ? THEME.colors.expense : pct >= 60 ? "#FBBF24" : "#4CAF82";
  const comprometidoColor = pct >= 80 ? THEME.colors.expense : pct >= 60 ? "#FBBF24" : "#4CAF82";

  return (
    <View style={s.card}>
      <View style={s.row}>
        <Text style={s.label}>Sueldo mensual</Text>
        <Text style={s.valueBold}>{fmtCOP(salario)}</Text>
      </View>
      <View style={s.divider} />
      <View style={s.row}>
        <Text style={s.label}>Comprometido en gastos</Text>
        <View style={s.rightCol}>
          <Text style={[s.valueBold, { color: comprometidoColor }]}>{fmtCOP(totalPresupuesto)}</Text>
          <Text style={[s.pctBadge, { color: comprometidoColor }]}>{Math.round(pct)}%</Text>
        </View>
      </View>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: (pct + "%") as any, backgroundColor: barColor }]} />
      </View>
      <View style={s.row}>
        <Text style={s.label}>{disponible < 0 ? "⚠️ Gastos superan el sueldo" : "Disponible real"}</Text>
        <Text style={[s.valueBold, { color: disponible < 0 ? THEME.colors.expense : "#4CAF82" }]}>{fmtCOP(Math.abs(disponible))}</Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  card: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.border, padding: 16, gap: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rightCol: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 13, color: THEME.colors.textSecondary, flex: 1 },
  valueBold: { fontSize: 15, fontWeight: "700", color: THEME.colors.textPrimary },
  pctBadge: { fontSize: 12, fontWeight: "700" },
  divider: { height: 1, backgroundColor: THEME.colors.surfaceSecondary },
  barTrack: { height: 6, backgroundColor: THEME.colors.surfaceSecondary, borderRadius: 3 },
  barFill: { height: 6, borderRadius: 3 },
});