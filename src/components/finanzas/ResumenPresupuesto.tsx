import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface Props {
  salario: number;
  totalPresupuesto: number;
}

const fmtCOP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO").replace(/,/g, ".");

export const ResumenPresupuesto: React.FC<Props> = ({ salario, totalPresupuesto }) => {
  const disponible = salario - totalPresupuesto;
  const pct = salario > 0 ? Math.min(100, (totalPresupuesto / salario) * 100) : 0;
  const barColor = pct >= 80 ? "#F07070" : pct >= 60 ? "#FBBF24" : "#4CAF82";
  const comprometidoColor = pct >= 80 ? "#F07070" : pct >= 60 ? "#FBBF24" : "#4CAF82";

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
        <Text style={[s.valueBold, { color: disponible < 0 ? "#F07070" : "#4CAF82" }]}>{fmtCOP(Math.abs(disponible))}</Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", padding: 16, gap: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rightCol: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 13, color: "#6B7280", flex: 1 },
  valueBold: { fontSize: 15, fontWeight: "700", color: "#111827" },
  pctBadge: { fontSize: 12, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#F3F4F6" },
  barTrack: { height: 6, backgroundColor: "#F3F4F6", borderRadius: 3 },
  barFill: { height: 6, borderRadius: 3 },
});