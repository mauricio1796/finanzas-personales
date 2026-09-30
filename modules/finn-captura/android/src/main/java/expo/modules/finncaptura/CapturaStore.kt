package expo.modules.finncaptura

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Cola local de notificaciones financieras pendientes de procesar por la app.
 *
 * Vive en el almacenamiento privado de la app (sin respaldo en la nube:
 * allowBackup=false). Se vacía cuando la app las procesa; como máximo guarda
 * 100 y descarta las de más de 30 días.
 */
object CapturaStore {
  private const val PREFS = "finn_captura"
  private const val K_HABILITADO = "habilitado"
  private const val K_FUENTES = "fuentes"
  private const val K_COLA = "cola"
  private const val MAX_COLA = 100
  private const val MAX_EDAD_MS = 30L * 24 * 3600 * 1000
  /** Una misma notificación reenviada (actualizada) no se guarda dos veces. */
  private const val VENTANA_DUPLICADO_MS = 10L * 60 * 1000

  private fun prefs(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun habilitado(context: Context): Boolean = prefs(context).getBoolean(K_HABILITADO, false)

  fun fuentes(context: Context): Set<String> =
    prefs(context).getStringSet(K_FUENTES, null)?.toSet() ?: FiltroFinanciero.FUENTES_POR_DEFECTO

  fun configurar(context: Context, habilitado: Boolean, fuentes: Set<String>) {
    val editor = prefs(context).edit()
      .putBoolean(K_HABILITADO, habilitado)
      .putStringSet(K_FUENTES, fuentes)
    // Al desactivar se borra lo que estuviera en cola: el usuario retiró el permiso.
    if (!habilitado) editor.remove(K_COLA)
    editor.apply()
  }

  @Synchronized
  fun leer(context: Context): JSONArray {
    val raw = prefs(context).getString(K_COLA, null) ?: return JSONArray()
    return try { JSONArray(raw) } catch (e: Exception) { JSONArray() }
  }

  private fun escribir(context: Context, cola: JSONArray) {
    prefs(context).edit().putString(K_COLA, cola.toString()).apply()
  }

  /** Agrega una entrada. Devuelve false si es un duplicado reciente. */
  @Synchronized
  fun agregar(context: Context, entrada: JSONObject): Boolean {
    val ahora = System.currentTimeMillis()
    val texto = entrada.optString("texto")
    val actual = leer(context)
    val nueva = JSONArray()
    for (i in 0 until actual.length()) {
      val e = actual.optJSONObject(i) ?: continue
      val edad = ahora - e.optLong("recibidoEn")
      if (edad > MAX_EDAD_MS) continue
      if (e.optString("texto") == texto && edad < VENTANA_DUPLICADO_MS) return false
      nueva.put(e)
    }
    nueva.put(entrada)
    // Solo las más recientes.
    val recortada = JSONArray()
    val desde = maxOf(0, nueva.length() - MAX_COLA)
    for (i in desde until nueva.length()) recortada.put(nueva.get(i))
    escribir(context, recortada)
    return true
  }

  @Synchronized
  fun eliminar(context: Context, ids: Set<String>) {
    val actual = leer(context)
    val resto = JSONArray()
    for (i in 0 until actual.length()) {
      val e = actual.optJSONObject(i) ?: continue
      if (e.optString("id") !in ids) resto.put(e)
    }
    escribir(context, resto)
  }
}
