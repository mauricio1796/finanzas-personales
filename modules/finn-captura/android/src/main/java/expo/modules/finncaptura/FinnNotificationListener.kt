package expo.modules.finncaptura

import android.app.Notification
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.facebook.react.ReactApplication
import com.facebook.react.ReactInstanceEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import org.json.JSONObject
import java.util.UUID

/**
 * Escucha las notificaciones del teléfono (solo si el usuario dio el acceso)
 * y guarda en la cola las que parecen movimientos bancarios de las fuentes
 * habilitadas. Luego avisa a la app:
 *  - si la app está viva, por evento (la app registra y actualiza la UI);
 *  - si no, lanza una tarea JS en segundo plano que muestra el aviso de Finn.
 */
class FinnNotificationListener : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    try {
      procesar(sbn)
    } catch (e: Throwable) {
      Log.w(TAG, "No se pudo procesar la notificación", e)
    }
  }

  private fun procesar(sbn: StatusBarNotification) {
    val context = applicationContext
    if (!CapturaStore.habilitado(context)) return
    val paquete = sbn.packageName ?: return
    if (paquete == context.packageName) return
    val fuente = FiltroFinanciero.fuente(paquete, context) ?: return
    if (fuente !in CapturaStore.fuentes(context)) return

    val n = sbn.notification ?: return
    if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
    val extras = n.extras ?: return

    val titulo = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
    val cuerpo = (ultimoMensaje(extras)
      ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
      ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString()?.trim().orEmpty()
    if (cuerpo.isEmpty()) return

    // El título suele ser el remitente o el nombre del banco ("Nequi"): ayuda a reconocer la entidad.
    val texto = if (titulo.isNotEmpty() && !cuerpo.contains(titulo)) "$titulo: $cuerpo" else cuerpo
    if (!FiltroFinanciero.esFinanciero(texto)) return

    val entrada = JSONObject()
      .put("id", UUID.randomUUID().toString())
      .put("paquete", paquete)
      .put("fuente", fuente)
      .put("texto", texto.take(1500))
      .put("recibidoEn", sbn.postTime)
    if (!CapturaStore.agregar(context, entrada)) return

    if (!FinnCapturaModule.notificar(entrada.getString("id"))) {
      lanzarTareaSegundoPlano(entrada.getString("id"))
    }
  }

  /** En notificaciones tipo conversación (Mensajes) el texto completo está en el último mensaje. */
  @Suppress("DEPRECATION")
  private fun ultimoMensaje(extras: Bundle): CharSequence? {
    val mensajes = extras.getParcelableArray(Notification.EXTRA_MESSAGES) ?: return null
    val ultimo = mensajes.lastOrNull() as? Bundle ?: return null
    return ultimo.getCharSequence("text")
  }

  /**
   * Arranca la tarea JS "FinnCapturaTask" (index.js) sin abrir la app. Es lo
   * mismo que hace HeadlessJsTaskService, pero desde este servicio, que el
   * sistema ya mantiene vivo mientras tenga el acceso a notificaciones.
   */
  private fun lanzarTareaSegundoPlano(id: String) {
    Handler(Looper.getMainLooper()).post {
      try {
        val host = (application as? ReactApplication)?.reactHost ?: return@post
        val datos = Arguments.createMap().apply { putString("id", id) }
        val config = HeadlessJsTaskConfig(TAREA, datos, 20_000, true)
        val actual = host.currentReactContext
        if (actual != null) {
          iniciar(actual, config)
        } else {
          host.addReactInstanceEventListener(object : ReactInstanceEventListener {
            override fun onReactContextInitialized(context: ReactContext) {
              host.removeReactInstanceEventListener(this)
              iniciar(context, config)
            }
          })
          host.start()
        }
      } catch (e: Throwable) {
        // Si no se puede, la entrada sigue en la cola y se procesa al abrir la app.
        Log.w(TAG, "No se pudo lanzar la tarea en segundo plano", e)
      }
    }
  }

  private fun iniciar(context: ReactContext, config: HeadlessJsTaskConfig) {
    Handler(Looper.getMainLooper()).post {
      try {
        HeadlessJsTaskContext.getInstance(context).startTask(config)
      } catch (e: Throwable) {
        Log.w(TAG, "La tarea en segundo plano falló al iniciar", e)
      }
    }
  }

  companion object {
    private const val TAG = "FinnCaptura"
    const val TAREA = "FinnCapturaTask"
  }
}
