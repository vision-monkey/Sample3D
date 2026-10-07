package com.example.hapticlab.haptic

/** Which Android API family the engine uses to render a pattern. */
enum class HapticApiPath(val label: String, val detail: String) {
    ENVELOPE(
        "VibrationEffect.BasicEnvelopeBuilder",
        "Android 16 envelope effects (intensity + sharpness control points)",
    ),
    COMPOSITION(
        "VibrationEffect.Composition",
        "Primitive composition (startComposition / addPrimitive)",
    ),
    WAVEFORM_AMPLITUDE(
        "Waveform Fallback",
        "createWaveform(timings, amplitudes) with amplitude control",
    ),
    WAVEFORM_ON_OFF(
        "Waveform Fallback (On/Off)",
        "createWaveform(timings) — device has no amplitude control",
    ),
    NONE("No Vibrator", "This device reports no vibrator"),
}

/** Limits reported by `Vibrator.getEnvelopeEffectInfo()` (API 36). */
data class EnvelopeLimits(
    val maxControlPoints: Int,
    val minControlPointDurationMs: Long,
    val maxControlPointDurationMs: Long,
    val maxDurationMs: Long,
)

/** Data from `Vibrator.getFrequencyProfile()` (API 36). */
data class FrequencyProfileInfo(
    val minFrequencyHz: Float,
    val maxFrequencyHz: Float,
    val maxOutputAccelerationGs: Float,
)

data class HapticCapability(
    val manufacturer: String,
    val model: String,
    val displayName: String,
    val androidVersion: String,
    val apiLevel: Int,
    val hasVibrator: Boolean,
    val hasAmplitudeControl: Boolean,
    /** API 30+: `VibrationEffect.Composition` exists. */
    val compositionApiAvailable: Boolean,
    val primitiveSupport: Map<HapticPrimitive, Boolean>,
    /** Device-reported primitive durations (API 31+), 0 when unknown. */
    val primitiveDurationsMs: Map<HapticPrimitive, Int>,
    /** API 36+: `Vibrator.areEnvelopeEffectsSupported()`. */
    val envelopeSupported: Boolean,
    val envelopeLimits: EnvelopeLimits?,
    /** API 36+: non-null when the HAL exposes frequency control. */
    val frequencyProfile: FrequencyProfileInfo?,
    /** API 31+: `Vibrator.getResonantFrequency()`, null when unknown (NaN). */
    val resonantFrequencyHz: Float?,
    /** API 31+: `Vibrator.getQFactor()`, null when unknown (NaN). */
    val qFactor: Float?,
) {
    val frequencyControlSupported: Boolean get() = frequencyProfile != null

    val supportedPrimitives: List<HapticPrimitive>
        get() = HapticPrimitive.entries.filter { primitiveSupport[it] == true }

    val unsupportedPrimitives: List<HapticPrimitive>
        get() = HapticPrimitive.entries.filter { primitiveSupport[it] != true }

    fun isPrimitiveSupported(primitive: HapticPrimitive): Boolean = primitiveSupport[primitive] == true

    /** Duration to use for timing: device value when known, otherwise the nominal one. */
    fun primitiveDurationMs(primitive: HapticPrimitive): Int =
        primitiveDurationsMs[primitive]?.takeIf { it > 0 } ?: primitive.nominalDurationMs

    /** The best rendering path available on this device. */
    val bestPath: HapticApiPath
        get() = when {
            !hasVibrator -> HapticApiPath.NONE
            envelopeSupported -> HapticApiPath.ENVELOPE
            supportedPrimitives.isNotEmpty() -> HapticApiPath.COMPOSITION
            hasAmplitudeControl -> HapticApiPath.WAVEFORM_AMPLITUDE
            else -> HapticApiPath.WAVEFORM_ON_OFF
        }

    /** The waveform path this device will use when nothing better is possible. */
    val waveformPath: HapticApiPath
        get() = if (hasAmplitudeControl) HapticApiPath.WAVEFORM_AMPLITUDE else HapticApiPath.WAVEFORM_ON_OFF

    companion object {
        /** Used before detection or in previews. */
        val Unknown = HapticCapability(
            manufacturer = "Unknown",
            model = "Unknown",
            displayName = "Unknown device",
            androidVersion = "?",
            apiLevel = 0,
            hasVibrator = false,
            hasAmplitudeControl = false,
            compositionApiAvailable = false,
            primitiveSupport = HapticPrimitive.entries.associateWith { false },
            primitiveDurationsMs = emptyMap(),
            envelopeSupported = false,
            envelopeLimits = null,
            frequencyProfile = null,
            resonantFrequencyHz = null,
            qFactor = null,
        )
    }
}
