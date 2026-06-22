import ExpoModulesCore
import WidgetKit

// Escribe datos del widget al App Group compartido y fuerza recarga del timeline.
// El App Group "group.com.financyai.finanzaspersonales" debe estar habilitado
// tanto en la app como en la extensión del widget (ver app.json entitlements).
public class WidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    // updateWidget(json: String) → escribe al UserDefaults compartido y recarga el widget
    AsyncFunction("updateWidget") { (json: String) in
      let suiteName = "group.com.financyai.finanzaspersonales"
      guard let defaults = UserDefaults(suiteName: suiteName) else {
        throw NSError(
          domain: "WidgetBridge",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "App Group no configurado: \(suiteName)"]
        )
      }
      defaults.set(json, forKey: "financy_widget_data")
      defaults.synchronize()

      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
