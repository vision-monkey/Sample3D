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
    CLICK("CLICK", 30, 12, "또렷하고 힘 있는 딸깍"),
    THUD("THUD", 31, 60, "낮고 묵직한 쿵"),
    SPIN("SPIN", 31, 140, "빙글 도는 듯한 흔들림"),
    QUICK_RISE("QUICK_RISE", 30, 150, "짧게 점점 세지는 진동"),
    SLOW_RISE("SLOW_RISE", 30, 400, "천천히 길게 세지는 진동"),
    QUICK_FALL("QUICK_FALL", 30, 100, "세게 시작해 빠르게 사라지는 진동"),
    TICK("TICK", 30, 8, "아주 짧고 가벼운 톡"),
    LOW_TICK("LOW_TICK", 31, 12, "낮고 둔한 느낌의 톡"),
}
