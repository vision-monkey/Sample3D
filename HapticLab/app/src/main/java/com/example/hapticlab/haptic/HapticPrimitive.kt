package com.example.hapticlab.haptic

/**
 * The eight public `VibrationEffect.Composition.PRIMITIVE_*` constants.
 *
 * This enum is deliberately free of Android imports so that pattern data can be
 * unit-tested on the JVM. The mapping to the framework constant lives in
 * [HapticEffectFactory.frameworkId].
 *
 * @property minApi first API level that defines the constant.
 * @property nominalDurationMs typical duration used for UI estimates and the
 *   waveform synthesizer. Real durations come from `Vibrator.getPrimitiveDurations`
 *   (API 31+) and differ per device.
 */
enum class HapticPrimitive(
    val label: String,
    val minApi: Int,
    val nominalDurationMs: Int,
    val feel: String,
) {
    CLICK("CLICK", 30, 12, "Crisp, strong click"),
    THUD("THUD", 31, 60, "Deep, heavy, low-frequency hit"),
    SPIN("SPIN", 31, 140, "Wobbling spin with rising-then-falling energy"),
    QUICK_RISE("QUICK_RISE", 30, 150, "Short ramp up in intensity"),
    SLOW_RISE("SLOW_RISE", 30, 400, "Long, gentle ramp up"),
    QUICK_FALL("QUICK_FALL", 30, 100, "Fast decay from strong to nothing"),
    TICK("TICK", 30, 8, "Very short, light, sharp tick"),
    LOW_TICK("LOW_TICK", 31, 12, "Short tick with a lower, duller pitch"),
}
