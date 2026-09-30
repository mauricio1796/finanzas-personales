package expo.modules.finncaptura

import android.content.Context
import android.provider.Telephony

/**
 * Decide si una notificación puede ser un movimiento bancario.
 *
 * Minimización de datos: solo se miran las apps de las fuentes que el usuario
 * habilitó, y de ellas solo se conserva el texto que trae un monto y una
 * palabra financiera. Todo lo demás se descarta sin guardarse.
 */
object FiltroFinanciero {
  const val SMS = "sms"
  const val BANCOS = "bancos"
  const val CORREO = "correo"
  const val WALLET = "wallet"

  val FUENTES_POR_DEFECTO = setOf(SMS, BANCOS)

  private val PAQUETES_SMS = setOf(
    "com.google.android.apps.messaging",
    "com.samsung.android.messaging",
    "com.android.mms",
    "com.android.messaging",
    "com.motorola.messaging",
    "com.oneplus.mms",
  )

  /** Prefijos de paquete de bancos y billeteras colombianas. */
  private val PREFIJOS_BANCOS = listOf(
    "com.nequi", "com.todo1", "com.bancolombia", "com.davivienda", "com.daviplata",
    "co.com.bbva", "com.bbva", "com.bancodebogota", "com.grupoaval", "com.avvillas", "co.com.avvillas",
    "com.nu.production", "com.lulobank", "com.rappi.pay", "com.rappipay", "com.bancofalabella",
    "co.com.bancofalabella", "com.scotiabank", "com.colpatria", "com.itau", "com.bancopopular",
    "com.bancodeoccidente", "com.bancocajasocial", "com.bcsc", "com.movii", "co.com.dale", "com.dale",
  )

  private val PAQUETES_CORREO = setOf(
    "com.google.android.gm",
    "com.microsoft.office.outlook",
    "com.yahoo.mobile.client.android.mail",
  )

  private val PAQUETES_WALLET = setOf("com.google.android.apps.walletnfcrel")

  fun fuente(paquete: String, context: Context): String? = when {
    paquete in PAQUETES_SMS || paquete == smsPorDefecto(context) -> SMS
    paquete in PAQUETES_CORREO -> CORREO
    paquete in PAQUETES_WALLET -> WALLET
    PREFIJOS_BANCOS.any { paquete.startsWith(it) } -> BANCOS
    else -> null
  }

  private fun smsPorDefecto(context: Context): String? =
    try { Telephony.Sms.getDefaultSmsPackage(context) } catch (e: Exception) { null }

  private val MONTO = Regex("""\$\s?\d|\b\d{1,3}(?:[.,]\d{3})+\b|COP\s?\d""")
  private val PALABRAS = Regex(
    """compra|pago|pagaste|enviaste|env[ií]o|transfer|retir|recibiste|abono|consign|aprobad|d[eé]bito|cr[eé]dito|\bPSE\b|bre-?b|tarjeta|cuenta""",
    RegexOption.IGNORE_CASE,
  )

  fun esFinanciero(texto: String): Boolean = MONTO.containsMatchIn(texto) && PALABRAS.containsMatchIn(texto)
}
