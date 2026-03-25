# Instrucciones para activar los widgets nativos

## Paso 1 — Generar carpetas nativas

```bash
npx expo prebuild --clean
```

Esto crea `android/` e `ios/`. Ejecutar UNA SOLA VEZ (borra y regenera todo).

---

## Paso 2 — Android

### Copiar archivos Kotlin

```
native-widget-files/android/WidgetModule.kt   →  android/app/src/main/java/com/financyai/finanzaspersonales/
native-widget-files/android/WidgetPackage.kt  →  android/app/src/main/java/com/financyai/finanzaspersonales/
native-widget-files/android/FinancyWidget.kt  →  android/app/src/main/java/com/financyai/finanzaspersonales/
```

### Copiar recursos

```
native-widget-files/android/res/layout/financy_widget.xml        →  android/app/src/main/res/layout/
native-widget-files/android/res/drawable/widget_background.xml   →  android/app/src/main/res/drawable/
native-widget-files/android/res/drawable/widget_pill.xml         →  android/app/src/main/res/drawable/
native-widget-files/android/res/drawable/widget_progress_drawable.xml → android/app/src/main/res/drawable/
native-widget-files/android/res/xml/financy_widget_info.xml      →  android/app/src/main/res/xml/
```

### Registrar el WidgetPackage en MainApplication.kt

Abrir `android/app/src/main/java/com/financyai/finanzaspersonales/MainApplication.kt`
y agregar `add(WidgetPackage())` en `getPackages()`:

```kotlin
override fun getPackages(): List<ReactPackage> = PackageList(this).packages.apply {
    add(WidgetPackage())  // ← AGREGAR
}
```

### Registrar el widget en AndroidManifest.xml

En `android/app/src/main/AndroidManifest.xml`, dentro de `<application>`:

```xml
<receiver
    android:name=".FinancyWidget"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/financy_widget_info"/>
</receiver>
```

### Agregar string en strings.xml

En `android/app/src/main/res/values/strings.xml`:

```xml
<string name="widget_description">Resumen financiero rápido de FinancyAI</string>
```

### Correr en Android

```bash
npx expo run:android
```

---

## Paso 3 — iOS (requiere Mac + Xcode)

### Copiar archivos Swift al target principal

```
native-widget-files/ios/WidgetModule.swift      →  ios/finanzaspersonales/
native-widget-files/ios/WidgetModuleBridge.m   →  ios/finanzaspersonales/
```

### Crear Widget Extension en Xcode

1. Abrir `ios/finanzaspersonales.xcworkspace` en Xcode
2. File → New → Target → Widget Extension
   - Product Name: `FinancyAIWidget`
   - Include Configuration Intent: **NO**
3. Reemplazar el archivo Swift generado con `native-widget-files/ios/FinancyAIWidget/FinancyAIWidget.swift`

### Configurar App Groups

En Xcode, para **ambos** targets (`finanzaspersonales` y `FinancyAIWidget`):
1. Signing & Capabilities → + Capability → App Groups
2. Agregar: `group.com.financyai.finanzaspersonales`

### Correr en iOS

```bash
npx expo run:ios
```

---

## Notas importantes

- El package ID es `com.financyai.finanzaspersonales` — no cambiarlo
- Si corrés `expo prebuild --clean` de nuevo, hay que volver a copiar los archivos nativos
- Los widgets solo funcionan en builds nativos (`run:android` / `run:ios` / EAS Build)
- En Expo Go los widgets no aparecen, pero el resto de la app funciona normal
- La pantalla "Widget de inicio" en la app (Drawer → Widget de inicio) muestra una preview y el botón de sincronización
