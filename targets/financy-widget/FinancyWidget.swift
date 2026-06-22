import WidgetKit
import SwiftUI

// ── Colores de marca FinancyAI ───────────────────────────────────────────────
private extension Color {
  static let financyPrimary    = Color(red: 0.38, green: 0.34, blue: 0.91) // #6156E8
  static let financyIncome     = Color(red: 0.11, green: 0.62, blue: 0.46) // #1D9E75
  static let financyExpense    = Color(red: 0.96, green: 0.36, blue: 0.36) // #F55B5B
  static let financyBackground = Color(red: 0.97, green: 0.97, blue: 1.00) // #F8F7FF
}

// ── Modelo de datos leído del App Group ─────────────────────────────────────
struct WidgetData: Codable {
  var balanceDisponible: Double
  var ingresoMes:        Double
  var gastadoHoy:        Double
  var porcentajeGastado: Double
  var nombreUsuario:     String
  var mesLabel:          String
  var ultimaActualizacion: String

  static var placeholder: WidgetData {
    WidgetData(
      balanceDisponible: 0,
      ingresoMes: 0,
      gastadoHoy: 0,
      porcentajeGastado: 0,
      nombreUsuario: "Usuario",
      mesLabel: "—",
      ultimaActualizacion: "--:--"
    )
  }
}

// ── Lectura desde App Group UserDefaults ────────────────────────────────────
func loadWidgetData() -> WidgetData {
  let suiteName = "group.com.financyai.finanzaspersonales"
  guard
    let defaults = UserDefaults(suiteName: suiteName),
    let json     = defaults.string(forKey: "financy_widget_data"),
    let data     = json.data(using: .utf8),
    let decoded  = try? JSONDecoder().decode(WidgetData.self, from: data)
  else {
    return .placeholder
  }
  return decoded
}

// ── Formato de moneda colombiana ────────────────────────────────────────────
func formatCOP(_ value: Double) -> String {
  let formatter         = NumberFormatter()
  formatter.numberStyle = .currency
  formatter.currencyCode   = "COP"
  formatter.currencySymbol = "$"
  formatter.maximumFractionDigits = 0
  formatter.minimumFractionDigits = 0
  formatter.groupingSeparator = "."
  return formatter.string(from: NSNumber(value: value)) ?? "$0"
}

func formatCOPCompact(_ value: Double) -> String {
  if abs(value) >= 1_000_000 {
    return String(format: "$%.1fM", value / 1_000_000)
  } else if abs(value) >= 1_000 {
    return String(format: "$%.0fK", value / 1_000)
  }
  return formatCOP(value)
}

// ── Timeline Provider ────────────────────────────────────────────────────────
struct FinancyProvider: TimelineProvider {
  func placeholder(in context: Context) -> FinancyEntry {
    FinancyEntry(date: Date(), data: .placeholder, isPlaceholder: true)
  }

  func getSnapshot(in context: Context, completion: @escaping (FinancyEntry) -> Void) {
    let data = context.isPreview ? .placeholder : loadWidgetData()
    completion(FinancyEntry(date: Date(), data: data, isPlaceholder: context.isPreview))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<FinancyEntry>) -> Void) {
    let data  = loadWidgetData()
    let entry = FinancyEntry(date: Date(), data: data, isPlaceholder: false)
    // El SO puede refrescar hasta la próxima hora; la app fuerza refresh al cambiar datos
    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 60, to: Date())!
    completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
  }
}

struct FinancyEntry: TimelineEntry {
  let date:          Date
  let data:          WidgetData
  let isPlaceholder: Bool
}

// ── Deep link al tocar el widget ─────────────────────────────────────────────
// finanzaspersonales://agregar-gasto abre QuickAddSheet en modo gasto
private let deepLinkAgregarGasto = URL(string: "finanzaspersonales://agregar-gasto")!

// ── Vistas ───────────────────────────────────────────────────────────────────

// systemSmall — home screen
struct HomeSmallView: View {
  let entry: FinancyEntry

  var balanceColor: Color {
    if entry.isPlaceholder { return .secondary }
    return entry.data.balanceDisponible >= 0 ? .financyIncome : .financyExpense
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack {
        Text("FinancyAI")
          .font(.system(size: 10, weight: .semibold))
          .foregroundColor(.financyPrimary)
        Spacer()
        Image(systemName: "wallet.bifold.fill")
          .font(.system(size: 10))
          .foregroundColor(.financyPrimary)
      }

      Spacer()

      Text("Saldo disponible")
        .font(.system(size: 11, weight: .medium))
        .foregroundColor(.secondary)

      Text(entry.isPlaceholder ? "—" : formatCOPCompact(entry.data.balanceDisponible))
        .font(.system(size: 22, weight: .bold, design: .rounded))
        .foregroundColor(balanceColor)
        .minimumScaleFactor(0.6)
        .lineLimit(1)

      Spacer()

      HStack {
        VStack(alignment: .leading, spacing: 1) {
          Text("Hoy gastado")
            .font(.system(size: 9))
            .foregroundColor(.secondary)
          Text(entry.isPlaceholder ? "—" : formatCOPCompact(entry.data.gastadoHoy))
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(.financyExpense)
        }
        Spacer()
        Text("+")
          .font(.system(size: 14, weight: .bold))
          .foregroundColor(.financyPrimary)
          .frame(width: 26, height: 26)
          .background(Color.financyPrimary.opacity(0.12))
          .clipShape(Circle())
      }
    }
    .padding(14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .background(Color(.systemBackground))
    .widgetURL(deepLinkAgregarGasto)
  }
}

// accessoryRectangular — lock screen, Watch
struct AccessoryRectangularView: View {
  let entry: FinancyEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack {
        Image(systemName: "wallet.bifold.fill")
          .font(.system(size: 10))
        Text("FinancyAI · \(entry.data.mesLabel)")
          .font(.system(size: 10, weight: .semibold))
      }
      .foregroundColor(.primary)

      Text(entry.isPlaceholder ? "Sin datos" : formatCOP(entry.data.balanceDisponible))
        .font(.system(size: 15, weight: .bold, design: .rounded))
        .foregroundColor(entry.data.balanceDisponible >= 0 ? .primary : .red)
        .minimumScaleFactor(0.7)
        .lineLimit(1)

      Text(entry.isPlaceholder ? "Toca para agregar gasto"
           : "Gastado hoy: \(formatCOPCompact(entry.data.gastadoHoy))")
        .font(.system(size: 10))
        .foregroundColor(.secondary)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .widgetURL(deepLinkAgregarGasto)
  }
}

// accessoryCircular — lock screen compact
struct AccessoryCircularView: View {
  let entry: FinancyEntry

  var body: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 1) {
        Image(systemName: "wallet.bifold.fill")
          .font(.system(size: 12))
        Text(entry.isPlaceholder ? "—" : formatCOPCompact(entry.data.balanceDisponible))
          .font(.system(size: 11, weight: .bold, design: .rounded))
          .minimumScaleFactor(0.5)
          .lineLimit(1)
      }
      .foregroundColor(.primary)
    }
    .widgetURL(deepLinkAgregarGasto)
  }
}

// accessoryInline — lock screen inline (una sola línea)
struct AccessoryInlineView: View {
  let entry: FinancyEntry

  var body: some View {
    Label(
      entry.isPlaceholder ? "FinancyAI" : "Saldo: \(formatCOPCompact(entry.data.balanceDisponible))",
      systemImage: "wallet.bifold.fill"
    )
    .widgetURL(deepLinkAgregarGasto)
  }
}

// ── Widget principal ──────────────────────────────────────────────────────────
struct FinancyWidget: Widget {
  let kind = "FinancyWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: FinancyProvider()) { entry in
      FinancyWidgetEntryView(entry: entry)
        .containerBackground(.fill.tertiary, for: .widget)
    }
    .configurationDisplayName("FinancyAI")
    .description("Saldo disponible del mes. Toca para agregar un gasto.")
    .supportedFamilies([
      .systemSmall,
      .accessoryRectangular,
      .accessoryCircular,
      .accessoryInline,
    ])
  }
}

struct FinancyWidgetEntryView: View {
  @Environment(\.widgetFamily) var family
  let entry: FinancyEntry

  var body: some View {
    switch family {
    case .systemSmall:
      HomeSmallView(entry: entry)
    case .accessoryRectangular:
      AccessoryRectangularView(entry: entry)
    case .accessoryCircular:
      AccessoryCircularView(entry: entry)
    case .accessoryInline:
      AccessoryInlineView(entry: entry)
    default:
      HomeSmallView(entry: entry)
    }
  }
}
