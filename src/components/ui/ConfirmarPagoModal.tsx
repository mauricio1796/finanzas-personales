import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Modal, Animated, TouchableOpacity, TextInput, Keyboard, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from "react-native";
import { useFinance } from "../../state";
import { aiService } from "../../services/ai/AIService";

interface Props { visible: boolean; compromiso: any | null; onClose: () => void; }
const fmtCOP = (n: number) => "$" + Math.round(Math.abs(n)).toLocaleString("es-CO").replace(/,/g, ".");
const FINN = String.fromCharCode(9672);

export const ConfirmarPagoModal: React.FC<Props> = ({ visible, compromiso, onClose }) => {
  const { markCategoryPaid, profile, categories } = useFinance();
  const [step, setStep] = useState<"input" | "analyzing" | "result">("input");
  const [monto, setMonto] = useState("");
  const [finnMsg, setFinnMsg] = useState("");
  const [focused, setFocused] = useState(false);
  const slideAnim = useRef(new Animated.Value(500)).current;
  const backdropOp = useRef(new Animated.Value(0)).current;
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && compromiso) {
      setStep("input"); setMonto(""); setFinnMsg(""); Keyboard.dismiss();
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 65, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 500, duration: 250, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, compromiso]);

  const animateDots = () => {
    const mk = (a: Animated.Value, delay: number) => Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: -6, duration: 300, delay, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(400),
    ]));
    Animated.parallel([mk(d1, 0), mk(d2, 150), mk(d3, 300)]).start();
  };

  const handleConfirm = () => {
    Keyboard.dismiss();
    const montoPagado = parseInt(monto.replace(/[.]/g, ""), 10) || (compromiso?.budget || 0);
    setStep("analyzing");
    animateDots();
    setTimeout(() => {
      markCategoryPaid(compromiso.id);
      const salario = profile?.monthlySalary || 0;
      const total = categories.filter((c: any) => c.tipo).reduce((s: number, c: any) => s + (c.budget || 0), 0);
      const msg = (aiService as any).analyzePago
        ? (aiService as any).analyzePago(compromiso, montoPagado, new Date(), salario, total)
        : "Pago registrado. Ganas +50 XP!";
      setFinnMsg(msg);
      setStep("result");
    }, 1400);
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 500, duration: 250, useNativeDriver: true }),
      Animated.timing(backdropOp, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  if (!compromiso) return null;

return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <Animated.View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", opacity: backdropOp, justifyContent: "flex-end" }}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
              <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
                {/* HEADER */}
                <View style={s.handle} />
                <View style={s.headerRow}>
                  <View style={s.finnAvatar}>
                    <Text style={s.finnSymbol}>{FINN}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.finnName}>Finn</Text>
                    <Text style={s.finnSub}>Tu asistente de pagos</Text>
                  </View>
                  <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
                    <Text style={s.closeX}>x</Text>
                  </TouchableOpacity>
                </View>
                {/* STEP: input */}
                {step === "input" && (
                  <View style={s.body}>
                    <View style={s.compromisCard}>
                      <Text style={s.catIcon}>{compromiso.icon || "📦"}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.catName}>{compromiso.name}</Text>
                        <Text style={s.catBudget}>Presupuesto: {fmtCOP(compromiso.budget || 0)}</Text>
                        {compromiso.diaPago ? (
                          <Text style={s.catDay}>Dia de pago: {compromiso.diaPago === 0 ? "Ultimo del mes" : "Dia " + compromiso.diaPago}</Text>
                        ) : null}
                      </View>
                    </View>
                    <Text style={s.inputLabel}>Monto pagado (COP)</Text>
                    <TextInput
                      style={[s.montoInput, focused && s.montoInputFocused]}
                      placeholder={fmtCOP(compromiso.budget || 0)}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={monto}
                      onChangeText={(txt) => { const d = txt.replace(/\./g, '').replace(/[^0-9]/g, ''); const n = parseInt(d, 10); setMonto(isNaN(n) ? '' : n.toLocaleString('es-CO').replace(/,/g, '.')); }}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                    />
                    <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm} activeOpacity={0.82}>
                      <Text style={s.confirmBtnText}>Confirmar pago</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {/* STEP: analyzing */}
                {step === "analyzing" && (
                  <View style={[s.body, s.centerBody]}>
                    <View style={s.finnAvatarLg}>
                      <Text style={s.finnSymbolLg}>{FINN}</Text>
                    </View>
                    <Text style={s.analyzingTitle}>Finn esta analizando...</Text>
                    <View style={s.dotsRow}>
                      <Animated.View style={[s.dot, { transform: [{ translateY: d1 }] }]} />
                      <Animated.View style={[s.dot, { transform: [{ translateY: d2 }] }]} />
                      <Animated.View style={[s.dot, { transform: [{ translateY: d3 }] }]} />
                    </View>
                  </View>
                )}
                {/* STEP: result */}
                {step === "result" && (
                  <View style={s.body}>
                    <View style={s.resultCard}>
                      <Text style={s.checkCircle}>✓</Text>
                      <Text style={s.resultTitle}>Pago registrado!</Text>
                      <Text style={s.xpBadge}>+50 XP</Text>
                    </View>
                    <View style={s.finnMsgCard}>
                      <View style={s.finnAvatarSm}>
                        <Text style={s.finnSymbol}>{FINN}</Text>
                      </View>
                      <Text style={s.finnMsg}>{finnMsg}</Text>
                    </View>
                    <TouchableOpacity style={s.closeFullBtn} onPress={handleClose} activeOpacity={0.82}>
                      <Text style={s.closeFullBtnText}>Listo</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Animated.View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const s = StyleSheet.create({
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginTop: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  finnAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#6366F1", alignItems: "center", justifyContent: "center" },
  finnSymbol: { fontSize: 20, color: "#FFFFFF", fontWeight: "700" },
  finnName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  finnSub: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  closeX: { fontSize: 16, color: "#6B7280", fontWeight: "600" },
  body: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  centerBody: { alignItems: "center", paddingVertical: 32 },
  compromisCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E5E7EB" },
  catIcon: { fontSize: 28 },
  catName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  catBudget: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  catDay: { fontSize: 12, color: "#9CA3AF", marginTop: 1 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
  montoInput: { backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 24, fontWeight: "700", color: "#111827", textAlign: "center" },
  montoInputFocused: { borderColor: "#6366F1", borderWidth: 2 },
  confirmBtn: { backgroundColor: "#6366F1", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  confirmBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  finnAvatarLg: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#6366F1", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  finnSymbolLg: { fontSize: 34, color: "#FFFFFF", fontWeight: "700" },
  analyzingTitle: { fontSize: 17, fontWeight: "600", color: "#111827", marginBottom: 20 },
  dotsRow: { flexDirection: "row", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#6366F1" },
  resultCard: { alignItems: "center", gap: 8, paddingVertical: 8 },
  checkCircle: { fontSize: 40, color: "#10B981" },
  resultTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  xpBadge: { backgroundColor: "#EEF2FF", color: "#6366F1", fontWeight: "700", fontSize: 13, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  finnMsgCard: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(99,102,241,0.15)" },
  finnAvatarSm: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#6366F1", alignItems: "center", justifyContent: "center" },
  finnMsg: { flex: 1, fontSize: 14, color: "#374151", lineHeight: 21 },
  closeFullBtn: { backgroundColor: "#111827", borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  closeFullBtnText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
