package expo.modules.finncaptura

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Puente JS ↔ captura de notificaciones (Android). */
class FinnCapturaModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("FinnCaptura")

    Events("onCaptura")

    OnStartObserving { instancia = this@FinnCapturaModule }
    OnStopObserving { if (instancia === this@FinnCapturaModule) instancia = null }
    OnDestroy { if (instancia === this@FinnCapturaModule) instancia = null }

    /** ¿El usuario dio a Finn el acceso a notificaciones en Ajustes? */
    Function("tienePermiso") {
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }

    /** Abre la pantalla del sistema para dar (o quitar) el acceso. */
    Function("abrirAjustesPermiso") {
      val componente = ComponentName(context, FinnNotificationListener::class.java)
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
          .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, componente.flattenToString())
      } else {
        Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
      } catch (e: Exception) {
        context.startActivity(Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    Function("obtenerConfiguracion") {
      mapOf(
        "habilitado" to CapturaStore.habilitado(context),
        "fuentes" to CapturaStore.fuentes(context).toList(),
      )
    }

    Function("configurar") { habilitado: Boolean, fuentes: List<String> ->
      CapturaStore.configurar(context, habilitado, fuentes.toSet())
    }

    /** Cola pendiente como JSON: [{ id, paquete, fuente, texto, recibidoEn }]. */
    Function("obtenerPendientes") {
      CapturaStore.leer(context).toString()
    }

    Function("confirmarProcesadas") { ids: List<String> ->
      CapturaStore.eliminar(context, ids.toSet())
    }

    Function("mostrarAviso") { titulo: String, cuerpo: String ->
      AvisosFinn.mostrar(context, titulo, cuerpo)
    }
  }

  companion object {
    @Volatile
    private var instancia: FinnCapturaModule? = null

    /** Avisa a la app viva de una entrada nueva. false si no hay nadie escuchando. */
    fun notificar(id: String): Boolean {
      val modulo = instancia ?: return false
      return try {
        if (modulo.appContext.reactContext == null) return false
        modulo.sendEvent("onCaptura", mapOf("id" to id))
        true
      } catch (e: Throwable) {
        false
      }
    }
  }
}
