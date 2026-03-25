package com.financyai.finanzaspersonales

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class WidgetModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetModule"

    @ReactMethod
    fun updateWidget(jsonData: String, promise: Promise) {
        try {
            val context = reactApplicationContext

            // Guardar datos en SharedPreferences (accesible por el AppWidgetProvider)
            val prefs = context.getSharedPreferences("financy_widget", Context.MODE_PRIVATE)
            prefs.edit().putString("widget_data", jsonData).apply()

            // Disparar actualización del widget
            val intent = Intent(context, FinancyWidget::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                val ids = AppWidgetManager.getInstance(context)
                    .getAppWidgetIds(ComponentName(context, FinancyWidget::class.java))
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message)
        }
    }
}
