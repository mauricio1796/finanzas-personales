import WidgetKit
import SwiftUI

// ── Modelo ────────────────────────────────────────────────────────────────────

struct WidgetData: Codable {
    var balanceDisponible:   Double
    var ingresoMes:          Double
    var gastadoHoy:          Double
    var gastadoMes:          Double
    var presupuestoTotal:    Double
    var porcentajeGastado:   Int
    var proximoPago:         ProximoPago?
    var rachaActual:         Int
    var nivelUsuario:        Int
    var tituloNivel:         String
    var nombreUsuario:       String
    var mesLabel:            String
    var ultimaActualizacion: String

    struct ProximoPago: Codable {
        var nombre:        String
        var monto:         Double
        var diasRestantes: Int
    }

    static let placeholder = WidgetData(
        balanceDisponible:   1_250_000,
        ingresoMes:          2_600_000,
        gastadoHoy:          45_000,
        gastadoMes:          1_350_000,
        presupuestoTotal:    2_600_000,
        porcentajeGastado:   52,
        proximoPago:         ProximoPago(nombre: "Vivienda", monto: 800_000, diasRestantes: 3),
        rachaActual:         7,
        nivelUsuario:        3,
        tituloNivel:         "Gestor",
        nombreUsuario:       "Usuario",
        mesLabel:            "mar. 2025",
        ultimaActualizacion: "09:30"
    )
}

// ── Provider ──────────────────────────────────────────────────────────────────

struct FinancyProvider: TimelineProvider {
    let appGroupId = "group.com.financyai.finanzaspersonales"

    func placeholder(in context: Context) -> FinancyEntry {
        FinancyEntry(date: Date(), data: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (FinancyEntry) -> Void) {
        completion(FinancyEntry(date: Date(), data: cargarDatos() ?? .placeholder))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FinancyEntry>) -> Void) {
        let data      = cargarDatos() ?? .placeholder
        let entry     = FinancyEntry(date: Date(), data: data)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }

    private func cargarDatos() -> WidgetData? {
        guard
            let userDefaults = UserDefaults(suiteName: appGroupId),
            let jsonStr      = userDefaults.string(forKey: "financy_widget_data"),
            let jsonData     = jsonStr.data(using: .utf8)
        else { return nil }
        return try? JSONDecoder().decode(WidgetData.self, from: jsonData)
    }
}

// ── Entry ─────────────────────────────────────────────────────────────────────

struct FinancyEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

// ── Vista ─────────────────────────────────────────────────────────────────────

struct FinancyWidgetView: View {
    var entry: FinancyEntry
    @Environment(\.widgetFamily) var family

    var pct: Double { Double(min(entry.data.porcentajeGastado, 100)) / 100.0 }

    var barColor: Color {
        let p = entry.data.porcentajeGastado
        if p >= 100 { return Color(red: 0.937, green: 0.267, blue: 0.267) }
        if p >= 80  { return Color(red: 0.965, green: 0.620, blue: 0.043) }
        return Color(red: 0.065, green: 0.725, blue: 0.596)
    }

    var body: some View {
        ZStack {
            Color(red: 0.388, green: 0.4, blue: 0.945).ignoresSafeArea()

            VStack(alignment: .leading, spacing: 6) {
                // Header
                HStack {
                    Text("FinancyAI")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(.white.opacity(0.75))
                    Spacer()
                    Text(entry.data.ultimaActualizacion)
                        .font(.system(size: 9))
                        .foregroundColor(.white.opacity(0.55))
                }

                // Balance
                VStack(alignment: .leading, spacing: 1) {
                    Text("BALANCE DISPONIBLE")
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundColor(.white.opacity(0.65))
                        .kerning(0.5)
                    Text(formatCOP(entry.data.balanceDisponible))
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(.white)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                }

                // Barra presupuesto
                VStack(alignment: .leading, spacing: 2) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color.white.opacity(0.25))
                                .frame(height: 5)
                            RoundedRectangle(cornerRadius: 3)
                                .fill(barColor)
                                .frame(width: geo.size.width * pct, height: 5)
                        }
                    }
                    .frame(height: 5)

                    HStack {
                        Text("\(entry.data.porcentajeGastado)% del ingreso")
                            .font(.system(size: 8))
                            .foregroundColor(.white.opacity(0.65))
                        Spacer()
                        Text(entry.data.mesLabel)
                            .font(.system(size: 8))
                            .foregroundColor(.white.opacity(0.55))
                    }
                }

                Spacer(minLength: 2)

                // Pills
                HStack(spacing: 5) {
                    pillView(label: "HOY",     value: formatCOP(entry.data.gastadoHoy))
                    pillView(label: "RACHA",   value: "\(entry.data.rachaActual)d")
                    if let pago = entry.data.proximoPago {
                        pillView(
                            label: "PRÓXIMO",
                            value: pago.diasRestantes == 0
                                ? "Hoy"
                                : "día \(Calendar.current.component(.day, from: Date()) + pago.diasRestantes)"
                        )
                    } else {
                        pillView(label: "PAGOS", value: "Al día")
                    }
                }
            }
            .padding(14)
        }
    }

    func formatCOP(_ n: Double) -> String {
        if n >= 1_000_000 { return "$\(String(format: "%.1f", n / 1_000_000))M" }
        if n >= 1_000     { return "$\(Int(n / 1_000))k" }
        return "$\(Int(n))"
    }

    func pillView(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label)
                .font(.system(size: 7, weight: .semibold))
                .foregroundColor(.white.opacity(0.65))
                .kerning(0.3)
            Text(value)
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.15))
        .cornerRadius(8)
    }
}

// ── Widget entry point ────────────────────────────────────────────────────────

@main
struct FinancyAIWidget: Widget {
    let kind: String = "FinancyAIWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FinancyProvider()) { entry in
            FinancyWidgetView(entry: entry)
        }
        .configurationDisplayName("FinancyAI")
        .description("Tu balance y presupuesto de un vistazo.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
