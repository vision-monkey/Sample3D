package com.example.hapticlab.util

/**
 * Turns `Build.MODEL` codes into marketing names for common Galaxy phones
 * (e.g. "SM-S921N" -> "Galaxy S24"). Unknown models fall back to the raw model string.
 */
object DeviceNames {

    // Prefix (without the trailing region letter) -> marketing name.
    private val samsung = linkedMapOf(
        "SM-S937" to "Galaxy S25 Edge",
        "SM-S931" to "Galaxy S25", "SM-S936" to "Galaxy S25+", "SM-S938" to "Galaxy S25 Ultra",
        "SM-S921" to "Galaxy S24", "SM-S926" to "Galaxy S24+", "SM-S928" to "Galaxy S24 Ultra",
        "SM-S721" to "Galaxy S24 FE",
        "SM-S911" to "Galaxy S23", "SM-S916" to "Galaxy S23+", "SM-S918" to "Galaxy S23 Ultra",
        "SM-S711" to "Galaxy S23 FE",
        "SM-S901" to "Galaxy S22", "SM-S906" to "Galaxy S22+", "SM-S908" to "Galaxy S22 Ultra",
        "SM-F966" to "Galaxy Z Fold7", "SM-F766" to "Galaxy Z Flip7",
        "SM-F956" to "Galaxy Z Fold6", "SM-F741" to "Galaxy Z Flip6",
        "SM-F946" to "Galaxy Z Fold5", "SM-F731" to "Galaxy Z Flip5",
        "SM-F936" to "Galaxy Z Fold4", "SM-F721" to "Galaxy Z Flip4",
        "SM-A566" to "Galaxy A56", "SM-A556" to "Galaxy A55", "SM-A546" to "Galaxy A54",
        "SM-A366" to "Galaxy A36", "SM-A356" to "Galaxy A35", "SM-A346" to "Galaxy A34",
    )

    fun displayName(manufacturer: String, model: String): String {
        if (manufacturer.equals("samsung", ignoreCase = true)) {
            samsung.entries.firstOrNull { model.startsWith(it.key, ignoreCase = true) }?.let { return it.value }
            return model
        }
        val brand = manufacturer.replaceFirstChar { it.uppercase() }
        return if (model.startsWith(brand, ignoreCase = true)) model else "$brand $model".trim()
    }
}
