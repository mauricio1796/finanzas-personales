export interface PasoLeccion {
  tipo: 'texto' | 'concepto' | 'ejemplo' | 'tip';
  titulo: string; contenido: string; icon: string;
}
export interface PreguntaQuiz {
  pregunta: string; opciones: string[]; correcta: number; explicacion: string;
}
export interface Leccion {
  id: string; titulo: string; descripcion: string; duracionMin: number;
  xpRecompensa: number; nivel: 'basico' | 'intermedio' | 'avanzado';
  categoria: 'ahorro' | 'deuda' | 'inversion' | 'impuestos' | 'colombia';
  isPremium: boolean; pasos: PasoLeccion[]; quiz: PreguntaQuiz[];
}
export const LECCIONES: Leccion[] = [
  {
    id: 'l001', titulo: 'Que es el 4x1000',
    descripcion: 'El impuesto que te cobran cada vez que mueves dinero en Colombia',
    duracionMin: 3, xpRecompensa: 40, nivel: 'basico', categoria: 'colombia', isPremium: false,
    pasos: [
      { tipo: 'concepto', titulo: 'Que es el GMF', icon: 'bank',
        contenido: 'El Gravamen a los Movimientos Financieros (GMF) es un impuesto del 0.4% sobre cada transaccion: retiros, transferencias, pagos con debito.' },
      { tipo: 'ejemplo', titulo: 'En la practica', icon: 'trending-up',
        contenido: 'Si retiras $500.000 del cajero, pagas $2.000. Si transfieres $1.000.000, pagas $4.000. Se descuenta automaticamente.' },
      { tipo: 'tip', titulo: 'Como evitarlo legalmente', icon: 'check-circle',
        contenido: 'Puedes exonerar UNA cuenta bancaria por persona del 4x1000 declarandola ante el banco como cuenta de ahorro exenta.' },
      { tipo: 'texto', titulo: 'Deduccion en renta', icon: 'file-text',
        contenido: 'El 50% del 4x1000 pagado durante el ano es deducible de tu declaracion de renta. Guarda los soportes.' },
    ],
    quiz: [
      { pregunta: 'Cuanto te cobran de 4x1000 si retiras $200.000?',
        opciones: ['$80', '$800', '$8.000', '$200'], correcta: 1,
        explicacion: '0.4% de $200.000 = $800. Por eso se llama 4x1000.' },
      { pregunta: 'Cuantas cuentas bancarias puedes exonerar del 4x1000?',
        opciones: ['Ninguna', 'Una', 'Dos', 'Todas'], correcta: 1,
        explicacion: 'Solo puedes exonerar UNA cuenta bancaria por persona.' },
    ],
  },
  {
    id: 'l002', titulo: 'La regla del 50-30-20',
    descripcion: 'El sistema de presupuesto mas simple y efectivo del mundo',
    duracionMin: 4, xpRecompensa: 40, nivel: 'basico', categoria: 'ahorro', isPremium: false,
    pasos: [
      { tipo: 'concepto', titulo: 'En que consiste', icon: 'pie-chart',
        contenido: '50% para necesidades (arriendo, comida, servicios), 30% para deseos (entretenimiento, ropa), 20% para ahorro e inversion.' },
      { tipo: 'ejemplo', titulo: 'Con salario colombiano', icon: 'dollar-sign',
        contenido: 'Si ganas $2.500.000 netos: $1.250.000 necesidades, $750.000 ocio, $500.000 ahorro.' },
      { tipo: 'tip', titulo: 'Ajuste para deudas', icon: 'credit-card',
        contenido: 'Si tienes deudas activas, cambia temporalmente a 50-20-30: el 30% va a pagar deuda agresivamente.' },
    ],
    quiz: [
      { pregunta: 'Con un ingreso de $3.000.000, cuanto va a ahorro segun el 50-30-20?',
        opciones: ['$300.000', '$600.000', '$900.000', '$1.500.000'], correcta: 1,
        explicacion: '20% de $3.000.000 = $600.000 para ahorro e inversion.' },
    ],
  },
  {
    id: 'l003', titulo: 'Fondo de emergencia: tu red de seguridad',
    descripcion: 'Por que necesitas 3-6 meses de gastos guardados',
    duracionMin: 3, xpRecompensa: 40, nivel: 'basico', categoria: 'ahorro', isPremium: false,
    pasos: [
      { tipo: 'concepto', titulo: 'Que es un fondo de emergencia', icon: 'shield',
        contenido: 'Es dinero guardado en cuenta de facil acceso que cubre 3-6 meses de gastos basicos. Para: perdida de empleo, enfermedad, emergencia del carro.' },
      { tipo: 'ejemplo', titulo: 'Cuanto necesitas', icon: 'calculator',
        contenido: 'Si tus gastos basicos son $1.800.000/mes, tu fondo ideal es entre $5.400.000 y $10.800.000. Empieza por 1 mes y ve creciendo.' },
      { tipo: 'tip', titulo: 'Donde guardarlo', icon: 'database',
        contenido: 'Cuenta de ahorros con rendimiento (Nequi, Daviplata) o CDT de corto plazo. NUNCA en inversiones con riesgo ni efectivo en casa.' },
    ],
    quiz: [
      { pregunta: 'Gastos basicos $2.000.000/mes. Cual es el minimo del fondo de emergencia?',
        opciones: ['$1.000.000', '$2.000.000', '$6.000.000', '$20.000.000'], correcta: 2,
        explicacion: '3 meses de gastos basicos = $6.000.000. Es el minimo recomendado.' },
    ],
  },
  {
    id: 'l004', titulo: 'CDTs: haz que tu plata trabaje',
    descripcion: 'La inversion mas segura en Colombia y como aprovecharla',
    duracionMin: 5, xpRecompensa: 60, nivel: 'intermedio', categoria: 'inversion', isPremium: false,
    pasos: [
      { tipo: 'concepto', titulo: 'Que es un CDT', icon: 'file-text',
        contenido: 'Certificado de Deposito a Termino: depositas por tiempo fijo (30-360 dias) y el banco te paga tasa fija. Respaldado por Fogafin hasta $50 millones.' },
      { tipo: 'ejemplo', titulo: 'Rentabilidad 2025-2026', icon: 'trending-up',
        contenido: 'CDTs en Colombia: 10%-14% EA. Si inviertes $5.000.000 a 360 dias al 12% EA, recibes ~$600.000 de intereses.' },
      { tipo: 'tip', titulo: 'Retencion en la fuente', icon: 'alert-circle',
        contenido: 'Los intereses tienen retencion del 7%. De $600.000, el banco retiene $42.000 y te entrega $558.000.' },
      { tipo: 'concepto', titulo: 'Estrategia escalera de CDTs', icon: 'layers',
        contenido: 'Divide tu ahorro en CDTs con distintos vencimientos: 90, 180 y 360 dias. Siempre tendras liquidez parcial sin sacrificar rentabilidad.' },
    ],
    quiz: [
      { pregunta: 'Hasta que monto garantiza Fogafin los CDTs por entidad?',
        opciones: ['$10 millones', '$25 millones', '$50 millones', '$100 millones'], correcta: 2,
        explicacion: 'Fogafin garantiza hasta $50 millones por persona por entidad.' },
      { pregunta: 'Cual es la retencion en la fuente sobre intereses de CDTs?',
        opciones: ['4%', '7%', '10%', '19%'], correcta: 1,
        explicacion: 'El 7% de los rendimientos de CDTs se retiene en la fuente automaticamente.' },
    ],
  },
  {
    id: 'l005', titulo: 'Tarjetas de credito: aliadas o enemigas',
    descripcion: 'Como usarlas para que te paguen a ti, no al banco',
    duracionMin: 5, xpRecompensa: 60, nivel: 'intermedio', categoria: 'deuda', isPremium: false,
    pasos: [
      { tipo: 'concepto', titulo: 'El verdadero costo de la deuda', icon: 'credit-card',
        contenido: 'Las tarjetas en Colombia cobran entre 24% y 32% EA. Una deuda de $1.000.000 sin pagar un mes, al ano puede costar $1.320.000.' },
      { tipo: 'ejemplo', titulo: 'El minimo es una trampa', icon: 'alert-triangle',
        contenido: '$3.000.000 de deuda pagando solo el minimo ($90.000/mes): tardas 5+ anos y pagas el doble en intereses.' },
      { tipo: 'tip', titulo: 'Como usarla a tu favor', icon: 'check-circle',
        contenido: 'Usala como metodo de pago, no como deuda. Compra solo lo que ya tienes en cuenta. Paga el total cada mes y acumula millas o cashback.' },
    ],
    quiz: [
      { pregunta: '$500.000 de deuda al 28% EA. Sin pagarla en 1 ano, cuanto deberas?',
        opciones: ['$514.000', '$590.000', '$640.000', '$780.000'], correcta: 2,
        explicacion: '28% de $500.000 = $140.000 intereses. Total: ~$640.000.' },
    ],
  },
  {
    id: 'l006', titulo: 'Sistema pensional: RPM vs RAIS',
    descripcion: 'Colpensiones vs fondos privados: cual te conviene mas',
    duracionMin: 7, xpRecompensa: 80, nivel: 'avanzado', categoria: 'colombia', isPremium: true,
    pasos: [
      { tipo: 'concepto', titulo: 'Los dos regimenes', icon: 'shield',
        contenido: 'En Colombia: RPM (Colpensiones, Estado) o RAIS (fondos privados: Porvenir, Proteccion, Colfondos). Debes elegir uno.' },
      { tipo: 'ejemplo', titulo: 'Cuando conviene cada uno', icon: 'bar-chart-2',
        contenido: 'Colpensiones: si ganas menos de 2 SMMLV y cotizaras 25+ anos. Fondos privados: si ganas mas de 2 SMMLV.' },
      { tipo: 'concepto', titulo: 'Reforma pensional 2025', icon: 'file-text',
        contenido: 'Ley 2381 de 2024: quienes ganen hasta 2.3 SMMLV cotizaran obligatoriamente a Colpensiones. Quienes ganen mas pueden distribuir.' },
      { tipo: 'tip', titulo: 'Fondos voluntarios de pension', icon: 'trending-up',
        contenido: 'Fondo de Pension Voluntaria (FPV): aportes deducibles de renta hasta el 30% de tu ingreso o 3.800 UVT al ano.' },
    ],
    quiz: [
      { pregunta: 'Que porcentaje del salario va a pension en Colombia (empleado + empleador)?',
        opciones: ['8%', '12%', '16%', '20%'], correcta: 2,
        explicacion: 'Total 16%: empleador 12%, empleado 4%.' },
    ],
  },
  {
    id: 'l007', titulo: 'Cuenta AFC: ahorra para vivienda',
    descripcion: 'La herramienta fiscal mas subutilizada por los colombianos',
    duracionMin: 6, xpRecompensa: 80, nivel: 'avanzado', categoria: 'colombia', isPremium: true,
    pasos: [
      { tipo: 'concepto', titulo: 'Que es la cuenta AFC', icon: 'home',
        contenido: 'Cuenta de Ahorro para el Fomento de la Construccion: aportes exentos de retencion en la fuente y deducibles de renta si el dinero se usa para comprar o construir vivienda.' },
      { tipo: 'ejemplo', titulo: 'Beneficio fiscal real', icon: 'dollar-sign',
        contenido: 'Si ganas $8.000.000/mes y aportas $1.000.000 a AFC: ahorras ~$190.000/mes en retenciones = $2.280.000 al ano.' },
      { tipo: 'tip', titulo: 'Limite y condiciones', icon: 'alert-circle',
        contenido: 'Limite: 30% del ingreso laboral o 3.800 UVT anuales (junto con FPV). Solo para adquirir vivienda o perdera el beneficio.' },
    ],
    quiz: [
      { pregunta: 'Para que fin debe usarse el dinero de la cuenta AFC sin perder el beneficio?',
        opciones: ['Cualquier ahorro', 'Solo para carro', 'Adquirir o construir vivienda', 'Pagar deudas'], correcta: 2,
        explicacion: 'La AFC esta disenada especificamente para fomento de vivienda.' },
    ],
  },
  {
    id: 'l008', titulo: 'Declaracion de renta: quien debe hacerla',
    descripcion: 'Eres declarante? Descubrelo y evita multas',
    duracionMin: 5, xpRecompensa: 70, nivel: 'avanzado', categoria: 'impuestos', isPremium: true,
    pasos: [
      { tipo: 'concepto', titulo: 'Quien debe declarar renta', icon: 'file-text',
        contenido: 'Debes declarar si: ingresos brutos > $59.377.000, patrimonio bruto > $190.854.000, compras/consumos > $59.377.000, o consignaciones > $59.377.000 (ano gravable 2025).' },
      { tipo: 'ejemplo', titulo: 'El error mas comun', icon: 'alert-triangle',
        contenido: 'Muchos con salarios de $4-5 millones creen que no deben declarar porque les hacen retencion. Error: la retencion no exime si superas los topes.' },
      { tipo: 'tip', titulo: 'Renta exenta de empleados', icon: 'check-circle',
        contenido: 'Como empleado tienes renta exenta del 25% de tus pagos laborales (hasta 240 UVT/ano). Deduce tambien: intereses vivienda, medicina prepagada, AFC y FPV.' },
    ],
    quiz: [
      { pregunta: 'Cual de estos NO es criterio para ser declarante de renta?',
        opciones: ['Ingresos > $59 millones', 'Patrimonio > $190 millones', 'Tener tarjeta de credito', 'Consignaciones > $59 millones'],
        correcta: 2, explicacion: 'Tener tarjeta de credito no te hace declarante.' },
    ],
  },
];

export function calcularProgresoAcademia(leccionesCompletadas: string[]) {
  const completadas = LECCIONES.filter(l => leccionesCompletadas.includes(l.id));
  return {
    porcentaje: Math.round((completadas.length / LECCIONES.length) * 100),
    xpTotal: completadas.reduce((sum, l) => sum + l.xpRecompensa, 0),
    basico: completadas.filter(l => l.nivel === 'basico').length,
    intermedio: completadas.filter(l => l.nivel === 'intermedio').length,
    avanzado: completadas.filter(l => l.nivel === 'avanzado').length,
  };
}
export function getLeccionSiguiente(completadas: string[], isPremium: boolean): Leccion | null {
  return LECCIONES.find(l => !completadas.includes(l.id) && (isPremium || !l.isPremium)) ?? null;
}
