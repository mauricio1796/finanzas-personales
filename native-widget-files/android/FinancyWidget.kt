package com.financyai.finanzaspersonales

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import android.app.PendingIntent
import android.content.Intent
import org.json.JSONObject

class FinancyWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { id ->
            updateWidget(context, appWidgetManager, id)
        }
    }

    companion object {
        fun updateWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
        ) {
            val views = RemoteViews(context.packageName, R.layout.financy_widget)

            val prefs   = context.getSharedPreferences("financy_widget", Context.MODE_PRIVATE)
            val jsonStr = prefs.getString("widget_data", null)

            if (jsonStr != null) {
                try {
                    val data = JSONObject(jsonStr)

                    val balance = data.optDouble("balanceDisponible", 0.0)
                    views.setTextViewText(R.id.widget_balance, formatCOP(balance))

                    val pct = data.optInt("porcentajeGastado", 0).coerceIn(0, 100)
                    views.setProgressBar(R.id.widget_progress, 100, pct, false)

                    val hoy = data.optDouble("gastadoHoy", 0.0)
                    views.setTextViewText(R.id.widget_hoy, formatCOP(hoy))

                    val racha = data.optInt("rachaActual", 0)
                    views.setTextViewText(R.id.widget_racha, "$racha días")

                    val proximoPago = data.optJSONObject("proximoPago")
                    if (proximoPago != null) {
                        val nombre = proximoPago.optString("nombre", "—")
                        val dias   = proximoPago.optInt("diasRestantes", 0)
                        views.setTextViewText(
                            R.id.widget_pago,
                            if (dias == 0) "Hoy: $nombre" else "en $dias d: $nombre",
                        )
                    } else {
                        views.setTextViewText(R.id.widget_pago, "Sin pagos")
                    }

                    val hora = data.optString("ultimaActualizacion", "")
                    views.setTextViewText(R.id.widget_updated, hora)

                } catch (_: Exception) {
                    views.setTextViewText(R.id.widget_balance, "Error al leer datos")
                }
            } else {
                views.setTextViewText(R.id.widget_balance, "Abre FinancyAI")
                views.setTextViewText(R.id.widget_hoy, "—")
                views.setTextViewText(R.id.widget_racha, "—")
                views.setTextViewText(R.id.widget_pago, "—")
                views.setTextViewText(R.id.widget_updated, "")
            }

            // Tap → abrir la app
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_balance, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun formatCOP(n: Double): String = when {
            n >= 1_000_000 -> "\$${String.format("%.1f", n / 1_000_000)}M"
            n >= 1_000     -> "\$${(n / 1_000).toInt()}k"
            else           -> "\$${n.toInt()}"
        }
    }
}
