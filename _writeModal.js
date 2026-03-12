const fs=require("fs");
const p="c:/Users/USUARIO/OneDrive/Desktop/FinancyAi/finanzas-personales/src/components/ui/ConfirmarPagoModal.tsx";
const jsx = [
  "  return (",
  "    <Modal transparent visible={visible} animationType={null} onRequestClose={handleClose}>",
  "      <KeyboardAvoidingView style={s.root}>",
].join("
");
fs.appendFileSync(p, jsx + "
");
console.log("done");
