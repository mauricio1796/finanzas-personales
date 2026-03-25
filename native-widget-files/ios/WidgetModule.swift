import Foundation
import React
import WidgetKit

@objc(WidgetModule)
class WidgetModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { return false }

  @objc func updateWidget(_ jsonData: String,
                           resolver resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    let appGroupId = "group.com.financyai.finanzaspersonales"

    guard let userDefaults = UserDefaults(suiteName: appGroupId) else {
      reject("WIDGET_ERROR", "No se pudo acceder al App Group \(appGroupId)", nil)
      return
    }

    userDefaults.set(jsonData, forKey: "financy_widget_data")
    userDefaults.synchronize()

    // Recargar el widget inmediatamente
    if #available(iOS 14.0, *) {
      DispatchQueue.main.async {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }

    resolve(true)
  }
}
