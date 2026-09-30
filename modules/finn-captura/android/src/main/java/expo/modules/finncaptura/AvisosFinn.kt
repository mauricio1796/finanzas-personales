package expo.modules.finncaptura

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/** Aviso propio de Finn: "Finn registró $23.900 en APPLE.COM/BILL → Suscripciones". */
object AvisosFinn {
  private const val CANAL = "finn_captura"
  private const val DEEP_LINK = "finanzaspersonales://captura"

  private fun asegurarCanal(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(NotificationManager::class.java) ?: return
    if (nm.getNotificationChannel(CANAL) != null) return
    val canal = NotificationChannel(CANAL, "Compras detectadas por Finn", NotificationManager.IMPORTANCE_DEFAULT)
    canal.description = "Avisos cuando Finn registra una compra de tu banco o necesita que confirmes una."
    nm.createNotificationChannel(canal)
  }

  private fun iconoPequeno(context: Context): Int {
    // expo-notifications genera "notification_icon" a partir de app.json.
    val id = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (id != 0) id else context.applicationInfo.icon
  }

  fun mostrar(context: Context, titulo: String, cuerpo: String) {
    val app = context.applicationContext
    if (!NotificationManagerCompat.from(app).areNotificationsEnabled()) return
    asegurarCanal(app)

    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(DEEP_LINK)).apply {
      setPackage(app.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    val pending = PendingIntent.getActivity(
      app, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notificacion = NotificationCompat.Builder(app, CANAL)
      .setSmallIcon(iconoPequeno(app))
      .setContentTitle(titulo.take(80))
      .setContentText(cuerpo.take(200))
      .setStyle(NotificationCompat.BigTextStyle().bigText(cuerpo.take(400)))
      .setContentIntent(pending)
      .setAutoCancel(true)
      .setCategory(NotificationCompat.CATEGORY_STATUS)
      .build()

    try {
      NotificationManagerCompat.from(app).notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notificacion)
    } catch (e: SecurityException) {
      // Sin permiso POST_NOTIFICATIONS: el movimiento igual queda en la app.
    }
  }
}
